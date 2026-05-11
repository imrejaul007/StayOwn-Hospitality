import prisma from '../db'
import { FraudCheckContext, FraudCheckResult, FraudRule, FraudRuleResult, fraudRules } from './rules'
import {
  aggregateResults,
  calculateVelocityScore,
  calculateDistanceScore,
  calculatePatternScore,
  normalizeScore,
} from './scoring'

const VELOCITY_WINDOW_MINUTES = 60
const MAX_SCAN_VELOCITY = 10

export async function runFraudCheck(context: FraudCheckContext): Promise<FraudCheckResult> {
  const ruleResults: FraudRuleResult[] = []
  const ruleMetadata = new Map<string, { id: string; name: string; severity: string }>()

  fraudRules.forEach((rule) => {
    ruleMetadata.set(rule.id, {
      id: rule.id,
      name: rule.name,
      severity: rule.severity,
    })
  })

  const velocityResult = await checkVelocity(context)
  if (velocityResult.triggered) {
    ruleResults.push(velocityResult)
  }

  const impossibleTravelResult = await checkImpossibleTravel(context)
  if (impossibleTravelResult.triggered) {
    ruleResults.push(impossibleTravelResult)
  }

  const multiUserResult = await checkMultiUserSerial(context)
  if (multiUserResult.triggered) {
    ruleResults.push(multiUserResult)
  }

  const vpnResult = await checkVPNProxy(context)
  if (vpnResult.triggered) {
    ruleResults.push(vpnResult)
  }

  const gpsResult = await checkGPSSpoofing(context)
  if (gpsResult.triggered) {
    ruleResults.push(gpsResult)
  }

  const patternResult = await checkPattern(context)
  if (patternResult.triggered) {
    ruleResults.push(patternResult)
  }

  const result = aggregateResults(ruleResults, ruleMetadata)

  if (result.decision !== 'ALLOW') {
    await createFraudFlag(context, result)
  }

  return result
}

async function checkVelocity(context: FraudCheckContext): Promise<FraudRuleResult> {
  try {
    const windowStart = new Date(Date.now() - VELOCITY_WINDOW_MINUTES * 60 * 1000)

    const recentScans = await prisma.scan.count({
      where: {
        serialId: context.serialId,
        createdAt: { gte: windowStart },
      },
    })

    const timeWindowMinutes = VELOCITY_WINDOW_MINUTES
    const score = calculateVelocityScore(recentScans + 1, timeWindowMinutes)

    return {
      triggered: score > 30,
      reason: score > 30 ? `High scan velocity: ${recentScans + 1} scans in ${timeWindowMinutes} minutes` : undefined,
      score,
      metadata: {
        ruleId: 'velocity',
        ruleName: 'Velocity Check',
        severity: score > 60 ? 'HIGH' : 'MEDIUM',
        scanCount: recentScans + 1,
        timeWindow: timeWindowMinutes,
      },
    }
  } catch (error) {
    console.error('Velocity check error:', error)
    return { triggered: false, score: 0 }
  }
}

