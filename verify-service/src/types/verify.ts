export interface VerifyRequest {
  serialNumber: string
  signature?: string
  userId?: string
  deviceId?: string
  ipAddress?: string
  userAgent?: string
  location?: {
    lat: number
    lng: number
    accuracy?: number
  }
  fingerprint?: Record<string, unknown>
}

export interface VerifyResponse {
  success: boolean
  valid: boolean
  serial?: string
  product?: {
    id: string
    name: string
    description?: string
    image?: string
    category?: string
  }
  brand?: {
    id: string
    name: string
    logo?: string
  }
  isGenuine?: boolean
  scanCount?: number
  firstScanAt?: string | null
  status?: string
  ownership?: {
    userId: string
    scannedAt: string
    isOwner: boolean
  }
  reward?: {
    amount: number
    coinType: 'BRANDED' | 'REZ'
    campaignName?: string
  }
  fraud?: {
    score: number
    decision: 'ALLOW' | 'FLAG' | 'BLOCK'
    reasons?: string[]
  }
  error?: string
}

export interface VerificationContext {
  serialId: string
  brandId: string
  userId?: string
  deviceId?: string
  ipAddress?: string
  location?: {
    lat: number
    lng: number
    accuracy?: number
  }
  timestamp: Date
}
