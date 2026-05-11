import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import path from 'path';
import fs from 'fs';
import { ApplicationError } from '../middleware/errorHandler.js';
import Document from '../models/Document.js';
import DocumentRequirement from '../models/DocumentRequirement.js';
import User from '../models/User.js';
import Department from '../models/Department.js';
import Booking from '../models/Booking.js';

class DocumentController {
  /**
   * Upload a single document
   */
  async uploadDocument(req, res) {
    try {
      const {
        category,
        documentType,
        description,
        userType,
        bookingId,
        departmentId,
        priority = 'medium',
        expiryDate,
        tags
      } = req.body;

      const { _id: userId, hotelId, role } = req.user;

      if (!req.file) {
        throw new ApplicationError('No document uploaded', 400);
      }

      // Validate user type
      const actualUserType = userType || (role === 'staff' ? 'staff' : 'guest');

      // Validate required fields
      if (!category || !documentType) {
        throw new ApplicationError('Category and document type are required', 400);
      }

      // Validate document against requirements
      await this.validateDocumentAgainstRequirements(
        hotelId,
        actualUserType,
        category,
        documentType,
        { departmentId, bookingId }
      );

      // Get client metadata
      const uploadMetadata = this.extractUploadMetadata(req);

      // Create document record
      const documentData = {
        userId,
        userType: actualUserType,
        hotelId,
        filename: req.file.filename,
        originalName: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        filePath: req.file.path,
        category,
        documentType,
        description: description || '',
        priority,
        uploadedBy: userId,
        uploadSource: 'web',
        ...uploadMetadata,
        tags: tags ? tags.split(',').map(tag => tag.trim()) : []
      };

      // Add context-specific fields
      if (actualUserType === 'guest' && bookingId) {
        await this.validateBookingAccess(userId, bookingId);
        documentData.bookingId = bookingId;
      }

      if (actualUserType === 'staff') {
        const validDepartmentId = await this.validateDepartmentAccess(userId, departmentId);
        documentData.departmentId = validDepartmentId;
      }

      if (expiryDate) {
        documentData.expiryDate = new Date(expiryDate);
      }

      const document = new Document(documentData);

      // Add initial audit entry
      await document.addAuditEntry('upload', userId, {
        originalName: req.file.originalname,
        fileSize: req.file.size,
        category,
        documentType
      }, uploadMetadata.ipAddress, uploadMetadata.deviceInfo.userAgent);

      await document.save();

      // Send notifications if required
      await this.sendUploadNotifications(document);

      // Remove sensitive data from response
      const responseDoc = document.toJSON();

      return {
        status: 'success',
        data: {
          document: responseDoc,
          message: 'Document uploaded successfully'
        }
      };
  
    } catch (error) {
      console.error('Operation failed:', error.message);
      throw error;
    }
  }

