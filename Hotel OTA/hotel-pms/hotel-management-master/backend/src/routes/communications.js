import express from 'express';
import mongoose from 'mongoose';
import Joi from 'joi';
import Communication from '../models/Communication.js';
import MessageTemplate from '../models/MessageTemplate.js';
import User from '../models/User.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import { validate } from '../middleware/validation.js';
import logger from '../utils/logger.js';

const router = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();

// URL validation helper to prevent open redirect attacks
function isAllowedRedirectUrl(url) {
  if (!url) return false;
  // Allow relative URLs
  if (url.startsWith('/')) return true;
  try {
    const parsed = new URL(url);
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:5173')
      .split(',').map(o => { try { return new URL(o.trim()).hostname; } catch { return ''; } });
    return allowedOrigins.includes(parsed.hostname);
  } catch { return false; }
}

// All routes require authentication and property access
router.use(authenticate);
router.use(ensureTenantContext);
router.use(ensurePropertyAccess);
router.use(authorizePolicy('communications', 'baseAccess'));

/**
 * @swagger
 * /communications:
 *   post:
 *     summary: Create and send a communication
 *     tags: [Communications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - recipients
 *               - subject
 *               - content
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [email, sms, push, in_app, whatsapp]
 *               category:
 *                 type: string
 *                 enum: [transactional, marketing, operational, emergency, promotional]
 *               priority:
 *                 type: string
 *                 enum: [low, normal, high, urgent]
 *               recipients:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                     email:
 *                       type: string
 *                     phone:
 *                       type: string
 *                     name:
 *                       type: string
 *               subject:
 *                 type: string
 *               content:
 *                 type: string
 *               htmlContent:
 *                 type: string
 *               templateId:
 *                 type: string
 *               templateVariables:
 *                 type: object
 *               scheduledAt:
 *                 type: string
 *                 format: date-time
 *               attachments:
 *                 type: array
 *     responses:
 *       201:
 *         description: Communication created and sent successfully
 */
