import prisma from '../db'

export interface RewardCalculation {
  baseAmount: number
  bonusMultiplier: number
  totalAmount: number
  coinType: 'BRANDED' | 'REZ'
  breakdown: {
    category: string
    amount: number
    description: string
  }[]
}

export interface CampaignRewardConfig {
  type: 'PER_SCAN' | 'FIRST_N' | 'GEO_TARGETED' | 'TIME_BOOST'
  rewardAmount: number
  cap?: number
  usedCount: number
  targeting?: {
    locations?: string[]
    timeSlots?: string[]
    minScans?: number
  }
}

export async function calculateReward(
  brandId: string,
  campaignId: string | null,
  userId: string,
  context?: {
    location?: { lat: number; lng: number }
    timestamp?: Date
    scanCount?: number
  }
): Promise<RewardCalculation | null> {
  try {
    if (campaignId) {
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        include: { brand: true },
      })

      if (!campaign || campaign.status !== 'ACTIVE') {
        return null
      }

      if (campaign.cap && campaign.usedCount >= campaign.cap) {
        return null
      }

      const now = new Date()
      if (campaign.startDate > now || (campaign.endDate && campaign.endDate < now)) {
        return null
      }

      return calculateCampaignReward(campaign, context)
    }

    const brandSettings = await prisma.brandCoinSettings.findUnique({
      where: { brandId },
    })

    if (!brandSettings) {
      return {
        baseAmount: 50,
        bonusMultiplier: 1,
        totalAmount: 50,
        coinType: 'BRANDED',
        breakdown: [
          {
            category: 'base',
            amount: 50,
            description: 'Base scan reward',
          },
        ],
      }
    }

    return {
      baseAmount: brandSettings.valuePerCoin > 0 ? Math.round(brandSettings.valuePerCoin * 50) : 50,
      bonusMultiplier: 1,
      totalAmount: brandSettings.valuePerCoin > 0 ? Math.round(brandSettings.valuePerCoin * 50) : 50,
      coinType: 'BRANDED',
      breakdown: [
        {
          category: 'base',
          amount: brandSettings.valuePerCoin > 0 ? Math.round(brandSettings.valuePerCoin * 50) : 50,
          description: 'Base scan reward',
        },
      ],
    }
  } catch (error) {
    console.error('Reward calculation error:', error)
    return null
  }
}

function calculateCampaignReward(
  campaign: {
    type: 'PER_SCAN' | 'FIRST_N' | 'GEO_TARGETED' | 'TIME_BOOST'
    rewardAmount: number
    targeting?: unknown
  },
  context?: {
    location?: { lat: number; lng: number }
    timestamp?: Date
    scanCount?: number
  }
): RewardCalculation {
  const breakdown: RewardCalculation['breakdown'] = []
  let totalAmount = campaign.rewardAmount
  let bonusMultiplier = 1

  breakdown.push({
    category: 'base',
    amount: campaign.rewardAmount,
    description: 'Campaign base reward',
  })

  if (campaign.type === 'FIRST_N' && context?.scanCount !== undefined) {
    if (context.scanCount === 0) {
      const firstBonus = Math.round(campaign.rewardAmount * 0.5)
      breakdown.push({
        category: 'first_scanner_bonus',
        amount: firstBonus,
        description: 'First scanner bonus',
      })
      totalAmount += firstBonus
      bonusMultiplier += 0.5
    }
  }

  if (campaign.type === 'TIME_BOOST' && context?.timestamp) {
    const hour = context.timestamp.getHours()
    const isPrimeTime = hour >= 18 && hour <= 22

    if (isPrimeTime) {
      const timeBonus = Math.round(campaign.rewardAmount * 0.25)
      breakdown.push({
        category: 'time_boost',
        amount: timeBonus,
        description: 'Prime time boost (6 PM - 10 PM)',
      })
      totalAmount += timeBonus
      bonusMultiplier += 0.25
    }
  }

  if (campaign.type === 'GEO_TARGETED' && campaign.targeting && context?.location) {
    const targeting = campaign.targeting as { locations?: string[] }
    if (targeting.locations && targeting.locations.length > 0) {
      breakdown.push({
        category: 'geo_targeted',
        amount: 0,
        description: `Targeted for specific locations`,
      })
    }
  }

  return {
    baseAmount: campaign.rewardAmount,
    bonusMultiplier,
    totalAmount,
    coinType: 'BRANDED',
    breakdown,
  }
}

export async function getUserRewardSummary(
  userId: string,
  brandId: string
): Promise<{
  totalEarned: number
  totalClaimed: number
  pending: number
  expired: number
  available: number
}> {
  try {
    const rewards = await prisma.reward.groupBy({
      by: ['status'],
      where: {
        userId,
        brandId,
      },
      _sum: {
        amount: true,
      },
      _count: true,
    })

    let totalEarned = 0
    let totalClaimed = 0
    let pending = 0
    let expired = 0

    rewards.forEach((group) => {
      const amount = group._sum.amount || 0
      totalEarned += amount

      switch (group.status) {
        case 'CLAIMED':
          totalClaimed = amount
          break
        case 'PENDING':
          pending = amount
          break
        case 'EXPIRED':
          expired = amount
          break
      }
    })

    return {
      totalEarned,
      totalClaimed,
      pending,
      expired,
      available: totalEarned - totalClaimed - expired,
    }
  } catch (error) {
    console.error('Reward summary error:', error)
    return {
      totalEarned: 0,
      totalClaimed: 0,
      pending: 0,
      expired: 0,
      available: 0,
    }
  }
}

export async function getRewardHistory(
  userId: string,
  brandId: string,
  options?: {
    limit?: number
    offset?: number
    status?: 'PENDING' | 'CLAIMED' | 'EXPIRED' | 'CANCELLED'
  }
): Promise<{
  rewards: Array<{
    id: string
    amount: number
    status: string
    createdAt: Date
    claimedAt: Date | null
    expiresAt: Date | null
    serialNumber: string
    campaignName: string | null
  }>
  total: number
}> {
  try {
    const where = {
      userId,
      brandId,
      ...(options?.status && { status: options.status }),
    }

    const [rewards, total] = await Promise.all([
      prisma.reward.findMany({
        where,
        include: {
          serial: { select: { serialNumber: true } },
          campaign: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 20,
        skip: options?.offset || 0,
      }),
      prisma.reward.count({ where }),
    ])

    return {
      rewards: rewards.map((r) => ({
        id: r.id,
        amount: r.amount,
        status: r.status,
        createdAt: r.createdAt,
        claimedAt: r.claimedAt,
        expiresAt: r.expiresAt,
        serialNumber: r.serial.serialNumber,
        campaignName: r.campaign?.name || null,
      })),
      total,
    }
  } catch (error) {
    console.error('Reward history error:', error)
    return { rewards: [], total: 0 }
  }
}
