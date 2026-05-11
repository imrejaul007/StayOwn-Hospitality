import mongoose from 'mongoose';
import APIKey from '../models/APIKey.js';
import WebhookEndpoint from '../models/WebhookEndpoint.js';
import APIMetrics from '../models/APIMetrics.js';
import apiMetricsService from '../services/apiMetricsService.js';
import webhookDeliveryService from '../services/webhookDeliveryService.js';
import endpointRegistryService from '../services/endpointRegistryService.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

const MASKED_SECRET = '********';

const sanitizeAPIKeyResponse = (apiKey, options = {}) => {
  if (!apiKey) return apiKey;
  const { includeRawKey = false } = options;
  const keyObj = typeof apiKey.toObject === 'function' ? apiKey.toObject() : { ...apiKey };
  const rawKey = keyObj.keyId;

  delete keyObj.keyHash;

  if (!includeRawKey) {
    delete keyObj.keyId;
  }

  if (includeRawKey && rawKey) {
    keyObj.key = rawKey;
  }

  return keyObj;
};

const sanitizeWebhookResponse = (webhook, options = {}) => {
  if (!webhook) return webhook;
  const { includeSecret = false } = options;
  const webhookObj = typeof webhook.toObject === 'function' ? webhook.toObject() : { ...webhook };

  if (Object.prototype.hasOwnProperty.call(webhookObj, 'secret')) {
    webhookObj.secret = includeSecret ? webhookObj.secret : MASKED_SECRET;
  }

  return webhookObj;
};

