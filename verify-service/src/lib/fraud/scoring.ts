import { FraudCheckResult, FraudRuleResult } from './rules'

export interface ScoringConfig {
  allowThreshold: number
  flagThreshold: number
  blockThreshold: number
}

const DEFAULT_CONFIG: ScoringConfig = {
  allowThreshold: 30,
  flagThreshold: 60,
  blockThreshold: 85,
}

export function calculateScore(ruleResults: FraudRuleResult[]): number {
  return ruleResults.reduce((total, result) => {
    if (result.triggered) {
      return total + result.score
    }
    return total
  }, 0)
}

export function determineDecision(
  score: number,
  config: ScoringConfig = DEFAULT_CONFIG
): 'ALLOW' | 'FLAG' | 'BLOCK' {
  if (score >= config.blockThreshold) {
    return 'BLOCK'
  }
  if (score >= config.flagThreshold) {
    return 'FLAG'
  }
  return 'ALLOW'
}

export function aggregateResults(
  ruleResults: FraudRuleResult[],
  ruleMetadata: Map<string, { id: string; name: string; severity: string }>
): FraudCheckResult {
  const triggeredRules = ruleResults
    .filter((r) => r.triggered)
    .map((r) => {
      const meta = ruleMetadata.get(r.metadata?.ruleId as string)
      return {
        ruleId: r.metadata?.ruleId as string || 'unknown',
        ruleName: meta?.name || r.metadata?.ruleName as string || 'Unknown Rule',
        reason: r.reason || 'Rule triggered',
        score: r.score,
        severity: meta?.severity || r.metadata?.severity as string || 'MEDIUM',
      }
    })

  const totalScore = calculateScore(ruleResults)
  const decision = determineDecision(totalScore)

  return {
    totalScore,
    decision,
    triggeredRules,
    metadata: {
      ruleCount: ruleResults.length,
      triggeredCount: triggeredRules.length,
      timestamp: new Date().toISOString(),
    },
  }
}

export function calculateVelocityScore(
  scanCount: number,
  timeWindowMinutes: number
): number {
  if (timeWindowMinutes <= 0) return 100

  const scansPerMinute = scanCount / timeWindowMinutes

  if (scansPerMinute > 10) return 100
  if (scansPerMinute > 5) return 80
  if (scansPerMinute > 2) return 60
  if (scansPerMinute > 1) return 40
  if (scansPerMinute > 0.5) return 20

  return 0
}

export function calculateDistanceScore(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  timeDiffMinutes: number
): number {
  const distance = haversineDistance(lat1, lng1, lat2, lng2)

  const maxPossibleSpeedKmH = 1000
  const requiredSpeed = distance / (timeDiffMinutes / 60)

  if (timeDiffMinutes <= 0) return 100
  if (requiredSpeed > maxPossibleSpeedKmH) return 100

  if (requiredSpeed > 500) return 80
  if (requiredSpeed > 200) return 60
  if (requiredSpeed > 100) return 40
  if (requiredSpeed > 50) return 20

  return 0
}

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180)
}

export function calculatePatternScore(
  deviceIds: string[],
  userIds: string[],
  ipAddresses: string[]
): number {
  let score = 0

  const uniqueDevices = new Set(deviceIds).size
  const uniqueUsers = new Set(userIds).size
  const uniqueIPs = new Set(ipAddresses).size

  if (uniqueUsers > 1) {
    score += 30
  }

  if (uniqueIPs > 5) {
    score += 25
  }

  if (uniqueDevices > 3) {
    score += 20
  }

  return Math.min(score, 100)
}

export function normalizeScore(score: number, maxScore = 100): number {
  return Math.min(Math.max(score, 0), maxScore)
}
