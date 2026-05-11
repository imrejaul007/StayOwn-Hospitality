import gdprComplianceService from '../services/gdprComplianceService.js';
import ConsentRecord from '../models/ConsentRecord.js';
import logger from '../utils/logger.js';
import { ValidationError, NotFoundError } from '../middleware/errorHandler.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';

export const recordConsent = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const hotelId = req.user.hotelId;
    const { consents, ipAddress, userAgent, method } = req.body;

    if (!consents || typeof consents !== 'object') {
      throw new ValidationError('Consents object is required');
    }

    // Batch: use bulkWrite with upsert to persist all consent types at once
    const consentBulkOps = Object.entries(consents).map(([consentType, granted]) => ({
      updateOne: {
        filter: { userId, consentType },
        update: {
          $set: {
            hotelId,
            granted: !!granted,
            collectionMethod: method || 'api',
            ipAddress: ipAddress || req.ip,
            userAgent: userAgent || req.headers['user-agent'],
            policyVersion: '1.0',
            consentGivenAt: granted ? new Date() : undefined,
            consentWithdrawnAt: granted ? null : new Date(),
            expiresAt: granted ? new Date(Date.now() + 730 * 24 * 60 * 60 * 1000) : undefined
          },
          $push: {
            auditTrail: {
              action: granted ? 'granted' : 'withdrawn',
              timestamp: new Date(),
              performedBy: userId,
              ipAddress: ipAddress || req.ip,
              policyVersion: '1.0'
            }
          }
        },
        upsert: true
      }
    }));

    if (consentBulkOps.length > 0) {
      await ConsentRecord.bulkWrite(consentBulkOps);
    }

    // Fetch the saved records for response
    const consentTypes = Object.keys(consents);
    const savedRecords = await ConsentRecord.find({ userId, consentType: { $in: consentTypes } }).lean();

    // Also forward to in-memory GDPR compliance service
    const consentRecord = await gdprComplianceService.recordConsent(userId, {
      consents,
      ipAddress: ipAddress || req.ip,
      userAgent: userAgent || req.headers['user-agent'],
      method: method || 'api'
    });

    logger.info('User consent recorded', {
      userId,
      consentId: consentRecord.id,
      consentsGiven: Object.keys(consents).filter(k => consents[k]),
      persistedRecords: savedRecords.length
    });

    res.status(201).json({
      success: true,
      data: {
        consentId: consentRecord.id,
        timestamp: consentRecord.timestamp,
        consents: consentRecord.consents,
        persistedRecords: savedRecords.length
      }
    });
  } catch (error) {
    next(error);
  }
};