const apiManagementController = {
  
  // ===== API KEYS MANAGEMENT =====

  /**
   * Get all API keys for a hotel (optimized)
   */
  getAPIKeys: catchAsync(async (req, res) => {
    const { page: rawPage = '1', limit: rawLimit = '10', status, type, search, includeUsage = 'false' } = req.query;
    const { hotelId } = req.user;

    const parsedPage = Math.max(1, parseInt(rawPage) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(rawLimit) || 10));

    // Set cache headers for 2 minutes
    res.set({
      'Cache-Control': 'public, max-age=120',
      'ETag': `"apikeys-${hotelId}-${Math.floor(Date.now() / 120000)}"`
    });

    const filter = { hotelId };

    if (status === 'active') filter.isActive = true;
    if (status === 'inactive') filter.isActive = false;
    if (type && ['read', 'write', 'admin'].includes(type)) filter.type = type;
    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name: { $regex: escapedSearch, $options: 'i' } },
        { description: { $regex: escapedSearch, $options: 'i' } }
      ];
    }

    const skip = (parsedPage - 1) * parsedLimit;

    const [apiKeys, total] = await Promise.all([
      APIKey.find(filter)
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit)
        .lean(),
      APIKey.countDocuments(filter)
    ]);

    const keysWithUsage = apiKeys.map(key => sanitizeAPIKeyResponse(key));

    res.json({
      success: true,
      data: {
        apiKeys: keysWithUsage,
        pagination: {
          current: parsedPage,
          pages: Math.ceil(total / parsedLimit),
          total,
          limit: parsedLimit
        }
      }
    });
  }),

  /**
   * Get a single API key by ID
   */
  getAPIKeyById: catchAsync(async (req, res) => {
    const { id } = req.params;
    const { hotelId } = req.user;

    const apiKey = await APIKey.findOne({ _id: id, hotelId })
      .populate('createdBy', 'name email')
      .lean();

    if (!apiKey) {
      throw new ApplicationError('API key not found', 404);
    }

    res.json({
      success: true,
      data: sanitizeAPIKeyResponse(apiKey)
    });
  }),

  /**
   * Create new API key
   */
  createAPIKey: catchAsync(async (req, res) => {
    const { name, description, type, permissions, rateLimit, allowedIPs, allowedDomains, expiresAt } = req.body;
    const { hotelId, id: createdBy } = req.user;

    // Generate new API key
    const apiKey = new APIKey({
      name,
      description,
      hotelId,
      createdBy,
      type: type || 'read',
      permissions: permissions || [],
      rateLimit: rateLimit || {},
      allowedIPs: allowedIPs || [],
      allowedDomains: allowedDomains || [],
      expiresAt: expiresAt ? new Date(expiresAt) : null
    });

    await apiKey.save();

    // Return the key only once (for security)
    const response = sanitizeAPIKeyResponse(apiKey, { includeRawKey: true });

    logger.info('API key created', {
      keyId: apiKey.keyId.substring(0, 10) + '...',
      hotelId,
      createdBy,
      type
    });

    res.status(201).json({
      success: true,
      data: response,
      message: 'API key created successfully. Please save this key as it will not be shown again.'
    });
  }),

  /**
   * Update API key
   */
  updateAPIKey: catchAsync(async (req, res) => {
    const { id } = req.params;
    const { hotelId } = req.user;
    const updates = req.body;

    // Remove sensitive fields that shouldn't be updated directly
    delete updates.keyId;
    delete updates.keyHash;
    delete updates.hotelId;
    delete updates.createdBy;

    const apiKey = await APIKey.findOneAndUpdate(
      { _id: id, hotelId },
      updates,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email');

    if (!apiKey) {
      throw new ApplicationError('API key not found', 404);
    }

    logger.info('API key updated', {
      keyId: apiKey.keyId.substring(0, 10) + '...',
      hotelId,
      updates: Object.keys(updates)
    });

    res.json({
      success: true,
      data: sanitizeAPIKeyResponse(apiKey),
      message: 'API key updated successfully'
    });
  }),

  /**
   * Delete API key
   */
  deleteAPIKey: catchAsync(async (req, res) => {
    const { id } = req.params;
    const { hotelId } = req.user;

    const apiKey = await APIKey.findOneAndDelete({ _id: id, hotelId });
    
    if (!apiKey) {
      throw new ApplicationError('API key not found', 404);
    }

    logger.info('API key deleted', {
      keyId: apiKey.keyId.substring(0, 10) + '...',
      hotelId
    });

    res.json({
      success: true,
      message: 'API key deleted successfully'
    });
  }),

  /**
   * Toggle API key status
   */
  toggleAPIKeyStatus: catchAsync(async (req, res) => {
    const { id } = req.params;
    const { hotelId } = req.user;

    // Read current state to determine the toggle direction
    const existing = await APIKey.findOne({ _id: id, hotelId }).lean();

    if (!existing) {
      throw new ApplicationError('API key not found', 404);
    }

    // Atomically toggle using the known current value as a guard
    const apiKey = await APIKey.findOneAndUpdate(
      { _id: id, hotelId, isActive: existing.isActive },
      { $set: { isActive: !existing.isActive } },
      { new: true }
    );

    if (!apiKey) {
      throw new ApplicationError('API key was modified concurrently, please retry', 409);
    }

    logger.info('API key status toggled', {
      keyId: apiKey.keyId.substring(0, 10) + '...',
      hotelId,
      newStatus: apiKey.isActive
    });

    res.json({
      success: true,
      data: sanitizeAPIKeyResponse(apiKey),
      message: `API key ${apiKey.isActive ? 'activated' : 'deactivated'} successfully`
    });
  }),

  // ===== WEBHOOK MANAGEMENT =====

  /**
   * Get all webhook endpoints for a hotel
   */
  getWebhooks: catchAsync(async (req, res) => {
    const { page: rawPage = '1', limit: rawLimit = '10', status, search } = req.query;
    const { hotelId } = req.user;

    const parsedPage = Math.max(1, parseInt(rawPage) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(rawLimit) || 10));

    const filter = { hotelId };

    if (status === 'active') filter.isActive = true;
    if (status === 'inactive') filter.isActive = false;
    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name: { $regex: escapedSearch, $options: 'i' } },
        { url: { $regex: escapedSearch, $options: 'i' } }
      ];
    }

    const skip = (parsedPage - 1) * parsedLimit;

    const [webhooks, total] = await Promise.all([
      WebhookEndpoint.find(filter)
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit),
      WebhookEndpoint.countDocuments(filter)
    ]);

    const sanitizedWebhooks = webhooks.map(webhook => sanitizeWebhookResponse(webhook));

    res.json({
      success: true,
      data: {
        webhooks: sanitizedWebhooks,
        pagination: {
          current: parsedPage,
          pages: Math.ceil(total / parsedLimit),
          total,
          limit: parsedLimit
        }
      }
    });
  }),

  /**
   * Get a single webhook by ID
   */
  getWebhookById: catchAsync(async (req, res) => {
    const { id } = req.params;
    const { hotelId } = req.user;

    const webhook = await WebhookEndpoint.findOne({ _id: id, hotelId })
      .populate('createdBy', 'name email');

    if (!webhook) {
      throw new ApplicationError('Webhook endpoint not found', 404);
    }

    res.json({
      success: true,
      data: sanitizeWebhookResponse(webhook)
    });
  }),

  /**
   * Create new webhook endpoint
   */
  createWebhook: catchAsync(async (req, res) => {
    const { 
      name, 
      description, 
      url, 
      events, 
      httpConfig, 
      retryPolicy, 
      filters 
    } = req.body;
    const { hotelId, id: createdBy } = req.user;

    const webhook = new WebhookEndpoint({
      name,
      description,
      url,
      hotelId,
      createdBy,
      events: events || [],
      httpConfig: httpConfig || {},
      retryPolicy: retryPolicy || {},
      filters: filters || { enabled: false }
    });

    await webhook.save();

    logger.info('Webhook endpoint created', {
      webhookId: webhook._id,
      hotelId,
      url: webhook.url,
      events: webhook.events
    });

    res.status(201).json({
      success: true,
      data: sanitizeWebhookResponse(webhook),
      message: 'Webhook endpoint created successfully'
    });
  }),

  /**
   * Update webhook endpoint
   */
  updateWebhook: catchAsync(async (req, res) => {
    const { id } = req.params;
    const { hotelId } = req.user;
    const updates = req.body;

    // Remove sensitive fields
    delete updates.secret;
    delete updates.hotelId;
    delete updates.createdBy;

    const webhook = await WebhookEndpoint.findOneAndUpdate(
      { _id: id, hotelId },
      updates,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email');

    if (!webhook) {
      throw new ApplicationError('Webhook endpoint not found', 404);
    }

    logger.info('Webhook endpoint updated', {
      webhookId: webhook._id,
      hotelId,
      updates: Object.keys(updates)
    });

    res.json({
      success: true,
      data: sanitizeWebhookResponse(webhook),
      message: 'Webhook endpoint updated successfully'
    });
  }),

  /**
   * Delete webhook endpoint
   */
  deleteWebhook: catchAsync(async (req, res) => {
    const { id } = req.params;
    const { hotelId } = req.user;

    const webhook = await WebhookEndpoint.findOneAndDelete({ _id: id, hotelId });
    
    if (!webhook) {
      throw new ApplicationError('Webhook endpoint not found', 404);
    }

    logger.info('Webhook endpoint deleted', {
      webhookId: webhook._id,
      hotelId,
      url: webhook.url
    });

    res.json({
      success: true,
      message: 'Webhook endpoint deleted successfully'
    });
  }),

  /**
   * Test webhook endpoint
   */
  testWebhook: catchAsync(async (req, res) => {
    const { id } = req.params;
    const { hotelId } = req.user;

    const webhook = await WebhookEndpoint.findOne({ _id: id, hotelId });

    if (!webhook) {
      throw new ApplicationError('Webhook endpoint not found', 404);
    }

    const result = await webhookDeliveryService.testEndpoint(webhook._id);

    res.json({
      success: result.success,
      data: result,
      message: result.success ? 'Test webhook delivered successfully' : 'Test webhook failed'
    });
  }),

  /**
   * Get webhook secret (for regeneration)
   */
  regenerateWebhookSecret: catchAsync(async (req, res) => {
    const { id } = req.params;
    const { hotelId } = req.user;

    const newSecret = WebhookEndpoint.generateSecret();

    // Atomically set the new secret
    const webhook = await WebhookEndpoint.findOneAndUpdate(
      { _id: id, hotelId },
      { $set: { secret: newSecret } },
      { new: true }
    );

    if (!webhook) {
      throw new ApplicationError('Webhook endpoint not found', 404);
    }

    logger.info('Webhook secret regenerated', {
      webhookId: webhook._id,
      hotelId
    });

    // Return the new secret directly since select: false hides it from the returned doc
    res.json({
      success: true,
      data: { secret: newSecret },
      message: 'Webhook secret regenerated successfully'
    });
  }),

  // ===== METRICS AND ANALYTICS =====

  /**
   * Get API metrics dashboard (optimized with complete data)
   */
  getMetrics: catchAsync(async (req, res) => {
    const { timeRange = '24h' } = req.query;
    const { hotelId } = req.user;

    // Set cache headers for 30 seconds
    res.set({
      'Cache-Control': 'public, max-age=30',
      'ETag': `"metrics-${hotelId}-${timeRange}-${Math.floor(Date.now() / 30000)}"`
    });

    // Get comprehensive metrics data
    const [dashboardMetrics, topEndpoints] = await Promise.all([
      apiMetricsService.getDashboardMetrics(hotelId, timeRange),
      APIMetrics.getTopEndpoints(hotelId, timeRange, 10)
    ]);

    // Get real status code distribution from the database
    let statusCodes = {};
    try {
      const statusCodeAgg = await APIMetrics.aggregate([
        {
          $match: {
            hotelId: new mongoose.Types.ObjectId(hotelId),
            timestamp: { $gte: new Date(Date.now() - (timeRange === '7d' ? 7 * 86400000 : timeRange === '30d' ? 30 * 86400000 : 86400000)) }
          }
        },
        {
          $project: {
            statusEntries: { $objectToArray: '$requests.byStatusCode' }
          }
        },
        { $unwind: { path: '$statusEntries', preserveNullAndEmptyArrays: false } },
        {
          $group: {
            _id: '$statusEntries.k',
            count: { $sum: '$statusEntries.v' }
          }
        },
        { $sort: { _id: 1 } }
      ]);
      for (const entry of statusCodeAgg) {
        statusCodes[entry._id] = entry.count;
      }
    } catch (err) {
      logger.warn('Could not aggregate status codes, using fallback:', err.message);
      statusCodes = {
        '200': dashboardMetrics.successfulRequests || 0,
        '400': Math.floor((dashboardMetrics.failedRequests || 0) * 0.5),
        '500': Math.floor((dashboardMetrics.failedRequests || 0) * 0.5)
      };
    }

    // Combine all metrics data
    const completeMetrics = {
      ...dashboardMetrics,
      topEndpoints: topEndpoints || [],
      statusCodes
    };

    res.json({
      success: true,
      data: completeMetrics
    });
  }),

  /**
   * Get all API endpoints catalog (optimized)
   */
  getAllEndpoints: catchAsync(async (req, res) => {
    const { category, search, status, method, includeUsage = 'false' } = req.query;
    const { hotelId } = req.user;

    try {
      // Set cache headers for 5 minutes (endpoints rarely change)
      res.set({
        'Cache-Control': 'public, max-age=300',
        'ETag': `"endpoints-${Math.floor(Date.now() / 300000)}"`
      });

      // Use cached endpoints if available, with deduplication
      let endpoints = endpointRegistryService.getCachedEndpoints();

      if (!endpoints || endpoints.length === 0) {
        await endpointRegistryService.scanRoutes();
      }
      // getAllEndpoints() applies deduplication
      endpoints = endpointRegistryService.getAllEndpoints();

      // Apply filters efficiently
      if (category && category !== 'all') {
        endpoints = endpoints.filter(endpoint => endpoint.category === category);
      }

      if (status && status !== 'all') {
        endpoints = endpoints.filter(endpoint => endpoint.status === status);
      }

      if (method && method !== 'all') {
        endpoints = endpoints.filter(endpoint => endpoint.method === method.toUpperCase());
      }

      if (search) {
        endpoints = endpointRegistryService.searchEndpoints(search);
      }

      // Only add usage statistics if explicitly requested (for performance)
      let endpointsWithUsage = endpoints;
      if (includeUsage === 'true') {
        endpointsWithUsage = await Promise.all(
          endpoints.map(async (endpoint) => {
            try {
              const usage = await APIMetrics.getEndpointUsage(hotelId, endpoint.method, endpoint.path);
              return {
                ...endpoint,
                usage
              };
          
            } catch (error) {
              console.error('Operation failed:', error.message);
              throw error;
            }
          })
        );
      }

      res.json({
        success: true,
        data: endpointsWithUsage,
        meta: {
          total: endpointsWithUsage.length,
          categories: [...new Set(endpoints.map(e => e.category))],
          methods: [...new Set(endpoints.map(e => e.method))]
        }
      });

    } catch (error) {
      logger.error('Error getting endpoints catalog:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get endpoints catalog',
        error: error.message
      });
    }
  }),

  /**
   * Get top API endpoints
   */
  getTopEndpoints: catchAsync(async (req, res) => {
    const { timeRange = '24h', limit = 10 } = req.query;
    const { hotelId } = req.user;

    const endpoints = await apiMetricsService.getTopEndpoints(hotelId, timeRange, parseInt(limit));

    res.json({
      success: true,
      data: endpoints
    });
  }),

  /**
   * Get API metrics by endpoint
   */
  getEndpointMetrics: catchAsync(async (req, res) => {
    const { endpoint } = req.params;
    const { timeRange = '24h', period = 'hour' } = req.query;
    const { hotelId } = req.user;

    const [method, path] = endpoint.split(' ', 2);
    
    let startTime, endTime = new Date();
    
    switch (timeRange) {
      case '1h':
        startTime = new Date(endTime.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startTime = new Date(endTime.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);
    }

    const metrics = await APIMetrics.find({
      hotelId,
      'endpoint.method': method,
      'endpoint.path': path,
      period,
      timestamp: { $gte: startTime, $lte: endTime }
    }).sort({ timestamp: 1 }).lean().limit(1000);

    res.json({
      success: true,
      data: metrics
    });
  }),

  /**
   * Get API key usage statistics
   */
  getAPIKeyUsage: catchAsync(async (req, res) => {
    const { timeRange = '24h' } = req.query;
    const { hotelId } = req.user;

    let startTime;
    const endTime = new Date();

    switch (timeRange) {
      case '24h':
        startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startTime = new Date(endTime.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startTime = new Date(endTime.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);
    }

    const [apiKeys, keyUsageMetrics] = await Promise.all([
      APIKey.find({ hotelId, isActive: true })
        .select('name type usage'),
      
      APIMetrics.aggregate([
        {
          $match: {
            hotelId: new mongoose.Types.ObjectId(hotelId),
            timestamp: { $gte: startTime, $lte: endTime },
            'apiKeyUsage.keyRequests': { $exists: true }
          }
        },
        {
          $project: {
            keyRequests: { $objectToArray: '$apiKeyUsage.keyRequests' }
          }
        },
        {
          $unwind: '$keyRequests'
        },
        {
          $group: {
            _id: '$keyRequests.k',
            totalRequests: { $sum: '$keyRequests.v' }
          }
        },
        {
          $sort: { totalRequests: -1 }
        }
      ])
    ]);

    // Combine API key data with usage metrics
    const keyUsageMap = new Map(keyUsageMetrics.map(k => [k._id, k.totalRequests]));
    
    const apiKeyUsage = apiKeys.map(key => ({
      id: key._id,
      name: key.name,
      type: key.type,
      totalRequests: key.usage.totalRequests || 0,
      periodRequests: keyUsageMap.get(key._id.toString()) || 0,
      lastUsed: key.usage.lastUsed
    }));

    res.json({
      success: true,
      data: {
        apiKeys: apiKeyUsage,
        summary: {
          totalKeys: apiKeys.length,
          activeKeys: apiKeys.filter(k => k.usage.lastUsed && 
            k.usage.lastUsed >= startTime).length
        }
      }
    });
  }),

  /**
   * Get webhook delivery statistics
   */
  getWebhookStats: catchAsync(async (req, res) => {
    const { timeRange = '24h' } = req.query;
    const { hotelId } = req.user;

    const webhooks = await WebhookEndpoint.find({ hotelId })
      .select('name url stats health events').lean().limit(1000);

    // Calculate totals
    const totalStats = webhooks.reduce((acc, webhook) => ({
      totalDeliveries: acc.totalDeliveries + (webhook.stats.totalDeliveries || 0),
      successfulDeliveries: acc.successfulDeliveries + (webhook.stats.successfulDeliveries || 0),
      failedDeliveries: acc.failedDeliveries + (webhook.stats.failedDeliveries || 0)
    }), { totalDeliveries: 0, successfulDeliveries: 0, failedDeliveries: 0 });

    // Get retry queue status
    const retryQueueStatus = webhookDeliveryService.getRetryQueueStatus();

    res.json({
      success: true,
      data: {
        webhooks: webhooks.map(w => ({
          id: w._id,
          name: w.name,
          url: w.url,
          events: w.events,
          stats: w.stats,
          health: w.health
        })),
        summary: {
          ...totalStats,
          successRate: totalStats.totalDeliveries > 0 
            ? ((totalStats.successfulDeliveries / totalStats.totalDeliveries) * 100).toFixed(2)
            : 0,
          retryQueue: retryQueueStatus
        }
      }
    });
  }),

  /**
   * Export API logs
   */
  exportLogs: catchAsync(async (req, res) => {
    const { startDate, endDate, format = 'json', endpoints } = req.query;
    const { hotelId } = req.user;

    // Default to last 30 days if dates not provided
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Validate dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new ApplicationError('Invalid date format for startDate or endDate', 400);
    }

    const filter = {
      hotelId,
      timestamp: {
        $gte: start,
        $lte: end
      }
    };

    if (endpoints) {
      const endpointList = endpoints.split(',');
      filter['endpoint.path'] = { $in: endpointList };
    }

    const logs = await APIMetrics.find(filter)
      .sort({ timestamp: -1 })
      .limit(10000).lean(); // Limit to prevent memory issues

    if (format === 'csv') {
      // Escape CSV values to prevent injection
      const escapeCSV = (val) => {
        const str = String(val ?? '');
        if (str.match(/[,"\n\r]/) || str.match(/^[=+\-@\t\r]/)) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };
      const csvHeader = 'Timestamp,Method,Path,Requests,Errors,Avg Response Time\n';
      const csvData = logs.map(log =>
        [log.timestamp, log.endpoint?.method, log.endpoint?.path, log.requests?.total, log.errors?.total, log.performance?.averageResponseTime]
          .map(escapeCSV).join(',')
      ).join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="api-logs.csv"');
      res.send(csvHeader + csvData);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="api-logs.json"');
      res.json(logs);
    }
  }),

  /**
   * Get API Documentation
   */
  getAPIDocumentation: catchAsync(async (req, res) => {
    const { hotelId } = req.user;

    // Generate comprehensive API documentation
    const documentation = {
      info: {
        title: "THE PENTOUZ Hotel Management API",
        version: "1.0.0",
        description: "Comprehensive API for hotel management operations including bookings, rooms, guests, and administrative functions.",
        contact: {
          name: "API Support",
          email: "api-support@thepentouz.com"
        },
        license: {
          name: "Proprietary",
          url: "https://thepentouz.com/license"
        }
      },
      servers: [
        {
          url: "https://hotel-management-xcsx.onrender.com/api/v1",
          description: "Production Server"
        },
        {
          url: "http://localhost:4000/api/v1",
          description: "Development Server"
        }
      ],
      security: [
        {
          "bearerAuth": []
        },
        {
          "apiKeyAuth": []
        }
      ],
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT"
        },
        apiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "x-api-key"
        }
      },
      endpoints: [
        // Authentication Endpoints
        {
          category: "Authentication",
          endpoints: [
            {
              method: "POST",
              path: "/auth/login",
              summary: "User Authentication",
              description: "Authenticate user and receive JWT token",
              parameters: [],
              requestBody: {
                required: true,
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        email: { type: "string", format: "email", example: "admin@hotel.com" },
                        password: { type: "string", example: "your-secure-password" }
                      },
                      required: ["email", "password"]
                    }
                  }
                }
              },
              responses: {
                200: {
                  description: "Authentication successful",
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          success: { type: "boolean", example: true },
                          token: { type: "string", example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." },
                          user: {
                            type: "object",
                            properties: {
                              id: { type: "string" },
                              name: { type: "string" },
                              email: { type: "string" },
                              role: { type: "string", enum: ["guest", "staff", "admin", "manager"] }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              },
              security: []
            }
          ]
        },
        // Booking Endpoints
        {
          category: "Bookings",
          endpoints: [
            {
              method: "GET",
              path: "/bookings",
              summary: "Get Bookings",
              description: "Retrieve a list of bookings with optional filtering",
              parameters: [
                {
                  name: "page",
                  in: "query",
                  description: "Page number for pagination",
                  required: false,
                  schema: { type: "integer", default: 1 }
                },
                {
                  name: "limit",
                  in: "query",
                  description: "Number of items per page",
                  required: false,
                  schema: { type: "integer", default: 10, maximum: 100 }
                },
                {
                  name: "status",
                  in: "query",
                  description: "Filter by booking status",
                  required: false,
                  schema: { type: "string", enum: ["pending", "confirmed", "cancelled", "completed"] }
                },
                {
                  name: "startDate",
                  in: "query",
                  description: "Filter bookings from this date",
                  required: false,
                  schema: { type: "string", format: "date" }
                }
              ],
              responses: {
                200: {
                  description: "List of bookings retrieved successfully",
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          success: { type: "boolean", example: true },
                          data: {
                            type: "object",
                            properties: {
                              bookings: {
                                type: "array",
                                items: {
                                  type: "object",
                                  properties: {
                                    id: { type: "string" },
                                    guestName: { type: "string" },
                                    checkIn: { type: "string", format: "date" },
                                    checkOut: { type: "string", format: "date" },
                                    roomType: { type: "string" },
                                    status: { type: "string" },
                                    totalAmount: { type: "number" }
                                  }
                                }
                              },
                              pagination: {
                                type: "object",
                                properties: {
                                  current: { type: "integer" },
                                  pages: { type: "integer" },
                                  total: { type: "integer" }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            {
              method: "POST",
              path: "/bookings",
              summary: "Create Booking",
              description: "Create a new hotel booking",
              requestBody: {
                required: true,
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        guestName: { type: "string", example: "John Doe" },
                        guestEmail: { type: "string", format: "email", example: "john@example.com" },
                        guestPhone: { type: "string", example: "+1234567890" },
                        checkIn: { type: "string", format: "date", example: "2024-12-01" },
                        checkOut: { type: "string", format: "date", example: "2024-12-05" },
                        roomType: { type: "string", example: "deluxe" },
                        numberOfGuests: { type: "integer", example: 2 },
                        specialRequests: { type: "string", example: "Late check-in" }
                      },
                      required: ["guestName", "guestEmail", "checkIn", "checkOut", "roomType"]
                    }
                  }
                }
              },
              responses: {
                201: {
                  description: "Booking created successfully"
                }
              }
            }
          ]
        },
        // Room Management Endpoints
        {
          category: "Room Management",
          endpoints: [
            {
              method: "GET",
              path: "/rooms",
              summary: "Get Rooms",
              description: "Retrieve a list of hotel rooms",
              parameters: [
                {
                  name: "status",
                  in: "query",
                  description: "Filter by room status",
                  required: false,
                  schema: { type: "string", enum: ["available", "occupied", "maintenance", "cleaning"] }
                },
                {
                  name: "type",
                  in: "query",
                  description: "Filter by room type",
                  required: false,
                  schema: { type: "string" }
                }
              ],
              responses: {
                200: {
                  description: "List of rooms retrieved successfully"
                }
              }
            },
            {
              method: "PUT",
              path: "/rooms/{id}/status",
              summary: "Update Room Status",
              description: "Update the status of a specific room",
              parameters: [
                {
                  name: "id",
                  in: "path",
                  description: "Room ID",
                  required: true,
                  schema: { type: "string" }
                }
              ],
              requestBody: {
                required: true,
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        status: {
                          type: "string",
                          enum: ["available", "occupied", "maintenance", "cleaning"],
                          example: "maintenance"
                        },
                        notes: { type: "string", example: "AC repair needed" }
                      },
                      required: ["status"]
                    }
                  }
                }
              },
              responses: {
                200: {
                  description: "Room status updated successfully"
                }
              }
            }
          ]
        },
        // Guest Management Endpoints
        {
          category: "Guest Management",
          endpoints: [
            {
              method: "GET",
              path: "/guests",
              summary: "Get Guests",
              description: "Retrieve a list of hotel guests",
              parameters: [
                {
                  name: "search",
                  in: "query",
                  description: "Search guests by name or email",
                  required: false,
                  schema: { type: "string" }
                }
              ],
              responses: {
                200: {
                  description: "List of guests retrieved successfully"
                }
              }
            }
          ]
        },
        // Analytics Endpoints
        {
          category: "Analytics",
          endpoints: [
            {
              method: "GET",
              path: "/analytics/occupancy",
              summary: "Get Occupancy Analytics",
              description: "Retrieve hotel occupancy analytics and trends",
              parameters: [
                {
                  name: "period",
                  in: "query",
                  description: "Time period for analytics",
                  required: false,
                  schema: { type: "string", enum: ["daily", "weekly", "monthly"], default: "monthly" }
                }
              ],
              responses: {
                200: {
                  description: "Occupancy analytics retrieved successfully"
                }
              }
            }
          ]
        },
        // API Management Endpoints
        {
          category: "API Management",
          endpoints: [
            {
              method: "GET",
              path: "/api-management/keys",
              summary: "Get API Keys",
              description: "Retrieve API keys for the hotel",
              responses: {
                200: {
                  description: "API keys retrieved successfully"
                }
              }
            },
            {
              method: "POST",
              path: "/api-management/keys",
              summary: "Create API Key",
              description: "Create a new API key",
              requestBody: {
                required: true,
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        name: { type: "string", example: "Mobile App API Key" },
                        description: { type: "string", example: "API key for mobile application" },
                        type: { type: "string", enum: ["read", "write", "admin"], example: "read" },
                        permissions: {
                          type: "array",
                          items: { type: "string" },
                          example: ["bookings:read", "rooms:read"]
                        }
                      },
                      required: ["name", "description", "type", "permissions"]
                    }
                  }
                }
              },
              responses: {
                201: {
                  description: "API key created successfully"
                }
              }
            }
          ]
        }
      ],
      errorCodes: {
        400: "Bad Request - Invalid request parameters",
        401: "Unauthorized - Authentication required",
        403: "Forbidden - Insufficient permissions",
        404: "Not Found - Resource not found",
        429: "Too Many Requests - Rate limit exceeded",
        500: "Internal Server Error - Server error occurred"
      },
      rateLimit: {
        description: "API requests are rate limited based on API key type",
        limits: {
          read: "100 requests per minute",
          write: "50 requests per minute",
          admin: "200 requests per minute"
        }
      },
      examples: {
        authentication: {
          description: "Basic authentication flow",
          code: `
// Login to get JWT token
const response = await fetch('/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'admin@hotel.com',
    password: '***REDACTED_SEE_ENV***'
  })
});
const { token } = await response.json();

// Use token for authenticated requests
const bookings = await fetch('/api/v1/bookings', {
  headers: { 'Authorization': \`Bearer \${token}\` }
});
          `
        },
        apiKey: {
          description: "Using API key authentication",
          code: `
// Using API key in header
const response = await fetch('/api/v1/bookings', {
  headers: { 'x-api-key': 'rk_test_abcd1234...' }
});

// Using API key in query parameter
const response = await fetch('/api/v1/bookings?api_key=rk_test_abcd1234...');
          `
        }
      }
    };

    res.json({
      success: true,
      data: documentation
    });
  })
};

