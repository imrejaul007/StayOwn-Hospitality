import type { BrandStatus, BrandPlan } from './index'

export interface BrandAnalytics {
  totalScans: number
  uniqueUsers: number
  totalRewards: number
  fraudRate: number
  scanTrend: Array<{
    date: string
    scans: number
  }>
  topProducts: Array<{
    id: string
    name: string
    scans: number
  }>
}

export interface BrandSettings {
  coinName: string
  coinSymbol: string
  valuePerCoin: number
  minRedeem: number
  expiryDays: number
  allowRedemption: boolean
  allowConversion: boolean
}

export interface CreateBrandDTO {
  name: string
  slug: string
  email: string
  phone?: string
  logo?: string
  plan?: BrandPlan
}

export interface UpdateBrandDTO {
  name?: string
  phone?: string
  logo?: string
  status?: BrandStatus
  plan?: BrandPlan
}

export interface BrandOverview {
  id: string
  name: string
  slug: string
  logo?: string
  status: BrandStatus
  plan: BrandPlan
  productCount: number
  activeCampaigns: number
  totalScans: number
  monthlyScans: number
  fraudRate: number
}