  /**
   * Upload multiple documents in bulk
   */
  async bulkUploadDocuments(req, res) {
    const { metadata } = req.body;
    const { _id: userId, hotelId, role } = req.user;

    if (!req.files || req.files.length === 0) {
      throw new ApplicationError('No documents uploaded', 400);
    }

    let parsedMetadata = {};
    try {
      parsedMetadata = JSON.parse(metadata || '{}');
    } catch (error) {
      throw new ApplicationError('Invalid metadata format', 400);
    }

    const uploadMetadata = this.extractUploadMetadata(req);
    const uploadedDocuments = [];
    const errors = [];

    // Process each uploaded file
    for (let i = 0; i < req.files.length; i++) {
      try {
        const file = req.files[i];
        const fileMetadata = parsedMetadata[i] || {};

        const documentData = {
          userId,
          userType: role === 'staff' ? 'staff' : 'guest',
          hotelId,
          filename: file.filename,
          originalName: file.originalname,
          fileType: file.mimetype,
          fileSize: file.size,
          filePath: file.path,
          category: fileMetadata.category || 'identity_proof',
          documentType: fileMetadata.documentType || 'General Document',
          description: fileMetadata.description || '',
          priority: fileMetadata.priority || 'medium',
          uploadedBy: userId,
          uploadSource: 'web',
          ...uploadMetadata
        };

        // Add context-specific fields
        if (role === 'staff') {
          const validDepartmentId = await this.validateDepartmentAccess(
            userId,
            fileMetadata.departmentId
          );
          documentData.departmentId = validDepartmentId;
        } else if (fileMetadata.bookingId) {
          await this.validateBookingAccess(userId, fileMetadata.bookingId);
          documentData.bookingId = fileMetadata.bookingId;
        }

        if (fileMetadata.expiryDate) {
          documentData.expiryDate = new Date(fileMetadata.expiryDate);
        }

        const document = new Document(documentData);
        await document.addAuditEntry('upload', userId, {
          originalName: file.originalname,
          bulkUpload: true,
          fileIndex: i
        }, uploadMetadata.ipAddress, uploadMetadata.deviceInfo.userAgent);

        await document.save();
        uploadedDocuments.push(document.toJSON());
      } catch (error) {
        errors.push({
          fileIndex: i,
          filename: req.files[i]?.originalname || `File ${i}`,
          error: error.message
        });
      }
    }

    return {
      status: uploadedDocuments.length > 0 ? 'success' : 'error',
      data: {
        documents: uploadedDocuments,
        errors,
        message: `Successfully uploaded ${uploadedDocuments.length} document(s)${errors.length > 0 ? ` with ${errors.length} error(s)` : ''}`
      }
    };
  }

  /**
   * Get user's documents with filtering
   */
  async getUserDocuments(req, res) {
    try {
      const {
        status,
        category,
        userType,
        page,
        limit = 20,
        skip = 0,
        sortBy = '-createdAt'
      } = req.query;

      const parsedLimit = Math.min(parseInt(limit) || 20, 100);
      const parsedPage = Math.max(parseInt(page) || 1, 1);
      const parsedSkip = page ? (parsedPage - 1) * parsedLimit : (parseInt(skip) || 0);

      const hotelId = req.user.hotelId;

      // Build filter for count query
      const countQuery = {
        userId: req.user._id,
        hotelId,
        isActive: true,
        isDeleted: false
      };
      if (status) countQuery.status = status;
      if (category) countQuery.category = category;
      if (userType) countQuery.userType = userType;

      const [documents, totalCount] = await Promise.all([
        Document.getDocumentsByUser(req.user._id, {
          hotelId,
          status,
          category,
          userType,
          limit: parsedLimit,
          skip: parsedSkip,
          sortBy
        }),
        Document.countDocuments(countQuery)
      ]);

      const totalPages = Math.ceil(totalCount / parsedLimit);

      return {
        status: 'success',
        results: documents.length,
        totalCount,
        totalPages,
        page: parsedPage,
        limit: parsedLimit,
        data: { documents }
      };
  
    } catch (error) {
      console.error('Operation failed:', error.message);
      throw error;
    }
  }

  /**
   * Get specific document details
   */
  async getDocumentById(req, res) {
    try {
      const document = await Document.findById(req.params.id)
        .populate('userId', 'name email role')
        .populate('uploadedBy', 'name email')
        .populate('verificationDetails.verifiedBy', 'name email')
        .populate('departmentId', 'name code')
        .populate('bookingId', 'bookingNumber checkIn checkOut');

      if (!document) {
        throw new ApplicationError('Document not found', 404);
      }

      // Check if user can view this document
      if (!document.canBeViewedBy(req.user, req.user.departmentId)) {
        throw new ApplicationError('You do not have permission to view this document', 403);
      }

      // Log access
      await document.addAuditEntry('view', req.user._id, {
        viewedBy: req.user.name
      }, req.ip, req.get('user-agent'));

      return {
        status: 'success',
        data: { document }
      };
  
    } catch (error) {
      console.error('Operation failed:', error.message);
      throw error;
    }
  }

