import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import EmailCampaign from '../models/EmailCampaign.js';
import { enhancedEmailService } from '../services/enhancedEmailService.js';
import User from '../models/User.js';
import { AppError } from '../utils/appError.js';
import { catchAsync } from '../utils/catchAsync.js';
import cron from 'node-cron';
import mongoose from 'mongoose';

const scheduledJobs = new Map();
let schedulerShuttingDown = false;
let reinitializeTimeout = null;
let hasScheduledReinitialize = false;

const createCampaign = catchAsync(async (req, res, next) => {
  const {
    name,
    subject,
    content,
    htmlContent,
    segmentCriteria,
    scheduledAt,
    template,
    personalization
  } = req.body;

  const campaign = new EmailCampaign({
    name,
    subject,
    content,
    htmlContent,
    segmentCriteria: segmentCriteria || {},
    scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    template,
    personalization: personalization || {},
    hotelId: req.user.hotelId,
    createdBy: req.user.id,
    status: scheduledAt ? 'scheduled' : 'draft'
  });

  await campaign.save();

  if (scheduledAt && new Date(scheduledAt) > new Date()) {
    await scheduleEmailCampaign(campaign);
  }

  res.status(201).json({
    success: true,
    message: 'Email campaign created successfully',
    data: { campaign }
  });
});

const getCampaigns = catchAsync(async (req, res, next) => {
  const { page = 1, limit = 10, status, search } = req.query;
  const filter = { hotelId: req.user.hotelId };

  if (status) filter.status = status;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { subject: { $regex: search, $options: 'i' } }
    ];
  }

  const campaigns = await EmailCampaign.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .populate('createdBy', 'name email').lean();

  const total = await EmailCampaign.countDocuments(filter);

  res.status(200).json({
    success: true,
    data: {
      campaigns,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalCampaigns: total,
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    }
  });
});

const getCampaign = catchAsync(async (req, res, next) => {
  const campaign = await EmailCampaign.findOne({
    _id: req.params.id,
    hotelId: req.user.hotelId
  }).populate('createdBy', 'name email').lean();

  if (!campaign) {
    return next(new AppError('Campaign not found', 404));
  }

  res.status(200).json({
    success: true,
    data: { campaign }
  });
});

const updateCampaign = catchAsync(async (req, res, next) => {
  const { scheduledAt, ...updateData } = req.body;

  // Check current state first
  const existing = await EmailCampaign.findOne({
    _id: req.params.id,
    hotelId: req.user.hotelId
  }).lean();

  if (!existing) {
    return next(new AppError('Campaign not found', 404));
  }

  if (existing.status === 'sent') {
    return next(new AppError('Cannot update a campaign that has already been sent', 400));
  }

  // Validate campaign status transition when scheduling
  if (scheduledAt) {
    const allowedCampaignTransitions = {
      draft: ['scheduled', 'sending'],
      scheduled: ['draft', 'sending'],
      sending: ['sent', 'failed'],
      sent: [],
      failed: ['draft', 'scheduled']
    };
    const allowedTargets = allowedCampaignTransitions[existing.status] || [];
    if (!allowedTargets.includes('scheduled')) {
      return next(new AppError(
        `Cannot schedule campaign: invalid transition from '${existing.status}' to 'scheduled'`,
        400
      ));
    }
  }

  if (scheduledAt && existing.scheduledAt && scheduledJobs.has(existing._id.toString())) {
    const existingJob = scheduledJobs.get(existing._id.toString());
    existingJob.destroy();
    scheduledJobs.delete(existing._id.toString());
  }

  // Build atomic $set fields
  const setFields = { ...updateData };
  if (scheduledAt) {
    setFields.scheduledAt = new Date(scheduledAt);
    setFields.status = 'scheduled';
  }

  const campaign = await EmailCampaign.findOneAndUpdate(
    { _id: req.params.id, hotelId: req.user.hotelId, status: { $ne: 'sent' } },
    { $set: setFields },
    { new: true, runValidators: true }
  );

  if (!campaign) {
    return next(new AppError('Campaign not found or already sent', 404));
  }

  if (scheduledAt) {
    await scheduleEmailCampaign(campaign);
  }

  res.status(200).json({
    success: true,
    message: 'Campaign updated successfully',
    data: { campaign }
  });
});