async function checkImpossibleTravel(context: FraudCheckContext): Promise<FraudRuleResult> {
  if (!context.location) {
    return { triggered: false, score: 0 }
  }

  try {
    const lastScan = await prisma.scan.findFirst({
      where: {
        serialId: context.serialId,
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!lastScan || !lastScan.location) {
      return { triggered: false, score: 0 }
    }

    const lastLocation = lastScan.location as { lat: number; lng: number }
    const timeDiffMinutes = (Date.now() - lastScan.createdAt.getTime()) / (1000 * 60)

    const score = calculateDistanceScore(
      lastLocation.lat,
      lastLocation.lng,
      context.location.lat,
      context.location.lng,
      timeDiffMinutes
    )

    return {
      triggered: score > 50,
      reason: score > 50 ? 'Impossible travel detected' : undefined,
      score,
      metadata: {
        ruleId: 'impossible_travel',
        ruleName: 'Impossible Travel',
        severity: score > 80 ? 'CRITICAL' : 'HIGH',
        distance: { from: lastLocation, to: context.location },
        timeDiffMinutes,
      },
    }
  } catch (error) {
    console.error('Impossible travel check error:', error)
    return { triggered: false, score: 0 }
  }
}

async function checkMultiUserSerial(context: FraudCheckContext): Promise<FraudRuleResult> {
  if (!context.userId) {
    return { triggered: false, score: 0 }
  }

  try {
    const firstScan = await prisma.scan.findFirst({
      where: {
        serialId: context.serialId,
        userId: { not: null },
      },
      orderBy: { createdAt: 'asc' },
    })

    if (!firstScan || firstScan.userId === context.userId) {
      return { triggered: false, score: 0 }
    }

    const otherUserScans = await prisma.scan.findMany({
      where: {
        serialId: context.serialId,
        userId: { not: context.userId },
      },
      select: { userId: true },
    })

    const uniqueUsers = new Set(otherUserScans.map((s) => s.userId)).size

    if (uniqueUsers > 0) {
      return {
        triggered: true,
        reason: `Serial scanned by ${uniqueUsers + 1} different users`,
        score: 70,
        metadata: {
          ruleId: 'multi_user',
          ruleName: 'Multi-User Serial',
          severity: 'HIGH',
          userCount: uniqueUsers + 1,
        },
      }
    }

    return { triggered: false, score: 0 }
  } catch (error) {
    console.error('Multi-user check error:', error)
    return { triggered: false, score: 0 }
  }
}

async function checkVPNProxy(context: FraudCheckContext): Promise<FraudRuleResult> {
  return { triggered: false, score: 0 }
}

async function checkGPSSpoofing(context: FraudCheckContext): Promise<FraudRuleResult> {
  if (!context.fingerprint) {
    return { triggered: false, score: 0 }
  }

  const spoofingIndicators: string[] = []
  const fp = context.fingerprint as { gpsAccuracy?: number; altitude?: number }

  if (fp.gpsAccuracy && fp.gpsAccuracy > 1000) {
    spoofingIndicators.push('low_accuracy')
  }

  if (fp.altitude && fp.altitude < -500) {
    spoofingIndicators.push('invalid_altitude')
  }

  if (spoofingIndicators.length > 0) {
    return {
      triggered: true,
      reason: 'GPS spoofing indicators detected',
      score: 60,
      metadata: {
        ruleId: 'gps_spoofing',
        ruleName: 'GPS Spoofing',
        severity: 'MEDIUM',
        indicators: spoofingIndicators,
      },
    }
  }

  return { triggered: false, score: 0 }
}

async function checkPattern(context: FraudCheckContext): Promise<FraudRuleResult> {
  try {
    const recentScans = await prisma.scan.findMany({
      where: {
        serialId: context.serialId,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      select: {
        deviceId: true,
        userId: true,
        ipAddress: true,
      },
    })

    if (recentScans.length < 5) {
      return { triggered: false, score: 0 }
    }

    const deviceIds = recentScans.map((s) => s.deviceId).filter(Boolean) as string[]
    const userIds = recentScans.map((s) => s.userId).filter(Boolean) as string[]
    const ipAddresses = recentScans.map((s) => s.ipAddress).filter(Boolean) as string[]

    if (context.deviceId) deviceIds.push(context.deviceId)
    if (context.userId) userIds.push(context.userId)
    if (context.ipAddress) ipAddresses.push(context.ipAddress)

    const score = calculatePatternScore(deviceIds, userIds, ipAddresses)

    return {
      triggered: score > 40,
      reason: score > 40 ? 'Suspicious pattern detected' : undefined,
      score,
      metadata: {
        ruleId: 'pattern',
        ruleName: 'Suspicious Pattern',
        severity: score > 60 ? 'HIGH' : 'MEDIUM',
        uniqueDevices: new Set(deviceIds).size,
        uniqueUsers: new Set(userIds).size,
        uniqueIPs: new Set(ipAddresses).size,
      },
    }
  } catch (error) {
    console.error('Pattern check error:', error)
    return { triggered: false, score: 0 }
  }
}

async function createFraudFlag(
  context: FraudCheckContext,
  result: FraudCheckResult
): Promise<void> {
  try {
    const severityOrder = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
    const maxSeverityIndex = result.triggeredRules.reduce((max, rule) => {
      const idx = severityOrder.indexOf(rule.severity)
      return idx > max ? idx : max
    }, 0)

    const reasons = result.triggeredRules.map((r) => r.reason)
    const reason = reasons.includes('HIGH') || reasons.includes('CRITICAL')
      ? 'SUSPICIOUS_PATTERN'
      : 'VELOCITY_EXCEEDED'

    await prisma.fraudFlag.create({
      data: {
        serialId: context.serialId,
        brandId: context.brandId,
        reason: reason as any,
        severity: severityOrder[maxSeverityIndex] as any,
        details: {
          score: result.totalScore,
          decision: result.decision,
          triggeredRules: result.triggeredRules,
          context: {
            userId: context.userId,
            deviceId: context.deviceId,
            ipAddress: context.ipAddress,
          },
        },
      },
    })

    await prisma.serial.update({
      where: { id: context.serialId },
      data: { status: 'FLAGGED' },
    })
  } catch (error) {
    console.error('Error creating fraud flag:', error)
  }
}

export function registerCustomRule(rule: FraudRule): void {
  fraudRules.push(rule)
}
