import prisma from '../db'
import { creditCoins } from '../wallet'
import { calculateReward } from './calculator'
import { addBrandedCoins } from './brandCoins'

export interface RewardIssuance {
  success: boolean
  rewardId?: string
  amount?: number
  coinType?: 'BRANDED' | 'REZ'
  error?: string
}

export interface RewardContext {
  serialId: string
  brandId: string
  userId: string
  campaignId?: string
  deviceId?: string
  ipAddress?: string
  location?: { lat: number; lng: number; accuracy?: number }
  timestamp?: Date
  scanCount?: number
}

export async function issueReward(context: RewardContext): Promise<RewardIssuance> {
  try {
    const existingReward = await prisma.reward.findFirst({
      where: {
        serialId: context.serialId,
        userId: context.userId,
        campaignId: context.campaignId || null,
        status: { in: ['PENDING', 'CLAIMED'] },
      },
    })

    if (existingReward) {
      return {
        success: false,
        error: 'Reward already issued for this scan',
      }
    }

    const calculation = await calculateReward(
      context.brandId,
      context.campaignId || null,
      context.userId,
      {
        location: context.location,
        timestamp: context.timestamp,
        scanCount: context.scanCount,
      }
    )

    if (!calculation || calculation.totalAmount <= 0) {
      return {
        success: false,
        error: 'No reward applicable',
      }
    }

    const reward = await prisma.reward.create({
      data: {
        serialId: context.serialId,
        campaignId: context.campaignId || null,
        brandId: context.brandId,
        userId: context.userId,
        type: 'COINS',
        coinType: calculation.coinType,
        amount: calculation.totalAmount,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      },
    })

    if (calculation.coinType === 'BRANDED') {
      const creditResult = await addBrandedCoins(
        context.userId,
        context.brandId,
        calculation.totalAmount,
        `reward:${reward.id}`,
        {
          serialId: context.serialId,
          campaignId: context.campaignId,
        }
      )

      if (creditResult.success) {
        await prisma.reward.update({
          where: { id: reward.id },
          data: { status: 'CLAIMED', claimedAt: new Date() },
        })
      }
    }

    if (context.campaignId) {
      await prisma.campaign.update({
        where: { id: context.campaignId },
        data: { usedCount: { increment: 1 } },
      })
    }

    return {
      success: true,
      rewardId: reward.id,
      amount: calculation.totalAmount,
      coinType: calculation.coinType,
    }
  } catch (error) {
    console.error('Reward issuance error:', error)
    return {
      success: false,
      error: 'Failed to issue reward',
    }
  }
}

export async function claimReward(
  rewardId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const reward = await prisma.reward.findUnique({
      where: { id: rewardId },
    })

    if (!reward) {
      return { success: false, error: 'Reward not found' }
    }

    if (reward.userId !== userId) {
      return { success: false, error: 'Not authorized' }
    }

    if (reward.status === 'CLAIMED') {
      return { success: false, error: 'Reward already claimed' }
    }

    if (reward.status === 'EXPIRED' || reward.status === 'CANCELLED') {
      return { success: false, error: 'Reward no longer available' }
    }

    if (reward.expiresAt && reward.expiresAt < new Date()) {
      await prisma.reward.update({
        where: { id: rewardId },
        data: { status: 'EXPIRED' },
      })
      return { success: false, error: 'Reward has expired' }
    }

    await prisma.reward.update({
      where: { id: rewardId },
      data: { status: 'CLAIMED', claimedAt: new Date() },
    })

    return { success: true }
  } catch (error) {
    console.error('Claim reward error:', error)
    return { success: false, error: 'Failed to claim reward' }
  }
}

export async function cancelReward(
  rewardId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const reward = await prisma.reward.update({
      where: { id: rewardId },
      data: { status: 'CANCELLED' },
    })

    if (reward.campaignId) {
      await prisma.campaign.update({
        where: { id: reward.campaignId },
        data: { usedCount: { decrement: 1 } },
      })
    }

    return { success: true }
  } catch (error) {
    console.error('Cancel reward error:', error)
    return { success: false, error: 'Failed to cancel reward' }
  }
}

export async function expireOldRewards(): Promise<{ expired: number }> {
  try {
    const result = await prisma.reward.updateMany({
      where: {
        status: 'PENDING',
        expiresAt: { lt: new Date() },
      },
      data: { status: 'EXPIRED' },
    })

    return { expired: result.count }
  } catch (error) {
    console.error('Expire rewards error:', error)
    return { expired: 0 }
  }
}
