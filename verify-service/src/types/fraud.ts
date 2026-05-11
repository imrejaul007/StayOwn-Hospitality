export type FraudReason =
  | 'VELOCITY_EXCEEDED'
  | 'IMPOSSIBLE_TRAVEL'
  | 'MULTI_USER_SERIAL'
  | 'VPN_DETECTED'
  | 'PROXY_DETECTED'
  | 'GPS_SPOOFING'
  | 'DEVICE_FINGERPRINT_MISMATCH'
  | 'SUSPICIOUS_PATTERN'
  | 'MANUAL_REVIEW'

export type FraudSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type FraudDecision = 'ALLOW' | 'FLAG' | 'BLOCK'

export interface FraudCheckRequest {
  serialId: string
  serialNumber: string
  brandId: string
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

export interface FraudCheckResult {
  score: number
  decision: FraudDecision
  triggeredRules: FraudRuleTrigger[]
  metadata: Record<string, unknown>
}

export interface FraudRuleTrigger {
  ruleId: string
  ruleName: string
  reason: string
  score: number
  severity: FraudSeverity
}

export interface FraudFlag {
  id: string
  serialId?: string
  brandId: string
  reason: FraudReason
  severity: FraudSeverity
  details?: Record<string, unknown>
  resolved: boolean
  resolvedAt?: Date
  resolvedBy?: string
  resolution?: string
  createdAt: Date
}

export interface FraudSummary {
  totalFlags: number
  unresolvedFlags: number
  byReason: Record<FraudReason, number>
  bySeverity: Record<FraudSeverity, number>
  recentFlags: FraudFlag[]
}

export interface FraudTrend {
  date: string
  flags: number
  blocked: number
  avgScore: number
}