/**
 * Helper method to get endpoint usage statistics
 */
const getEndpointUsageStats = async (hotelId, method, path) => {
    try {
      // Get metrics for the last 30 days for this endpoint
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const metrics = await APIMetrics.aggregate([
        {
          $match: {
            hotelId: new mongoose.Types.ObjectId(hotelId),
            'endpoint.method': method,
            'endpoint.path': path,
            timestamp: { $gte: thirtyDaysAgo }
          }
        },
        {
          $group: {
            _id: null,
            totalRequests: { $sum: '$requests.total' },
            totalErrors: { $sum: '$errors.total' },
            avgResponseTime: { $avg: '$performance.averageResponseTime' },
            lastUsed: { $max: '$timestamp' }
          }
        }
      ]);

      if (metrics.length === 0) {
        return {
          requests: 0,
          errors: 0,
          avgResponseTime: 0,
          lastUsed: null
        };
      }

      const stats = metrics[0];
      return {
        requests: stats.totalRequests || 0,
        errors: stats.totalErrors || 0,
        avgResponseTime: Math.round(stats.avgResponseTime || 0),
        lastUsed: stats.lastUsed ? stats.lastUsed.toISOString() : null
      };

    } catch (error) {
      logger.error('Error getting endpoint usage stats:', error);
      return {
        requests: 0,
        errors: 0,
        avgResponseTime: 0,
        lastUsed: null
      };
    }
};

export default apiManagementController;