router.post('/', authorize('staff', 'admin'), validate(mutationBaselineSchema), catchAsync(async (req, res) => {
  const {
    type,
    category,
    priority,
    recipients,
    subject,
    content,
    htmlContent,
    templateId,
    templateVariables,
    scheduledAt,
    attachments,
    segmentation,
    abTest
  } = req.body;

  const hotelId = req.user.role === 'staff' ? req.user.hotelId : req.body.hotelId;

  if (req.user.role === 'admin' && !req.body.hotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  let finalSubject = subject;
  let finalContent = content;
  let finalHtmlContent = htmlContent;

  // If using a template, render it with variables
  if (templateId) {
    const template = await MessageTemplate.findById(templateId).lean();
    if (!template) {
      throw new ApplicationError('Template not found', 404);
    }
    
    if (template.hotelId.toString() !== hotelId.toString()) {
      throw new ApplicationError('Template not found for this hotel', 404);
    }

    const rendered = template.render(templateVariables || {});
    finalSubject = rendered.subject;
    finalContent = rendered.content;
    finalHtmlContent = rendered.htmlContent;
    
    // Increment template usage
    await template.incrementUsage();
  }

  // Batch: fetch all users referenced by recipients in a single query
  const recipientUserIds = recipients.filter(r => r.userId).map(r => r.userId);
  const recipientUsers = recipientUserIds.length > 0
    ? await User.find({ _id: { $in: recipientUserIds } }).select('name email phone').lean()
    : [];
  const recipientUserMap = new Map(recipientUsers.map(u => [u._id.toString(), u]));

  const processedRecipients = recipients.map((recipient) => {
    const recipientData = {
      ...recipient,
      status: 'pending',
      personalData: new Map()
    };

    if (recipient.userId) {
      const user = recipientUserMap.get(recipient.userId.toString());
      if (user) {
        recipientData.name = recipientData.name || user.name;
        recipientData.email = recipientData.email || user.email;
        recipientData.phone = recipientData.phone || user.phone;

        recipientData.personalData.set('firstName', user.name ? user.name.split(' ')[0] : '');
        recipientData.personalData.set('fullName', user.name || '');
      }
    }

    return recipientData;
  });

  const communicationData = {
    hotelId,
    type,
    category: category || 'transactional',
    priority: priority || 'normal',
    recipients: processedRecipients,
    subject: finalSubject,
    content: finalContent,
    htmlContent: finalHtmlContent,
    sentBy: req.user._id,
    attachments: attachments || [],
    segmentation,
    abTest
  };

  if (templateId) {
    communicationData.template = {
      id: templateId,
      variables: templateVariables ? new Map(Object.entries(templateVariables)) : new Map()
    };
  }

  const communication = await Communication.create(communicationData);

  // If scheduled, don't send immediately
  if (scheduledAt) {
    await communication.schedule(scheduledAt);
  } else {
    // Send immediately (in a real implementation, this would trigger actual sending)
    communication.status = 'sending';
    await communication.save();
    
    // Simulate sending process
    // In production, this would integrate with email/SMS services
    setTimeout(async () => {
      try {
        // Mark all recipients as sent
        for (let i = 0; i < communication.recipients.length; i++) {
          await communication.markAsSent(i, { messageId: `sim_${Date.now()}_${i}` });
        }
      } catch (error) {
        logger.error('Error in simulated sending', { error: error.message });
      }
    }, 1000);
  }

  await communication.populate([
    { path: 'hotelId', select: 'name' },
    { path: 'sentBy', select: 'name' },
    { path: 'template.id', select: 'name' }
  ]);

  res.status(201).json({
    status: 'success',
    data: { communication }
  });
}));

/**
 * @swagger
 * /communications:
 *   get:
 *     summary: Get communications
 *     tags: [Communications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: List of communications
 */
router.get('/', catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    type,
    category,
    status,
    sentBy,
    startDate,
    endDate
  } = req.query;

  const query = {};

  // Role-based filtering
  if (req.user.role === 'staff') {
    query.hotelId = req.user.hotelId;
    // Staff can only see their own communications unless they're managers
    if (req.user.role !== 'manager') {
      query.sentBy = req.user._id;
    }
  } else if (req.user.role === 'admin' && req.query.hotelId) {
    query.hotelId = req.query.hotelId;
  } else if (req.user.role === 'guest') {
    // Guests can only see communications sent to them
    query['recipients.userId'] = req.user._id;
  }

  // Apply filters
  if (type) query.type = type;
  if (category) query.category = category;
  if (status) query.status = status;
  if (sentBy && ['admin', 'manager'].includes(req.user.role)) {
    query.sentBy = sentBy;
  }

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const skip = (page - 1) * limit;
  
  const [communications, total] = await Promise.all([
    Communication.find(query)
      .populate('hotelId', 'name')
      .populate('sentBy', 'name')
      .populate('template.id', 'name')
      .sort('-createdAt')
      .skip(skip)
      .limit(parseInt(limit)),
    Communication.countDocuments(query)
  ]);

  res.json({
    status: 'success',
    data: {
      communications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
}));

/**
 * @swagger
 * /communications/{id}:
 *   get:
 *     summary: Get specific communication
 *     tags: [Communications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Communication details
 */
router.get('/:id', catchAsync(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ApplicationError('Communication not found', 404);
  }
  const communication = await Communication.findById(req.params.id)
    .populate('hotelId', 'name address contact')
    .populate('sentBy', 'name email')
    .populate('template.id', 'name description')
    .populate('recipients.userId', 'name email').lean();

  if (!communication) {
    throw new ApplicationError('Communication not found', 404);
  }

  // Check access permissions
  if (req.user.role === 'guest') {
    const isRecipient = communication.recipients.some(r => 
      r.userId && r.userId._id.toString() === req.user._id.toString()
    );
    if (!isRecipient) {
      throw new ApplicationError('You can only view communications sent to you', 403);
    }
  } else if (req.user.role === 'staff') {
    if (communication.hotelId._id.toString() !== req.user.hotelId.toString()) {
      throw new ApplicationError('You can only view communications for your hotel', 403);
    }
    if (req.user.role !== 'manager' && communication.sentBy._id.toString() !== req.user._id.toString()) {
      throw new ApplicationError('You can only view your own communications', 403);
    }
  }

  res.json({
    status: 'success',
    data: { communication }
  });
}));

