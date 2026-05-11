export interface FraudRule {
  id: string
  name: string
  description: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  weight: number
  check: (context: FraudCheckContext) => Promise<FraudRuleResult>
}

export interface FraudCheckContext {
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
  timestamp: Date
  previousScans?: Array<{
    createdAt: Date
    ipAddress?: string
    location?: { lat: number; lng: number }
    deviceId?: string
    userId?: string
  }>
}

export interface FraudRuleResult {
  triggered: boolean
  reason?: string
  score: number
  metadata?: Record<string, unknown>
}

export interface FraudCheckResult {
  totalScore: number
  decision: 'ALLOW' | 'FLAG' | 'BLOCK'
  triggeredRules: Array<{
    ruleId: string
    ruleName: string
    reason: string
    score: number
    severity: string
  }>
  metadata: Record<string, unknown>
}

export const fraudRules: FraudRule[] = []

export function registerRule(rule: FraudRule): void {
  const existingIndex = fraudRules.findIndex((r) => r.id === rule.id)
  if (existingIndex >= 0) {
    fraudRules[existingIndex] = rule
  } else {
    fraudRules.push(rule)
  }
}

export function getRule(ruleId: string): FraudRule | undefined {
  return fraudRules.find((r) => r.id === ruleId)
}

export function getRulesBySeverity(severity: FraudRule['severity']): FraudRule[] {
  return fraudRules.filter((r) => r.severity === severity)
}

export function getActiveRules(): FraudRule[] {
  return fraudRules.filter((r) => r.weight > 0)
}