  /**
   * Download document file
   */
  async downloadDocument(req, res) {
    try {
      const document = await Document.findById(req.params.id).select('+filePath');

      if (!document) {
        throw new ApplicationError('Document not found', 404);
      }

      // Check if user can view this document
      if (!document.canBeViewedBy(req.user, req.user.departmentId)) {
        throw new ApplicationError('You do not have permission to download this document', 403);
      }

      const filePath = document.filePath;

      // Path traversal protection: ensure file is within the uploads directory
      const uploadsBase = path.resolve(process.cwd(), 'uploads');
      const resolvedPath = path.resolve(filePath);
      if (!resolvedPath.startsWith(uploadsBase + path.sep) && resolvedPath !== uploadsBase) {
        throw new ApplicationError('Invalid file path', 400);
      }

      // Check if file exists
      if (!fs.existsSync(resolvedPath)) {
        throw new ApplicationError('Document file not found', 404);
      }

      // Log download
      await document.addAuditEntry('download', req.user._id, {
        downloadedBy: req.user.name
      }, req.ip, req.get('user-agent'));

      // Set appropriate headers
      const ext = path.extname(document.originalName).toLowerCase();
      const contentTypeMap = {
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp'
      };

      return {
        filePath: resolvedPath,
        contentType: contentTypeMap[ext] || 'application/octet-stream',
        originalName: document.originalName
      };

    } catch (error) {
      console.error('Operation failed:', error.message);
      throw error;
    }
  }

  /**
   * Verify a document (Admin only)
   */
  async verifyDocument(req, res) {
    try {
      const { comments, confidenceLevel = 5 } = req.body;

      const document = await Document.findById(req.params.id);
      if (!document) {
        throw new ApplicationError('Document not found', 404);
      }

      if (document.status !== 'pending') {
        throw new ApplicationError('Only pending documents can be verified', 400);
      }

      await document.verify(req.user._id, comments, confidenceLevel);

      // Send verification notification
      await this.sendVerificationNotification(document, 'verified');

      return {
        status: 'success',
        data: {
          document,
          message: 'Document verified successfully'
        }
      };
  
    } catch (error) {
      console.error('Operation failed:', error.message);
      throw error;
    }
  }

  /**
   * Reject a document (Admin only)
   */
  async rejectDocument(req, res) {
    try {
      const { rejectionReason } = req.body;

      if (!rejectionReason) {
        throw new ApplicationError('Rejection reason is required', 400);
      }

      const document = await Document.findById(req.params.id);
      if (!document) {
        throw new ApplicationError('Document not found', 404);
      }

      if (document.status !== 'pending') {
        throw new ApplicationError('Only pending documents can be rejected', 400);
      }

      await document.reject(req.user._id, rejectionReason);

      // Send rejection notification
      await this.sendVerificationNotification(document, 'rejected');

      return {
        status: 'success',
        data: {
          document,
          message: 'Document rejected'
        }
      };
  
    } catch (error) {
      console.error('Operation failed:', error.message);
      throw error;
    }
  }

  /**
   * Update document metadata
   */
  async updateDocument(req, res) {
    try {
      const { description, tags, category, documentType, expiryDate } = req.body;

      const document = await Document.findById(req.params.id);
      if (!document) {
        throw new ApplicationError('Document not found', 404);
      }

      // Users can only update their own documents unless they're admin
      if (req.user.role !== 'admin' && document.userId.toString() !== req.user._id.toString()) {
        throw new ApplicationError('You can only update your own documents', 403);
      }

      // Store original values for audit
      const originalValues = {
        description: document.description,
        tags: document.tags,
        category: document.category,
        documentType: document.documentType,
        expiryDate: document.expiryDate
      };

      // Build atomic $set fields
      const setFields = { updatedBy: req.user._id };
      if (description !== undefined) setFields.description = description;
      if (tags !== undefined) {
        setFields.tags = Array.isArray(tags) ? tags : tags.split(',').map(tag => tag.trim());
      }
      if (category !== undefined && req.user.role === 'admin') setFields.category = category;
      if (documentType !== undefined && req.user.role === 'admin') setFields.documentType = documentType;
      if (expiryDate !== undefined && req.user.role === 'admin') {
        setFields.expiryDate = new Date(expiryDate);
      }

      // Add audit entry before update
      await document.addAuditEntry('update', req.user._id, {
        originalValues,
        newValues: { description, tags, category, documentType, expiryDate }
      }, req.ip, req.get('user-agent'));

      const updatedDocument = await Document.findOneAndUpdate(
        { _id: req.params.id },
        { $set: setFields },
        { new: true, runValidators: true }
      );

      return {
        status: 'success',
        data: {
          document: updatedDocument,
          message: 'Document updated successfully'
        }
      };
  
    } catch (error) {
      console.error('Operation failed:', error.message);
      throw error;
    }
  }

