import prisma from '../db'

export interface EligibilityContext {
  userId: string
  brandId: string
  serialId: string
  productId?: string
  location?: { lat: number; lng: number }
  timestamp?: Date
  deviceId?: string
  userAgent?: string
}

export interface EligibilityResult {
  eligible: boolean
  campaignId?: string
  campaignName?: string
  reason?: string
  rewardAmount?: number
}

export async function checkEligibility(context: EligibilityContext): Promise<EligibilityResult> {
  try {
    const activeCampaigns = await prisma.campaign.findMany({
      where: {
        brandId: context.brandId,
        status: 'ACTIVE',
        startDate: { lte: new Date() },
        OR: [
          { endDate: null },
          { endDate: { gte: new Date() } },
        ],
      },
      orderBy: [{ rewardAmount: 'desc' }],
    })

    if (activeCampaigns.length === 0) {
      return { eligible: false, reason: 'No active campaigns' }
    }

    for (const campaign of activeCampaigns) {
      const eligibility = await evaluateCampaignEligibility(campaign, context)
      if (eligibility.eligible) {
        return eligibility
      }
    }

    return { eligible: false, reason: 'Not eligible for any active campaigns' }
  } catch (error) {
    console.error('Eligibility check error:', error)
    return { eligible: false, reason: 'Service error' }
  }
}

async function evaluateCampaignEligibility(
  campaign: {
    id: string
    name: string
    type: 'PER_SCAN' | 'FIRST_N' | 'GEO_TARGETED' | 'TIME_BOOST'
    productId: string | null
    cap: number | null
    usedCount: number
    rewardAmount: number
    targeting?: unknown
  },
  context: EligibilityContext
): Promise<EligibilityResult> {
  if (campaign.cap && campaign.usedCount >= campaign.cap) {
    return { eligible: false, reason: 'Campaign budget exhausted' }
  }

  if (campaign.productId && campaign.productId !== context.productId) {
    return { eligible: false, reason: 'Campaign not for this product' }
  }

  if (campaign.type === 'FIRST_N') {
    const eligible = await checkFirstNEligibility(campaign.id, context.userId)
    if (!eligible) {
      return { eligible: false, reason: 'First N limit reached' }
    }
  }

  if (campaign.type === 'GEO_TARGETED' && campaign.targeting) {
    const geoResult = checkGeoEligibility(
      campaign.targeting as { locations?: Array<{ lat: number; lng: number; radius: number }> },
      context.location
    )
    if (!geoResult.eligible) {
      return geoResult
    }
  }

  if (campaign.type === 'TIME_BOOST' && context.timestamp) {
    const timeResult = checkTimeEligibility(
      campaign.targeting as { timeSlots?: Array<{ start: number; end: number }> },
      context.timestamp
    )
    if (!timeResult.eligible) {
      const { eligible: _e, ...rest } = timeResult
      return { eligible: false, ...rest }
    }
  }

  return {
    eligible: true,
    campaignId: campaign.id,
    campaignName: campaign.name,
    rewardAmount: campaign.rewardAmount,
  }
}

async function checkFirstNEligibility(campaignId: string, userId: string): Promise<boolean> {
  try {
    const existingReward = await prisma.reward.findFirst({
      where: {
        campaignId,
        userId,
      },
    })

    return !existingReward
  } catch {
    return false
  }
}

function checkGeoEligibility(
  targeting: { locations?: Array<{ lat: number; lng: number; radius: number }> },
  location?: { lat: number; lng: number }
): { eligible: boolean; reason?: string } {
  if (!location) {
    return { eligible: false, reason: 'Location not available' }
  }

  if (!targeting.locations || targeting.locations.length === 0) {
    return { eligible: true }
  }

  for (const target of targeting.locations) {
    const distance = calculateDistance(
      location.lat,
      location.lng,
      target.lat,
      target.lng
    )

    if (distance <= target.radius) {
      return { eligible: true }
    }
  }

  return { eligible: false, reason: 'Outside target location' }
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLng = (lng2 - lng1) * (Math.PI / 180)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function checkTimeEligibility(
  targeting: { timeSlots?: Array<{ start: number; end: number }> },
  timestamp: Date
): { eligible: boolean; reason?: string } {
  if (!targeting.timeSlots || targeting.timeSlots.length === 0) {
    return { eligible: true }
  }

  const hour = timestamp.getHours()

  for (const slot of targeting.timeSlots) {
    if (hour >= slot.start && hour < slot.end) {
      return { eligible: true }
    }
  }

  return { eligible: false, reason: 'Outside target time slot' }
}

export async function getUserCampaignHistory(
  userId: string,
  brandId: string
): Promise<Array<{
  campaignId: string
  campaignName: string
  rewardCount: number
  totalReward: number
  firstScanAt: Date
  lastScanAt: Date
}>> {
  try {
    const rewards = await prisma.reward.findMany({
      where: {
        userId,
        brandId,
        campaignId: { not: null },
      },
      include: {
        campaign: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const campaignMap = new Map<string, {
      campaignId: string
      campaignName: string
      rewardCount: number
      totalReward: number
      firstScanAt: Date
      lastScanAt: Date
    }>()

    rewards.forEach((reward) => {
      if (!reward.campaignId) return

      const existing = campaignMap.get(reward.campaignId)
      if (existing) {
        existing.rewardCount++
        existing.totalReward += reward.amount
        existing.lastScanAt = reward.createdAt
      } else {
        campaignMap.set(reward.campaignId, {
          campaignId: reward.campaignId,
          campaignName: reward.campaign?.name || 'Unknown',
          rewardCount: 1,
          totalReward: reward.amount,
          firstScanAt: reward.createdAt,
          lastScanAt: reward.createdAt,
        })
      }
    })

    return Array.from(campaignMap.values())
  } catch (error) {
    console.error('Campaign history error:', error)
    return []
  }
}