export const updateConsent = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { consentId } = req.params;
    const { consents, ipAddress, userAgent } = req.body;

    if (!consents || typeof consents !== 'object') {
      throw new ValidationError('Consents object is required');
    }

    const updatedRecord = await gdprComplianceService.updateConsent(userId, consentId, {
      consents,
      ipAddress: ipAddress || req.ip,
      userAgent: userAgent || req.headers['user-agent']
    });

    res.json({
      success: true,
      data: {
        consentId: updatedRecord.id,
        timestamp: updatedRecord.timestamp,
        consents: updatedRecord.consents
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getConsentHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Query persistent ConsentRecord collection
    const records = await ConsentRecord.find({ userId })
      .sort({ updatedAt: -1 })
      .limit(1000).lean();

    const summary = await ConsentRecord.getConsentSummary(userId);

    res.json({
      success: true,
      data: {
        userId,
        consentSummary: summary,
        consentHistory: records,
        total: records.length
      }
    });
  } catch (error) {
    next(error);
  }
};

export const requestDataAccess = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { format = 'json', includeMetadata = true } = req.body;

    const result = await gdprComplianceService.handleAccessRequest(userId, {
      format,
      includeMetadata,
      requestedBy: userId,
      requestMethod: 'api'
    });

    logger.info('Data access request completed', {
      userId,
      requestId: result.requestId,
      format
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const requestDataRectification = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { corrections, reason } = req.body;

    if (!corrections || typeof corrections !== 'object') {
      throw new ValidationError('Corrections object is required');
    }

    const result = await gdprComplianceService.handleRectificationRequest(
      userId,
      corrections,
      {
        reason,
        requestedBy: userId,
        requestMethod: 'api'
      }
    );

    logger.info('Data rectification request completed', {
      userId,
      requestId: result.requestId,
      fieldsUpdated: Object.keys(corrections)
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const requestDataErasure = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { reason, confirmErasure } = req.body;

    if (!confirmErasure) {
      throw new ValidationError('Erasure confirmation is required');
    }

    if (!reason) {
      throw new ValidationError('Reason for erasure is required');
    }

    const result = await gdprComplianceService.handleErasureRequest(userId, {
      reason,
      requestedBy: userId,
      requestMethod: 'api',
      confirmed: confirmErasure
    });

    logger.info('Data erasure request processed', {
      userId,
      requestId: result.requestId,
      status: result.status,
      reason
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const requestDataPortability = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { format = 'json' } = req.body;

    const validFormats = ['json', 'csv', 'xml'];
    if (!validFormats.includes(format)) {
      throw new ValidationError(`Format must be one of: ${validFormats.join(', ')}`);
    }

    const result = await gdprComplianceService.handlePortabilityRequest(userId, format);

    logger.info('Data portability request completed', {
      userId,
      requestId: result.requestId,
      format
    });

    // Set appropriate content type
    const contentTypes = {
      json: 'application/json',
      csv: 'text/csv',
      xml: 'application/xml'
    };

    res.setHeader('Content-Type', contentTypes[format]);
    res.setHeader('Content-Disposition', `attachment; filename="user-data-${userId}.${format}"`);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const checkProcessingLawfulness = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { dataCategory, purpose } = req.params;

    const isLawful = await gdprComplianceService.isProcessingLawful(userId, dataCategory, purpose);

    res.json({
      success: true,
      data: {
        userId,
        dataCategory,
        purpose,
        isLawful,
        checkedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getPrivacyNotice = async (req, res, next) => {
  try {
    const { language = 'en' } = req.query;

    const privacyNotice = gdprComplianceService.generatePrivacyNotice();

    res.json({
      success: true,
      data: {
        language,
        privacyNotice
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getDataProcessingInfo = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get information about how user's data is processed
    const processingInfo = {
      userId,
      dataCategories: gdprComplianceService.dataCategories,
      consentTypes: gdprComplianceService.consentTypes,
      retentionPeriods: Object.entries(gdprComplianceService.dataCategories).map(([key, category]) => ({
        category: key,
        name: category.name,
        retentionDays: category.retention,
        lawfulBasis: category.lawfulBasis
      })),
      rights: [
        'access',
        'rectification', 
        'erasure',
        'portability',
        'restrict_processing',
        'object_to_processing'
      ]
    };

    res.json({
      success: true,
      data: processingInfo
    });
  } catch (error) {
    next(error);
  }
};

// Admin endpoints for GDPR management

export const getDataRetentionReport = async (req, res, next) => {
  try {
    const retentionReport = await gdprComplianceService.checkDataRetention();

    res.json({
      success: true,
      data: {
        reportDate: new Date().toISOString(),
        ...retentionReport
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getComplianceReport = async (req, res, next) => {
  try {
    const complianceReport = gdprComplianceService.getComplianceReport();

    res.json({
      success: true,
      data: complianceReport
    });
  } catch (error) {
    next(error);
  }
};

export const getAllDataRequests = async (req, res, next) => {
  try {
    const { status, type, limit = 50, offset = 0 } = req.query;

    // Get all data requests (from database in production)
    const requests = Array.from(gdprComplianceService.dataRequests.values())
      .filter(request => {
        if (status && request.status !== status) return false;
        if (type && request.type !== type) return false;
        return true;
      })
      .sort((a, b) => new Date(b.requestDate) - new Date(a.requestDate))
      .slice(offset, offset + parseInt(limit));

    res.json({
      success: true,
      data: {
        requests,
        total: requests.length,
        filters: { status, type },
        pagination: { limit: parseInt(limit), offset: parseInt(offset) }
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getDataRequestById = async (req, res, next) => {
  try {
    const { requestId } = req.params;

    const request = gdprComplianceService.dataRequests.get(requestId);
    if (!request) {
      throw new NotFoundError('Data request not found');
    }

    res.json({
      success: true,
      data: request
    });
  } catch (error) {
    next(error);
  }
};

export const processDataRequest = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const { action, notes } = req.body; // approve, reject, process

    const request = gdprComplianceService.dataRequests.get(requestId);
    if (!request) {
      throw new NotFoundError('Data request not found');
    }

    // Validate status transition for data request
    const allowedDataRequestTransitions = {
      pending: ['approved', 'rejected', 'processing'],
      approved: ['processing', 'completed'],
      rejected: [],
      processing: ['completed', 'failed'],
      completed: [],
      failed: ['pending']
    };
    const targetStatus = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'processing';
    const allowedTargets = allowedDataRequestTransitions[request.status] || [];
    if (!allowedTargets.includes(targetStatus)) {
      throw new ValidationError(
        `Cannot ${action} request: invalid transition from '${request.status}' to '${targetStatus}'`
      );
    }

    // Process the request based on action
    switch (action) {
      case 'approve':
        request.status = 'approved';
        request.approvedBy = req.user.id;
        request.approvedAt = new Date();
        break;
      case 'reject':
        request.status = 'rejected';
        request.rejectedBy = req.user.id;
        request.rejectedAt = new Date();
        request.rejectionReason = notes;
        break;
      case 'process':
        request.status = 'processing';
        break;
      default:
        throw new ValidationError('Invalid action');
    }

    request.notes = notes;
    request.processedBy = req.user.id;

    logger.info('Data request processed', {
      requestId,
      action,
      processedBy: req.user.id
    });

    res.json({
      success: true,
      data: request
    });
  } catch (error) {
    next(error);
  }
};

export const getBulkConsentStatus = async (req, res, next) => {
  try {
    const { userIds } = req.body;

    if (!Array.isArray(userIds)) {
      throw new ValidationError('userIds must be an array');
    }

    // Query persistent ConsentRecord collection for all users
    const allRecords = await ConsentRecord.find({
      userId: { $in: userIds }
    }).limit(1000).lean();

    // Group records by userId
    const recordsByUser = {};
    for (const record of allRecords) {
      const uid = record.userId.toString();
      if (!recordsByUser[uid]) recordsByUser[uid] = {};
      recordsByUser[uid][record.consentType] = {
        granted: record.granted,
        isActive: record.granted && !record.consentWithdrawnAt && new Date() < record.expiresAt,
        consentGivenAt: record.consentGivenAt,
        expiresAt: record.expiresAt
      };
    }

    const consentStatuses = userIds.map(userId => ({
      userId,
      hasConsent: !!recordsByUser[userId] && Object.values(recordsByUser[userId] || {}).some(c => c.isActive),
      consentTypes: recordsByUser[userId] || {}
    }));

    res.json({
      success: true,
      data: {
        consentStatuses,
        checkedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
};

export default {
  recordConsent,
  updateConsent,
  getConsentHistory,
  requestDataAccess,
  requestDataRectification,
  requestDataErasure,
  requestDataPortability,
  checkProcessingLawfulness,
  getPrivacyNotice,
  getDataProcessingInfo,
  getDataRetentionReport,
  getComplianceReport,
  getAllDataRequests,
  getDataRequestById,
  processDataRequest,
  getBulkConsentStatus
};
