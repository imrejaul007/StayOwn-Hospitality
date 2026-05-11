import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import EmailCampaign from '../models/EmailCampaign.js';
import User from '../models/User.js';
import { AppError } from '../utils/appError.js';
import { catchAsync } from '../utils/catchAsync.js';

const trackEmailOpen = catchAsync(async (req, res, next) => {
  const { campaignId, userId, trackingId } = req.params;

  try {
    // Get basic device info from user agent
    const userAgent = req.get('User-Agent') || '';
    const deviceType = /mobile/i.test(userAgent) ? 'mobile' :
                      /tablet/i.test(userAgent) ? 'tablet' : 'desktop';

    const hour = new Date().getHours();

    // Atomically update all analytics in one operation
    const campaign = await EmailCampaign.findOneAndUpdate(
      { _id: campaignId },
      {
        $inc: {
          'analytics.totalOpened': 1,
          [`analytics.deviceBreakdown.${deviceType}`]: 1
        }
      },
      { new: true }
    );

    if (!campaign) {
      return res.status(200).send(''); // Silent fail for tracking pixels
    }

    // Track time breakdown atomically
    const timeEntryExists = await EmailCampaign.findOne({
      _id: campaignId,
      'analytics.timeBreakdown.hour': hour
    }).lean();

    if (timeEntryExists) {
      await EmailCampaign.findOneAndUpdate(
        { _id: campaignId, 'analytics.timeBreakdown.hour': hour },
        { $inc: { 'analytics.timeBreakdown.$.opens': 1 } },
        { new: true }
      );
    } else {
      await EmailCampaign.findOneAndUpdate(
        { _id: campaignId },
        { $push: { 'analytics.timeBreakdown': { hour, opens: 1, clicks: 0 } } },
        { new: true }
      );
    }

    // Log detailed tracking data
    console.log(`Email opened - Campaign: ${campaign.name}, User: ${userId}, Device: ${deviceType}`);

    // Return 1x1 transparent pixel
    const pixel = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64'
    );

    res.set({
      'Content-Type': 'image/png',
      'Content-Length': pixel.length,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    res.send(pixel);
  } catch (error) {
    console.error('Email tracking error:', error);
    // Silent fail - return pixel anyway
    const pixel = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64'
    );
    res.set('Content-Type', 'image/png');
    res.send(pixel);
  }
});

const trackEmailClick = catchAsync(async (req, res, next) => {
  const { campaignId, userId, linkId } = req.params;
  const { url } = req.query;

  try {
    // Atomically increment click count
    const campaign = await EmailCampaign.findOneAndUpdate(
      { _id: campaignId },
      { $inc: { 'analytics.totalClicked': 1 } },
      { new: true }
    );

    if (!campaign) {
      return res.redirect(url || 'https://thepentouz.com');
    }

    // Track time breakdown atomically
    const hour = new Date().getHours();
    const timeEntryExists = await EmailCampaign.findOne({
      _id: campaignId,
      'analytics.timeBreakdown.hour': hour
    }).lean();

    if (timeEntryExists) {
      await EmailCampaign.findOneAndUpdate(
        { _id: campaignId, 'analytics.timeBreakdown.hour': hour },
        { $inc: { 'analytics.timeBreakdown.$.clicks': 1 } },
        { new: true }
      );
    } else {
      await EmailCampaign.findOneAndUpdate(
        { _id: campaignId },
        { $push: { 'analytics.timeBreakdown': { hour, opens: 0, clicks: 1 } } },
        { new: true }
      );
    }

    // Log click tracking
    console.log(`Email link clicked - Campaign: ${campaign.name}, User: ${userId}, URL: ${url}`);

    // Redirect to original URL
    res.redirect(url || 'https://thepentouz.com');
  } catch (error) {
    console.error('Click tracking error:', error);
    // Redirect anyway
    res.redirect(url || 'https://thepentouz.com');
  }
});