const sendCampaign = catchAsync(async (req, res, next) => {
  // Atomically set status to 'sending' only if not already sent
  const campaign = await EmailCampaign.findOneAndUpdate(
    {
      _id: req.params.id,
      hotelId: req.user.hotelId,
      status: { $ne: 'sent' }
    },
    { $set: { status: 'sending', sentAt: new Date() } },
    { new: true }
  );

  if (!campaign) {
    // Check if it exists at all or was already sent
    const existing = await EmailCampaign.findOne({
      _id: req.params.id,
      hotelId: req.user.hotelId
    }).lean();

    if (!existing) {
      return next(new AppError('Campaign not found', 404));
    }
    return next(new AppError('Campaign has already been sent', 400));
  }

  try {
    const result = await enhancedEmailService.sendCampaign(campaign._id.toString());

    const sentCampaign = await EmailCampaign.findOneAndUpdate(
      { _id: campaign._id },
      {
        $set: {
          status: 'sent',
          'analytics.totalSent': result.totalSent,
          'analytics.totalFailed': result.totalFailed
        }
      },
      { new: true }
    );

    if (scheduledJobs.has(campaign._id.toString())) {
      const job = scheduledJobs.get(campaign._id.toString());
      job.destroy();
      scheduledJobs.delete(campaign._id.toString());
    }

    res.status(200).json({
      success: true,
      message: 'Campaign sent successfully',
      data: {
        campaign: sentCampaign,
        result: {
          totalSent: result.totalSent,
          totalFailed: result.totalFailed
        }
      }
    });
  } catch (error) {
    await EmailCampaign.findOneAndUpdate(
      { _id: campaign._id },
      {
        $set: {
          status: 'failed',
          'analytics.lastError': error.message
        }
      },
      { new: true }
    );

    return next(new AppError(`Failed to send campaign: ${error.message}`, 500));
  }
});

const duplicateCampaign = catchAsync(async (req, res, next) => {
  const originalCampaign = await EmailCampaign.findOne({
    _id: req.params.id,
    hotelId: req.user.hotelId
  }).lean();

  if (!originalCampaign) {
    return next(new AppError('Campaign not found', 404));
  }

  const duplicatedCampaign = new EmailCampaign({
    name: `${originalCampaign.name} (Copy)`,
    subject: originalCampaign.subject,
    content: originalCampaign.content,
    htmlContent: originalCampaign.htmlContent,
    segmentCriteria: originalCampaign.segmentCriteria,
    template: originalCampaign.template,
    personalization: originalCampaign.personalization,
    hotelId: req.user.hotelId,
    createdBy: req.user.id,
    status: 'draft'
  });

  await duplicatedCampaign.save();

  res.status(201).json({
    success: true,
    message: 'Campaign duplicated successfully',
    data: { campaign: duplicatedCampaign }
  });
});

const deleteCampaign = catchAsync(async (req, res, next) => {
  const campaign = await EmailCampaign.findOne({
    _id: req.params.id,
    hotelId: req.user.hotelId
  }).lean();

  if (!campaign) {
    return next(new AppError('Campaign not found', 404));
  }

  if (campaign.status === 'sending') {
    return next(new AppError('Cannot delete a campaign that is currently being sent', 400));
  }

  if (scheduledJobs.has(campaign._id.toString())) {
    const job = scheduledJobs.get(campaign._id.toString());
    job.destroy();
    scheduledJobs.delete(campaign._id.toString());
  }

  await EmailCampaign.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    message: 'Campaign deleted successfully'
  });
});

const previewCampaign = catchAsync(async (req, res, next) => {
  const { userId } = req.body;

  const campaign = await EmailCampaign.findOne({
    _id: req.params.id,
    hotelId: req.user.hotelId
  }).lean();

  if (!campaign) {
    return next(new AppError('Campaign not found', 404));
  }

  let previewUser = null;
  if (userId) {
    previewUser = await User.findById(userId).lean();
  }

  if (!previewUser) {
    previewUser = {
      name: 'John Doe',
      email: 'preview@example.com',
      personalizedData: {
        loyaltyPoints: 1250,
        totalBookings: 5,
        lastBookingDate: new Date(),
        preferredRoomType: 'Deluxe Suite'
      }
    };
  }

  const personalizedContent = await enhancedEmailService.personalizeContent(
    campaign.htmlContent || campaign.content,
    previewUser,
    campaign.personalization
  );

  const personalizedSubject = await enhancedEmailService.personalizeContent(
    campaign.subject,
    previewUser,
    campaign.personalization
  );

  res.status(200).json({
    success: true,
    data: {
      subject: personalizedSubject,
      content: personalizedContent,
      previewUser: {
        name: previewUser.name,
        email: previewUser.email
      }
    }
  });
});

const getAudienceCount = catchAsync(async (req, res, next) => {
  const { segmentCriteria } = req.body;

  const filter = { hotelId: req.user.hotelId };

  if (segmentCriteria) {
    if (segmentCriteria.role) filter.role = segmentCriteria.role;
    if (segmentCriteria.isActive !== undefined) filter.isActive = segmentCriteria.isActive;
    if (segmentCriteria.lastLoginAfter) {
      filter.lastLogin = { $gte: new Date(segmentCriteria.lastLoginAfter) };
    }
    if (segmentCriteria.totalBookingsMin) {
      filter.totalBookings = { $gte: segmentCriteria.totalBookingsMin };
    }
  }

  const count = await User.countDocuments(filter);

  res.status(200).json({
    success: true,
    data: { audienceCount: count }
  });
});