  /**
   * Delete a document (soft delete)
   */
  async deleteDocument(req, res) {
    try {
      // Build a query that checks ownership for non-admins
      const query = { _id: req.params.id };
      if (req.user.role !== 'admin') {
        query.userId = req.user._id;
      }

      // Atomically soft-delete the document
      const document = await Document.findOneAndUpdate(
        query,
        {
          $set: {
            isDeleted: true,
            deletedAt: new Date(),
            deletedBy: req.user._id,
            isActive: false
          },
          $push: {
            auditLog: {
              action: 'delete',
              performedBy: req.user._id,
              details: { deletedBy: req.user.name },
              ipAddress: req.ip,
              userAgent: req.get('user-agent'),
              performedAt: new Date()
            }
          }
        },
        { new: true }
      );

      if (!document) {
        // Distinguish between not found and permission denied
        const existing = await Document.findById(req.params.id).lean();
        if (!existing) {
          throw new ApplicationError('Document not found', 404);
        }
        throw new ApplicationError('You can only delete your own documents', 403);
      }

      return {
        status: 'success',
        message: 'Document deleted successfully'
      };
  
    } catch (error) {
      console.error('Operation failed:', error.message);
      throw error;
    }
  }

  /**
   * Get staff member's documents (Admin only)
   */
  async getStaffDocuments(req, res) {
    try {
      const { staffId } = req.params;
      const { status, category, page, limit = 20, skip = 0 } = req.query;

      // Verify the user is actually a staff member
      const staffUser = await User.findById(staffId).lean();
      if (!staffUser || staffUser.role !== 'staff') {
        throw new ApplicationError('Staff member not found', 404);
      }

      const parsedLimit = Math.min(parseInt(limit) || 20, 100);
      const parsedPage = Math.max(parseInt(page) || 1, 1);
      const parsedSkip = page ? (parsedPage - 1) * parsedLimit : (parseInt(skip) || 0);

      const countQuery = { userId: staffId, userType: 'staff', isActive: true, isDeleted: false };
      if (status) countQuery.status = status;
      if (category) countQuery.category = category;

      const [documents, totalCount] = await Promise.all([
        Document.getDocumentsByUser(staffId, {
          userType: 'staff',
          status,
          category,
          limit: parsedLimit,
          skip: parsedSkip
        }),
        Document.countDocuments(countQuery)
      ]);

      return {
        status: 'success',
        results: documents.length,
        totalCount,
        totalPages: Math.ceil(totalCount / parsedLimit),
        page: parsedPage,
        limit: parsedLimit,
        data: {
          documents,
          staffMember: {
            _id: staffUser._id,
            name: staffUser.name,
            email: staffUser.email,
            departmentId: staffUser.departmentId
          }
        }
      };
  
    } catch (error) {
      console.error('Operation failed:', error.message);
      throw error;
    }
  }

  /**
   * Get guest's documents (Admin only)
   */
  async getGuestDocuments(req, res) {
    try {
      const { guestId } = req.params;
      const { status, category, bookingId, limit = 50, skip = 0 } = req.query;

      // Verify the user exists
      const guestUser = await User.findById(guestId).lean();
      if (!guestUser) {
        throw new ApplicationError('Guest not found', 404);
      }

      let query = {
        userType: 'guest',
        status,
        category,
        limit: parseInt(limit),
        skip: parseInt(skip)
      };

      if (bookingId) {
        query.bookingId = bookingId;
      }

      const documents = await Document.getDocumentsByUser(guestId, query);

      return {
        status: 'success',
        results: documents.length,
        data: {
          documents,
          guest: {
            _id: guestUser._id,
            name: guestUser.name,
            email: guestUser.email
          }
        }
      };
  
    } catch (error) {
      console.error('Operation failed:', error.message);
      throw error;
    }
  }