const trackUnsubscribe = catchAsync(async (req, res, next) => {
  const { campaignId, userId } = req.params;

  try {
    // Atomically increment unsubscribe count
    const campaign = await EmailCampaign.findOneAndUpdate(
      { _id: campaignId },
      { $inc: { 'analytics.totalUnsubscribed': 1 } },
      { new: true }
    );

    // Atomically update user's email preferences
    const user = await User.findOneAndUpdate(
      { _id: userId },
      {
        $set: {
          'emailPreferences.marketing': false,
          'emailPreferences.unsubscribedAt': new Date(),
          'emailPreferences.unsubscribedFromCampaign': campaignId
        }
      },
      { new: true }
    );

    if (user) {
      console.log(`User unsubscribed - Campaign: ${campaign?.name || 'unknown'}, User: ${user.email}`);
    }

    res.status(200).json({
      success: true,
      message: 'You have been successfully unsubscribed from marketing emails.'
    });
  } catch (error) {
    console.error('Unsubscribe tracking error:', error);
    res.status(200).json({
      success: true,
      message: 'Unsubscribe request processed.'
    });
  }
});

const getEmailAnalytics = catchAsync(async (req, res, next) => {
  const { campaignId } = req.params;
  const { timeRange = '7d' } = req.query;

  const campaign = await EmailCampaign.findOne({
    _id: campaignId,
    hotelId: req.user.hotelId
  }).lean();

  if (!campaign) {
    return next(new AppError('Campaign not found', 404));
  }

  // Calculate time-based analytics
  const timeRangeHours = {
    '24h': 24,
    '7d': 24 * 7,
    '30d': 24 * 30,
    '90d': 24 * 90
  };

  const hoursBack = timeRangeHours[timeRange] || 24 * 7;
  const cutoffTime = new Date(Date.now() - (hoursBack * 60 * 60 * 1000));

  // Filter time breakdown data
  const recentTimeBreakdown = campaign.analytics.timeBreakdown.filter(t => {
    const timeHour = new Date();
    timeHour.setHours(t.hour, 0, 0, 0);
    return timeHour >= cutoffTime;
  });

  const analytics = {
    campaign: {
      id: campaign._id,
      name: campaign.name,
      status: campaign.status,
      sentAt: campaign.sentAt,
      engagementScore: campaign.engagementScore
    },
    overview: {
      totalSent: campaign.analytics.totalSent,
      totalDelivered: campaign.analytics.totalDelivered,
      totalOpened: campaign.analytics.totalOpened,
      totalClicked: campaign.analytics.totalClicked,
      totalUnsubscribed: campaign.analytics.totalUnsubscribed,
      totalBounced: campaign.analytics.totalBounced,
      totalFailed: campaign.analytics.totalFailed
    },
    rates: {
      openRate: campaign.analytics.openRate.toFixed(2),
      clickRate: campaign.analytics.clickRate.toFixed(2),
      unsubscribeRate: campaign.analytics.unsubscribeRate.toFixed(2),
      bounceRate: campaign.analytics.bounceRate.toFixed(2),
      deliveryRate: campaign.analytics.totalSent > 0
        ? ((campaign.analytics.totalDelivered / campaign.analytics.totalSent) * 100).toFixed(2)
        : '0.00'
    },
    breakdowns: {
      device: campaign.analytics.deviceBreakdown,
      geographic: campaign.analytics.geoBreakdown.sort((a, b) => (b.opens + b.clicks) - (a.opens + a.clicks)).slice(0, 10),
      time: recentTimeBreakdown.sort((a, b) => a.hour - b.hour)
    },
    timeline: generateEngagementTimeline(campaign, hoursBack),
    benchmarks: await getCampaignBenchmarks(req.user.hotelId, campaign)
  };

  res.status(200).json({
    success: true,
    data: analytics
  });
});

