export type CampaignType = 'PER_SCAN' | 'FIRST_N' | 'GEO_TARGETED' | 'TIME_BOOST'
export type CampaignStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'BUDGET_EXHAUSTED'
export type RewardType = 'COINS' | 'DISCOUNT' | 'FREE_PRODUCT'

export interface Campaign {
  id: string
  brandId: string
  productId?: string
  name: string
  description?: string
  type: CampaignType
  rewardType: RewardType
  rewardAmount: number
  cap?: number
  usedCount: number
  status: CampaignStatus
  targeting?: CampaignTargeting
  startDate: Date
  endDate?: Date
  createdAt: Date
  updatedAt: Date
}

export interface CampaignTargeting {
  locations?: Array<{
    lat: number
    lng: number
    radius: number
  }>
  timeSlots?: Array<{
    start: number
    end: number
  }>
  minScans?: number
}

export interface CreateCampaignRequest {
  brandId: string
  productId?: string
  name: string
  description?: string
  type: CampaignType
  rewardType: RewardType
  rewardAmount: number
  cap?: number
  targeting?: CampaignTargeting
  startDate: Date
  endDate?: Date
}

export interface CampaignSummary {
  id: string
  name: string
  type: CampaignType
  status: CampaignStatus
  rewardAmount: number
  usedCount: number
  cap?: number
  startDate: Date
  endDate?: Date
  totalRewardDistributed: number
  averageRewardPerScan: number
}

export interface CampaignPerformance {
  campaignId: string
  totalScans: number
  uniqueUsers: number
  rewardsIssued: number
  totalRewardAmount: number
  avgRewardPerScan: number
  timeline: Array<{
    date: string
    scans: number
    rewards: number
  }>
}

export interface CampaignEligibility {
  eligible: boolean
  campaignId?: string
  campaignName?: string
  reason?: string
  rewardAmount?: number
}