  /**
   * Get pending document verifications (Admin only)
   */
  async getPendingVerifications(req, res) {
    try {
      const {
        userType,
        departmentId,
        priority,
        page,
        limit = 20,
        skip = 0
      } = req.query;

      const parsedLimit = Math.min(parseInt(limit) || 20, 100);
      const parsedPage = Math.max(parseInt(page) || 1, 1);
      const parsedSkip = page ? (parsedPage - 1) * parsedLimit : (parseInt(skip) || 0);

      const countQuery = { hotelId: req.user.hotelId, status: 'pending', isActive: true, isDeleted: false };
      if (userType) countQuery.userType = userType;
      if (departmentId) countQuery.departmentId = departmentId;
      if (priority) countQuery.priority = priority;

      const [documents, totalCount] = await Promise.all([
        Document.getPendingVerifications(req.user.hotelId, {
          userType,
          departmentId,
          priority,
          limit: parsedLimit,
          skip: parsedSkip
        }),
        Document.countDocuments(countQuery)
      ]);

      return {
        status: 'success',
        results: documents.length,
        totalCount,
        totalPages: Math.ceil(totalCount / parsedLimit),
        page: parsedPage,
        limit: parsedLimit,
        data: { documents }
      };
  
    } catch (error) {
      console.error('Operation failed:', error.message);
      throw error;
    }
  }

  /**
   * Get document requirements for user type
   */
  async getDocumentRequirements(req, res) {
    try {
      const { userType } = req.params;
      const { departmentId, bookingType, mandatory } = req.query;

      if (!['guest', 'staff'].includes(userType)) {
        throw new ApplicationError('Invalid user type. Must be guest or staff', 400);
      }

      const additionalContext = {
        departmentId,
        bookingType,
        employmentType: req.query.employmentType,
        jobRole: req.query.jobRole
      };

      let requirements = await DocumentRequirement.getRequirementsForUser(
        req.user.hotelId,
        userType,
        additionalContext
      );

      // Filter applicable requirements (use distinct variable name to avoid shadowing Express req)
      const currentUser = req.user;
      requirements = requirements.filter(requirement => requirement.isApplicableForUser(
        { role: userType, departmentId, ...currentUser },
        additionalContext
      ));

      // Filter by mandatory if requested
      if (mandatory === 'true') {
        requirements = requirements.filter(requirement => requirement.isMandatory);
      }

      return {
        status: 'success',
        results: requirements.length,
        data: { requirements }
      };
  
    } catch (error) {
      console.error('Operation failed:', error.message);
      throw error;
    }
  }

  /**
   * Get document compliance analytics (Admin only)
   */
  async getComplianceAnalytics(req, res) {
    try {
      const {
        userType,
        departmentId,
        startDate,
        endDate
      } = req.query;

      const stats = await Document.getComplianceStats(req.user.hotelId, {
        userType,
        departmentId,
        startDate,
        endDate
      });

      // Get expiring documents
      const expiringDocuments = await Document.getExpiringDocuments(req.user.hotelId, 30);

      // Get department-wise statistics if no specific department requested (single aggregation, no N+1)
      let departmentStats = [];
      if (!departmentId && userType === 'staff') {
        const departments = await Department.find({ hotelId: req.user.hotelId, status: 'active' }).lean().limit(100);

        if (departments.length > 0) {
          const deptIds = departments.map(d => d._id);
          const matchStage = {
            hotelId: req.user.hotelId,
            userType: 'staff',
            departmentId: { $in: deptIds },
            isActive: true,
            isDeleted: false
          };
          if (startDate && endDate) {
            matchStage.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
          }

          const allDeptStats = await Document.aggregate([
            { $match: matchStage },
            {
              $group: {
                _id: '$departmentId',
                totalDocuments: { $sum: 1 },
                verifiedDocuments: { $sum: { $cond: [{ $eq: ['$status', 'verified'] }, 1, 0] } },
                pendingDocuments: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
                rejectedDocuments: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
                expiredDocuments: { $sum: { $cond: [{ $eq: ['$status', 'expired'] }, 1, 0] } }
              }
            }
          ]);

          const deptStatsMap = allDeptStats.reduce((acc, s) => {
            acc[s._id.toString()] = s;
            return acc;
          }, {});

          departmentStats = departments.map(dept => ({
            department: dept,
            stats: deptStatsMap[dept._id.toString()] || {}
          }));
        }
      }

      return {
        status: 'success',
        data: {
          complianceStats: stats[0] || {},
          expiringDocuments,
          departmentStats,
          summary: {
            totalExpiring: expiringDocuments.length,
            analysisPeriod: {
              startDate,
              endDate,
              userType,
              departmentId
            }
          }
        }
      };
  
    } catch (error) {
      console.error('Operation failed:', error.message);
      throw error;
    }
  }