/**
 * @swagger
 * /communications/{id}/cancel:
 *   post:
 *     summary: Cancel scheduled communication
 *     tags: [Communications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Communication cancelled successfully
 */
router.post('/:id/cancel', authorize('staff', 'admin'), validate(mutationBaselineSchema), catchAsync(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ApplicationError('Communication not found', 404);
  }
  const communication = await Communication.findById(req.params.id).lean();

  if (!communication) {
    throw new ApplicationError('Communication not found', 404);
  }

  // Check access permissions
  if (req.user.role === 'staff') {
    if (communication.hotelId.toString() !== req.user.hotelId.toString()) {
      throw new ApplicationError('You can only cancel communications for your hotel', 403);
    }
    if (req.user.role !== 'manager' && communication.sentBy.toString() !== req.user._id.toString()) {
      throw new ApplicationError('You can only cancel your own communications', 403);
    }
  }

  await communication.cancel();

  res.json({
    status: 'success',
    message: 'Communication cancelled successfully',
    data: { communication }
  });
}));

/**
 * @swagger
 * /communications/{id}/track/open:
 *   post:
 *     summary: Track communication open
 *     tags: [Communications]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: trackingId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Open tracked successfully
 */
router.post('/:id/track/open', validate(mutationBaselineSchema), catchAsync(async (req, res) => {
  const { trackingId } = req.query;

  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(404).json({ error: 'Communication not found' });
  }
  const communication = await Communication.findById(req.params.id).lean();

  if (!communication) {
    return res.status(404).json({ error: 'Communication not found' });
  }

  // Find recipient by tracking ID
  const recipientIndex = communication.recipients.findIndex(r => r.trackingId === trackingId);
  
  if (recipientIndex !== -1) {
    await communication.markAsRead(recipientIndex);
  }

  // Return a 1x1 pixel image for email tracking
  const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  res.set({
    'Content-Type': 'image/gif',
    'Content-Length': pixel.length,
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  res.send(pixel);
}));

/**
 * @swagger
 * /communications/{id}/track/click:
 *   post:
 *     summary: Track communication click
 *     tags: [Communications]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: trackingId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: url
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       302:
 *         description: Redirect to original URL
 */
router.get('/:id/track/click', catchAsync(async (req, res) => {
  const { trackingId, url } = req.query;

  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.redirect(isAllowedRedirectUrl(url) ? url : '/');
  }
  const communication = await Communication.findById(req.params.id).lean();

  if (!communication) {
    return res.redirect(isAllowedRedirectUrl(url) ? url : '/');
  }

  // Find recipient by tracking ID
  const recipientIndex = communication.recipients.findIndex(r => r.trackingId === trackingId);

  if (recipientIndex !== -1) {
    await communication.trackClick(recipientIndex);
  }

  // Redirect to the original URL (validated to prevent open redirect)
  res.redirect(isAllowedRedirectUrl(url) ? url : '/');
}));

/**
 * @swagger
 * /communications/stats:
 *   get:
 *     summary: Get communication statistics
 *     tags: [Communications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: hotelId
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Communication statistics
 */