const getCampaignAnalytics = catchAsync(async (req, res, next) => {
  const campaign = await EmailCampaign.findOne({
    _id: req.params.id,
    hotelId: req.user.hotelId
  }).lean();

  if (!campaign) {
    return next(new AppError('Campaign not found', 404));
  }

  const analytics = {
    ...campaign.analytics.toObject(),
    openRate: campaign.analytics.totalSent > 0
      ? ((campaign.analytics.totalOpened / campaign.analytics.totalSent) * 100).toFixed(2)
      : 0,
    clickRate: campaign.analytics.totalSent > 0
      ? ((campaign.analytics.totalClicked / campaign.analytics.totalSent) * 100).toFixed(2)
      : 0,
    unsubscribeRate: campaign.analytics.totalSent > 0
      ? ((campaign.analytics.totalUnsubscribed / campaign.analytics.totalSent) * 100).toFixed(2)
      : 0
  };

  res.status(200).json({
    success: true,
    data: { analytics }
  });
});

const scheduleEmailCampaign = async (campaign) => {
  const cronTime = getCronExpression(campaign.scheduledAt);

  const job = cron.schedule(cronTime, async () => {
    try {
      // Atomically transition from 'scheduled' to 'sending'
      const currentCampaign = await EmailCampaign.findOneAndUpdate(
        { _id: campaign._id, status: 'scheduled' },
        { $set: { status: 'sending', sentAt: new Date() } },
        { new: true }
      );

      if (currentCampaign) {
        const result = await enhancedEmailService.sendCampaign(campaign._id.toString());

        await EmailCampaign.findOneAndUpdate(
          { _id: campaign._id },
          {
            $set: {
              status: 'sent',
              'analytics.totalSent': result.totalSent,
              'analytics.totalFailed': result.totalFailed
            }
          },
          { new: true }
        );
      }
    } catch (error) {
      console.error('Scheduled campaign failed:', error);
      await EmailCampaign.findOneAndUpdate(
        { _id: campaign._id },
        {
          $set: {
            status: 'failed',
            'analytics.lastError': error.message
          }
        },
        { new: true }
      );
    } finally {
      scheduledJobs.delete(campaign._id.toString());
    }
  }, {
    scheduled: false
  });

  job.start();
  scheduledJobs.set(campaign._id.toString(), job);

  console.log(`📅 Campaign "${campaign.name}" scheduled for ${campaign.scheduledAt}`);
};

const getCronExpression = (date) => {
  const minute = date.getMinutes();
  const hour = date.getHours();
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  return `${minute} ${hour} ${day} ${month} *`;
};

const getScheduledCampaigns = catchAsync(async (req, res, next) => {
  const scheduledCampaigns = await EmailCampaign.find({
    hotelId: req.user.hotelId,
    status: 'scheduled',
    scheduledAt: { $gte: new Date() }
  }).sort({ scheduledAt: 1 }).lean().limit(1000);

  const campaignsWithJobs = scheduledCampaigns.map(campaign => ({
    ...campaign,
    isJobActive: scheduledJobs.has(campaign._id.toString())
  }));

  res.status(200).json({
    success: true,
    data: {
      scheduledCampaigns: campaignsWithJobs,
      totalActive: scheduledJobs.size
    }
  });
});

const reinitializeScheduledCampaigns = async () => {
  try {
    if (schedulerShuttingDown) return;
    if (mongoose.connection.readyState !== 1) {
      return;
    }

    const scheduledCampaigns = await EmailCampaign.find({
      status: 'scheduled',
      scheduledAt: { $gte: new Date() }
    }).lean().limit(1000);

    for (const campaign of scheduledCampaigns) {
      if (!scheduledJobs.has(campaign._id.toString())) {
        await scheduleEmailCampaign(campaign);
      }
    }

    console.log(`📅 Reinitialized ${scheduledCampaigns.length} scheduled campaigns`);
  } catch (error) {
    if (schedulerShuttingDown || error?.name === 'MongoExpiredSessionError') {
      return;
    }
    console.error('Failed to reinitialize scheduled campaigns:', error);
  }
};

const scheduleCampaignReinitializeAfterDbReady = () => {
  if (process.env.NODE_ENV !== 'production' || hasScheduledReinitialize || schedulerShuttingDown) {
    return;
  }
  hasScheduledReinitialize = true;

  const runOnce = () => {
    if (schedulerShuttingDown) return;
    reinitializeTimeout = setTimeout(reinitializeScheduledCampaigns, 2000);
  };

  if (mongoose.connection.readyState === 1) {
    runOnce();
    return;
  }

  mongoose.connection.once('connected', runOnce);
};

process.on('SIGTERM', () => {
  schedulerShuttingDown = true;
  if (reinitializeTimeout) {
    clearTimeout(reinitializeTimeout);
    reinitializeTimeout = null;
  }
  console.log('🔄 Gracefully shutting down email scheduler...');
  scheduledJobs.forEach((job, campaignId) => {
    job.destroy();
    console.log(`📅 Stopped scheduled job for campaign ${campaignId}`);
  });
  scheduledJobs.clear();
});

scheduleCampaignReinitializeAfterDbReady();

export {
  createCampaign,
  getCampaigns,
  getCampaign,
  updateCampaign,
  sendCampaign,
  duplicateCampaign,
  deleteCampaign,
  previewCampaign,
  getAudienceCount,
  getCampaignAnalytics,
  getScheduledCampaigns,
  reinitializeScheduledCampaigns
};