  // Helper methods

  /**
   * Extract upload metadata from request
   */
  extractUploadMetadata(req) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const deviceInfo = {
      userAgent: req.get('user-agent'),
      platform: req.get('sec-ch-ua-platform'),
      browser: req.get('sec-ch-ua')
    };

    return { ipAddress, deviceInfo };
  }

  /**
   * Validate document against requirements
   */
  async validateDocumentAgainstRequirements(hotelId, userType, category, documentType, context) {
    try {
      const requirements = await DocumentRequirement.find({
        hotelId,
        userType,
        category,
        isActive: true
      }).lean().limit(100);

      for (const requirement of requirements) {
        if (requirement.documentType === documentType ||
            requirement.alternativeTypes.includes(documentType)) {
          // Document matches requirement - could add additional validation here
          return true;
        }
      }

      // If no specific requirement found, allow upload but log it
      console.log(`No specific requirement found for ${userType} document: ${category}/${documentType}`);
      return true;
  
    } catch (error) {
      console.error('Operation failed:', error.message);
      throw error;
    }
  }

  /**
   * Validate booking access for guest documents
   */
  async validateBookingAccess(userId, bookingId) {
    try {
      const booking = await Booking.findById(bookingId).lean();
      if (!booking) {
        throw new ApplicationError('Booking not found', 404);
      }

      if (booking.userId.toString() !== userId.toString()) {
        throw new ApplicationError('You can only upload documents for your own bookings', 403);
      }

      return booking;
  
    } catch (error) {
      console.error('Operation failed:', error.message);
      throw error;
    }
  }

  /**
   * Validate department access for staff documents
   */
  async validateDepartmentAccess(userId, providedDepartmentId) {
    try {
      const user = await User.findById(userId).lean();

      // Use provided department ID or user's default department
      const departmentId = providedDepartmentId || user.departmentId;

      if (!departmentId) {
        throw new ApplicationError('Department ID is required for staff documents', 400);
      }

      // Verify department exists
      const department = await Department.findById(departmentId).lean();
      if (!department) {
        throw new ApplicationError('Department not found', 404);
      }

      // If a different department is provided, verify user has access
      if (providedDepartmentId && providedDepartmentId !== user.departmentId?.toString()) {
        if (user.role !== 'admin') {
          throw new ApplicationError('You can only upload documents to your own department', 403);
        }
      }

      return departmentId;
  
    } catch (error) {
      console.error('Operation failed:', error.message);
      throw error;
    }
  }

  /**
   * Send upload notifications
   */
  async sendUploadNotifications(document) {
    // Implementation would depend on notification system
    // This could send emails, push notifications, etc.
    console.log(`Document uploaded notification for document ${document._id}`);
  }

  /**
   * Send verification notifications
   */
  async sendVerificationNotification(document, action) {
    // Implementation would depend on notification system
    console.log(`Document ${action} notification for document ${document._id}`);
  }
}

export default new DocumentController();