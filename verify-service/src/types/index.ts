export type BrandStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED'
export type BrandPlan = 'STARTER' | 'GROWTH' | 'ENTERPRISE'

export interface Brand {
  id: string
  name: string
  slug: string
  email: string
  phone?: string
  logo?: string
  status: BrandStatus
  plan: BrandPlan
  createdAt: Date
  updatedAt: Date
}

export interface CreateBrandInput {
  name: string
  slug: string
  email: string
  phone?: string
  logo?: string
  plan?: BrandPlan
}

export interface UpdateBrandInput {
  name?: string
  phone?: string
  logo?: string
  status?: BrandStatus
  plan?: BrandPlan
}

export interface BrandCoinSettings {
  id: string
  brandId: string
  coinName: string
  coinSymbol: string
  valuePerCoin: number
  minRedeem: number
  expiryDays: number
  allowRedemption: boolean
  allowConversion: boolean
}
