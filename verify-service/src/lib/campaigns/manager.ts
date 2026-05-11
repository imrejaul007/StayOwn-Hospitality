import prisma from '../db'

export interface CreateCampaignInput {
  brandId: string
  productId?: string
  name: string
  description?: string
  type: 'PER_SCAN' | 'FIRST_N' | 'GEO_TARGETED' | 'TIME_BOOST'
  rewardType: 'COINS' | 'DISCOUNT' | 'FREE_PRODUCT'
  rewardAmount: number
  cap?: number
  targeting?: {
    locations?: Array<{ lat: number; lng: number; radius: number }>
    timeSlots?: Array<{ start: number; end: number }>
    minScans?: number
  }
  startDate: Date
  endDate?: Date
}

export interface CampaignSummary {
  id: string
  name: string
  type: string
  status: string
  rewardAmount: number
  usedCount: number
  cap: number | null
  startDate: Date
  endDate: Date | null
  totalRewardDistributed: number
  averageRewardPerScan: number
}

export async function createCampaign(input: CreateCampaignInput): Promise<{
  success: boolean
  campaignId?: string
  error?: string
}> {
  try {
    const campaign = await prisma.campaign.create({
      data: {
        brandId: input.brandId,
        productId: input.productId || null,
        name: input.name,
        description: input.description,
        type: input.type,
        rewardType: input.rewardType,
        rewardAmount: input.rewardAmount,
        cap: input.cap,
        targeting: input.targeting as any,
        startDate: input.startDate,
        endDate: input.endDate,
        status: 'DRAFT',
      },
    })

    return { success: true, campaignId: campaign.id }
  } catch (error) {
    console.error('Create campaign error:', error)
    return { success: false, error: 'Failed to create campaign' }
  }
}

export async function updateCampaign(
  campaignId: string,
  updates: Partial<CreateCampaignInput>
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        ...updates,
        targeting: updates.targeting as any,
      },
    })

    return { success: true }
  } catch (error) {
    console.error('Update campaign error:', error)
    return { success: false, error: 'Failed to update campaign' }
  }
}

export async function activateCampaign(campaignId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    })

    if (!campaign) {
      return { success: false, error: 'Campaign not found' }
    }

    if (campaign.status === 'ACTIVE') {
      return { success: false, error: 'Campaign already active' }
    }

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'ACTIVE' },
    })

    return { success: true }
  } catch (error) {
    console.error('Activate campaign error:', error)
    return { success: false, error: 'Failed to activate campaign' }
  }
}

export async function pauseCampaign(campaignId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'PAUSED' },
    })

    return { success: true }
  } catch (error) {
    console.error('Pause campaign error:', error)
    return { success: false, error: 'Failed to pause campaign' }
  }
}

export async function completeCampaign(campaignId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'COMPLETED' },
    })

    return { success: true }
  } catch (error) {
    console.error('Complete campaign error:', error)
    return { success: false, error: 'Failed to complete campaign' }
  }
}

export async function getCampaignSummary(campaignId: string): Promise<CampaignSummary | null> {
  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        _count: { select: { rewards: true } },
      },
    })

    if (!campaign) return null

    const totalReward = await prisma.reward.aggregate({
      where: { campaignId },
      _sum: { amount: true },
    })

    return {
      id: campaign.id,
      name: campaign.name,
      type: campaign.type,
      status: campaign.status,
      rewardAmount: campaign.rewardAmount,
      usedCount: campaign.usedCount,
      cap: campaign.cap,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      totalRewardDistributed: totalReward._sum.amount || 0,
      averageRewardPerScan: campaign.usedCount > 0
        ? (totalReward._sum.amount || 0) / campaign.usedCount
        : 0,
    }
  } catch (error) {
    console.error('Campaign summary error:', error)
    return null
  }
}

export async function getBrandCampaigns(
  brandId: string,
  options?: {
    status?: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'BUDGET_EXHAUSTED'
    limit?: number
    offset?: number
  }
): Promise<{ campaigns: CampaignSummary[]; total: number }> {
  try {
    const where = {
      brandId,
      ...(options?.status && { status: options.status }),
    }

    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 20,
        skip: options?.offset || 0,
      }),
      prisma.campaign.count({ where }),
    ])

    const summaries = await Promise.all(
      campaigns.map(async (c) => {
        const totalReward = await prisma.reward.aggregate({
          where: { campaignId: c.id },
          _sum: { amount: true },
        })

        return {
          id: c.id,
          name: c.name,
          type: c.type,
          status: c.status,
          rewardAmount: c.rewardAmount,
          usedCount: c.usedCount,
          cap: c.cap,
          startDate: c.startDate,
          endDate: c.endDate,
          totalRewardDistributed: totalReward._sum.amount || 0,
          averageRewardPerScan: c.usedCount > 0
            ? (totalReward._sum.amount || 0) / c.usedCount
            : 0,
        }
      })
    )

    return { campaigns: summaries, total }
  } catch (error) {
    console.error('Get brand campaigns error:', error)
    return { campaigns: [], total: 0 }
  }
}

export async function checkBudgetExhausted(): Promise<{ updated: number }> {
  try {
    const result = await prisma.campaign.updateMany({
      where: {
        status: 'ACTIVE',
        cap: { not: null },
        usedCount: { gte: prisma.campaign.fields.usedCount },
      },
      data: { status: 'BUDGET_EXHAUSTED' },
    })

    return { updated: result.count }
  } catch (error) {
    console.error('Check budget exhausted error:', error)
    return { updated: 0 }
  }
}

export async function deleteCampaign(campaignId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    })

    if (!campaign) {
      return { success: false, error: 'Campaign not found' }
    }

    if (campaign.status === 'ACTIVE') {
      return { success: false, error: 'Cannot delete active campaign' }
    }

    await prisma.campaign.delete({
      where: { id: campaignId },
    })

    return { success: true }
  } catch (error) {
    console.error('Delete campaign error:', error)
    return { success: false, error: 'Failed to delete campaign' }
  }
}