router.get('/stats', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;
  
  const hotelId = req.user.role === 'staff' ? req.user.hotelId : req.query.hotelId;
  
  if (!hotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  const [communicationStats, scheduledMessages] = await Promise.all([
    Communication.getCommunicationStats(hotelId, startDate, endDate),
    Communication.getScheduledMessages(hotelId)
  ]);

  // Get overall summary
  const matchQuery = {
    hotelId: new mongoose.Types.ObjectId(hotelId),
    ...(startDate && endDate ? {
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    } : {})
  };

  const overallStats = await Communication.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalCommunications: { $sum: 1 },
        totalRecipients: { $sum: { $size: '$recipients' } },
        avgOpenRate: { $avg: '$tracking.openRate' },
        avgClickRate: { $avg: '$tracking.clickRate' },
        totalOpens: { $sum: '$tracking.opens' },
        totalClicks: { $sum: '$tracking.clicks' },
        sentCount: {
          $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] }
        },
        scheduledCount: {
          $sum: { $cond: [{ $eq: ['$status', 'scheduled'] }, 1, 0] }
        },
        failedCount: {
          $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
        }
      }
    }
  ]);

  res.json({
    status: 'success',
    data: {
      overall: overallStats[0] || {},
      byType: communicationStats,
      scheduled: {
        count: scheduledMessages.length,
        messages: scheduledMessages.slice(0, 10)
      }
    }
  });
}));

/**
 * @swagger
 * /communications/bulk:
 *   post:
 *     summary: Send bulk communication to multiple recipients
 *     tags: [Communications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - subject
 *               - content
 *               - segmentation
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [email, sms, push, in_app]
 *               subject:
 *                 type: string
 *               content:
 *                 type: string
 *               templateId:
 *                 type: string
 *               segmentation:
 *                 type: object
 *                 properties:
 *                   guestTypes:
 *                     type: array
 *                     items:
 *                       type: string
 *                   loyaltyTiers:
 *                     type: array
 *                     items:
 *                       type: string
 *                   tags:
 *                     type: array
 *                     items:
 *                       type: string
 *               scheduledAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Bulk communication created successfully
 */
router.post('/bulk', authorize('staff', 'admin'), validate(mutationBaselineSchema), catchAsync(async (req, res) => {
  const {
    type,
    subject,
    content,
    htmlContent,
    templateId,
    templateVariables,
    segmentation,
    scheduledAt
  } = req.body;

  const hotelId = req.user.role === 'staff' ? req.user.hotelId : req.body.hotelId;

  // Build query for recipient segmentation
  const recipientQuery = { hotelId };
  
  if (segmentation.guestTypes && segmentation.guestTypes.length > 0) {
    recipientQuery.role = { $in: segmentation.guestTypes };
  }
  
  if (segmentation.loyaltyTiers && segmentation.loyaltyTiers.length > 0) {
    recipientQuery['loyalty.tier'] = { $in: segmentation.loyaltyTiers };
  }

  // Find matching recipients
  const recipients = await User.find(recipientQuery)
    .select('name email phone')
    .limit(1000).lean(); // Limit to prevent abuse

  if (recipients.length === 0) {
    throw new ApplicationError('No recipients found matching segmentation criteria', 400);
  }

  // Convert to recipient format
  const processedRecipients = recipients.map(user => ({
    userId: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    status: 'pending'
  }));

  // Create bulk communication
  const communication = new Communication({
    hotelId,
    type,
    category: 'marketing',
    priority: 'normal',
    recipients: processedRecipients,
    subject,
    content,
    htmlContent,
    sentBy: req.user._id,
    segmentation: {
      criteria: new Map(Object.entries(segmentation)),
      tags: segmentation.tags || [],
      guestTypes: segmentation.guestTypes || [],
      loyaltyTiers: segmentation.loyaltyTiers || []
    }
  });

  if (templateId) {
    const template = await MessageTemplate.findById(templateId).lean();
    if (template) {
      const rendered = template.render(templateVariables || {});
      communication.subject = rendered.subject;
      communication.content = rendered.content;
      communication.htmlContent = rendered.htmlContent;
      
      communication.template = {
        id: templateId,
        name: template.name,
        variables: templateVariables ? new Map(Object.entries(templateVariables)) : new Map()
      };
      
      await template.incrementUsage();
    }
  }

  await communication.save();

  if (scheduledAt) {
    await communication.schedule(scheduledAt);
  } else {
    // Process sending in background
    communication.status = 'sending';
    await communication.save();
  }

  res.status(201).json({
    status: 'success',
    data: {
      communication,
      recipientCount: recipients.length
    }
  });
}));

export default router;