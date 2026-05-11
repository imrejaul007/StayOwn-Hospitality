export type RewardType = 'COINS' | 'DISCOUNT' | 'FREE_PRODUCT'
export type CoinType = 'BRANDED' | 'REZ'
export type RewardStatus = 'PENDING' | 'CLAIMED' | 'EXPIRED' | 'CANCELLED'

export interface Reward {
  id: string
  serialId: string
  campaignId?: string
  brandId: string
  userId: string
  type: RewardType
  coinType: CoinType
  amount: number
  status: RewardStatus
  claimedAt?: Date
  expiresAt?: Date
  createdAt: Date
}

export interface RewardSummary {
  totalEarned: number
  totalClaimed: number
  pending: number
  expired: number
  available: number
}

export interface RewardHistory {
  rewards: Array<{
    id: string
    amount: number
    status: RewardStatus
    createdAt: Date
    claimedAt?: Date
    expiresAt?: Date
    serialNumber: string
    campaignName?: string
  }>
  total: number
}

export interface ClaimRewardRequest {
  rewardId: string
  userId: string
}

export interface ClaimRewardResponse {
  success: boolean
  reward?: Reward
  error?: string
}