const getBulkEmailAnalytics = catchAsync(async (req, res, next) => {
  const { startDate, endDate, status, limit = 10 } = req.query;

  const filter = { hotelId: req.user.hotelId };

  if (status) filter.status = status;
  if (startDate && endDate) {
    filter.sentAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }

  const campaigns = await EmailCampaign.find(filter)
    .sort({ sentAt: -1 })
    .limit(parseInt(limit))
    .select('name status sentAt analytics engagementScore').lean();

  const performanceSummary = await EmailCampaign.getCampaignPerformance(
    req.user.hotelId,
    startDate && endDate ? { start: startDate, end: endDate } : {}
  );

  res.status(200).json({
    success: true,
    data: {
      campaigns: campaigns.map(c => ({
        id: c._id,
        name: c.name,
        status: c.status,
        sentAt: c.sentAt,
        analytics: {
          sent: c.analytics.totalSent,
          opened: c.analytics.totalOpened,
          clicked: c.analytics.totalClicked,
          openRate: c.analytics.openRate.toFixed(2),
          clickRate: c.analytics.clickRate.toFixed(2),
          engagementScore: c.engagementScore.toFixed(1)
        }
      })),
      summary: performanceSummary
    }
  });
});

const generateEngagementTimeline = (campaign, hoursBack) => {
  const timeline = [];
  const now = new Date();

  for (let i = hoursBack; i >= 0; i--) {
    const time = new Date(now.getTime() - (i * 60 * 60 * 1000));
    const hour = time.getHours();

    const timeData = campaign.analytics.timeBreakdown.find(t => t.hour === hour);

    timeline.push({
      time: time.toISOString(),
      opens: timeData?.opens || 0,
      clicks: timeData?.clicks || 0
    });
  }

  return timeline;
};

const getCampaignBenchmarks = async (hotelId, campaign) => {
  try {
    const similarCampaigns = await EmailCampaign.find({
      hotelId,
      status: 'sent',
      _id: { $ne: campaign._id },
      'analytics.totalSent': { $gte: 10 } // Only include campaigns with meaningful data
    }).select('analytics').lean().limit(1000);

    if (similarCampaigns.length === 0) {
      return {
        openRate: 'N/A',
        clickRate: 'N/A',
        message: 'No benchmark data available'
      };
    }

    const avgOpenRate = similarCampaigns.reduce((sum, c) => sum + c.analytics.openRate, 0) / similarCampaigns.length;
    const avgClickRate = similarCampaigns.reduce((sum, c) => sum + c.analytics.clickRate, 0) / similarCampaigns.length;

    return {
      openRate: avgOpenRate.toFixed(2),
      clickRate: avgClickRate.toFixed(2),
      basedOnCampaigns: similarCampaigns.length,
      performance: {
        openRate: campaign.analytics.openRate > avgOpenRate ? 'above' : 'below',
        clickRate: campaign.analytics.clickRate > avgClickRate ? 'above' : 'below'
      }
    };
  } catch (error) {
    console.error('Error getting benchmarks:', error);
    return {
      openRate: 'N/A',
      clickRate: 'N/A',
      message: 'Benchmark calculation failed'
    };
  }
};

const getRealtimeMetrics = catchAsync(async (req, res, next) => {
  const { campaignId } = req.params;

  const campaign = await EmailCampaign.findOne({
    _id: campaignId,
    hotelId: req.user.hotelId
  }).select('name status analytics sentAt').lean();

  if (!campaign) {
    return next(new AppError('Campaign not found', 404));
  }

  // Get metrics from the last hour
  const currentHour = new Date().getHours();

  const recentActivity = campaign.analytics.timeBreakdown.find(t => t.hour === currentHour) || {
    hour: currentHour,
    opens: 0,
    clicks: 0
  };

  const realtimeData = {
    campaign: {
      id: campaign._id,
      name: campaign.name,
      status: campaign.status,
      sentAt: campaign.sentAt
    },
    current: {
      totalSent: campaign.analytics.totalSent,
      totalOpened: campaign.analytics.totalOpened,
      totalClicked: campaign.analytics.totalClicked,
      openRate: campaign.analytics.openRate.toFixed(2),
      clickRate: campaign.analytics.clickRate.toFixed(2)
    },
    lastHour: {
      opens: recentActivity.opens,
      clicks: recentActivity.clicks
    },
    timestamp: new Date().toISOString()
  };

  res.status(200).json({
    success: true,
    data: realtimeData
  });
});

export {
  trackEmailOpen,
  trackEmailClick,
  trackUnsubscribe,
  getEmailAnalytics,
  getBulkEmailAnalytics,
  getRealtimeMetrics
};