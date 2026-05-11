import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/db'
import { validateSerial } from '@/lib/serial/validator'
import { runFraudCheck } from '@/lib/fraud/engine'
import { issueReward } from '@/lib/rewards/issuer'
import { recordOwnership } from '@/lib/ownership/tracker'
import { trackScan } from '@/lib/analytics/tracker'
import { recordProductVerification, getKarmaMultiplier } from '@/lib/karma'
import { sendVerificationToMind, captureVerificationIntent, sendFraudSignalToMind } from '@/lib/mind'
import { logAuditEvent } from '@/lib/auth'

// Correlation ID for request tracing
function getCorrelationId(request: NextRequest): string {
  return request.headers.get('x-correlation-id') || crypto.randomUUID()
}

// Stricter validation schema
const verifySchema = z.object({
  serialNumber: z.string()
    .min(5, 'Serial number too short')
    .max(100, 'Serial number too long')
    .regex(/^[A-Z0-9-_]+$/i, 'Invalid serial number format'),
  signature: z.string().optional(),
  userId: z.string().uuid().optional().or(z.string().max(100).optional()),
  deviceId: z.string().max(255).optional(),
  ipAddress: z.string().ip().optional(),
  userAgent: z.string().max(500).optional(),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    accuracy: z.number().min(0).max(1000).optional(),
  }).optional(),
  fingerprint: z.record(z.unknown()).optional(),
})

export async function POST(request: NextRequest) {
  const correlationId = getCorrelationId(request)

  try {
    const body = await request.json()
    const data = verifySchema.parse(body)

    const validation = await validateSerial(data.serialNumber, data.signature || '')

    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        valid: false,
        error: validation.error,
      }, { status: 400 })
    }

    if (!validation.isGenuine) {
      return NextResponse.json({
        success: false,
        valid: true,
        isGenuine: false,
        error: 'Product authenticity could not be verified',
      }, { status: 200 })
    }

    const fraudCheck = await runFraudCheck({
      serialId: validation.details?.serialId as string,
      serialNumber: data.serialNumber,
      brandId: validation.brandId!,
      userId: data.userId,
      deviceId: data.deviceId,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      location: data.location,
      fingerprint: data.fingerprint,
      timestamp: new Date(),
    })

    const scanId = await trackScan({
      serialId: validation.details?.serialId as string,
      userId: data.userId,
      deviceId: data.deviceId,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      location: data.location,
      fingerprint: data.fingerprint,
      fraudScore: fraudCheck.totalScore,
      fraudDecision: fraudCheck.decision,
    })

    if (fraudCheck.decision === 'BLOCK') {
      // Audit log the fraud block
      logAuditEvent({
        timestamp: new Date(),
        event: 'verification_blocked',
        userId: data.userId,
        brandId: validation.brandId,
        serialId: validation.details?.serialId as string,
        ip: data.ipAddress,
        userAgent: data.userAgent,
        success: false,
        error: 'Fraud detected',
        metadata: {
          fraudScore: fraudCheck.totalScore,
          triggeredRules: fraudCheck.triggeredRules.map(r => r.rule),
          correlationId,
        },
      })

      // Send fraud signal to Mind for pattern learning
      if (data.userId && validation.brandId) {
        sendFraudSignalToMind(
          data.userId,
          validation.brandId,
          'verification_blocked',
          { fraudScore: fraudCheck.totalScore, rules: fraudCheck.triggeredRules }
        ).catch((err) => console.error('[Mind] Fraud signal failed:', err))
      }

      return NextResponse.json({
        success: false,
        valid: true,
        fraud: {
          score: fraudCheck.totalScore,
          decision: fraudCheck.decision,
          reasons: fraudCheck.triggeredRules.map((r) => r.reason),
        },
        error: 'Verification blocked due to suspicious activity',
      }, {
        status: 200,
        headers: {
          'X-Correlation-ID': correlationId,
        },
      })
    }

    if (data.userId && validation.details?.serialId) {
      if (!validation.scanCount || validation.scanCount === 0) {
        await recordOwnership(
          validation.details.serialId as string,
          data.userId,
          new Date(),
          true
        )
      }
    }

    let reward = null
    let karma = null
    let karmaMultiplier = 1.0
    let karmaTier = 'default'

    // Get karma multiplier for bonus rewards
    if (data.userId) {
      const karmaResult = await getKarmaMultiplier(data.userId)
      karmaMultiplier = karmaResult.multiplier
      karmaTier = karmaResult.tier
    }

    if (data.userId && validation.details?.serialId) {
      const rewardResult = await issueReward({
        serialId: validation.details.serialId as string,
        brandId: validation.brandId!,
        userId: data.userId,
        deviceId: data.deviceId,
        ipAddress: data.ipAddress,
        location: data.location,
        timestamp: new Date(),
        scanCount: validation.scanCount,
      })

      if (rewardResult.success) {
        reward = {
          amount: rewardResult.amount,
          coinType: rewardResult.coinType,
        }
      }

      // Record to Karma service (qr_in signal)
      const karmaResult = await recordProductVerification(
        data.userId!,
        validation.brandId!,
        validation.productId!,
        validation.details.serialId as string,
        data.location
      )

      if (karmaResult.success) {
        karma = {
          earned: karmaResult.karmaEarned,
          total: karmaResult.newTotal,
          level: karmaResult.level,
        }
      }
    }

    // Send to Mind (fire-and-forget with proper error handling)
    if (data.userId && validation.brandId) {
      sendVerificationToMind({
        userId: data.userId,
        brandId: validation.brandId,
        productId: validation.productId!,
        serialId: validation.details?.serialId as string,
        brandName: (validation.details?.brandName as string) || '',
        productName: (validation.details?.productName as string) || '',
        category: (validation.details?.category as string) || '',
        location: data.location,
        timestamp: new Date(),
      }).catch((err) => console.error('[Mind] Verification signal failed:', err, { correlationId }))

      captureVerificationIntent(
        data.userId,
        validation.brandId,
        validation.productId!,
        validation.details?.serialId as string,
        { scanCount: validation.scanCount, fraudScore: fraudCheck.totalScore }
      ).catch((err) => console.error('[Mind] Intent capture failed:', err, { correlationId }))
    }

    // Audit log successful verification
    logAuditEvent({
      timestamp: new Date(),
      event: 'verification_success',
      userId: data.userId,
      brandId: validation.brandId,
      serialId: validation.details?.serialId as string,
      ip: data.ipAddress,
      userAgent: data.userAgent,
      success: true,
      metadata: {
        fraudScore: fraudCheck.totalScore,
        correlationId,
      },
    })

    return NextResponse.json({
      success: true,
      valid: true,
      serial: data.serialNumber,
      isGenuine: true,
      product: {
        id: validation.productId,
        name: validation.details?.productName,
      },
      brand: {
        id: validation.brandId,
        name: validation.details?.brandName,
      },
      scanCount: (validation.scanCount || 0) + 1,
      firstScanAt: validation.firstScanAt,
      status: validation.status,
      fraud: {
        score: fraudCheck.totalScore,
        decision: fraudCheck.decision,
        reasons: fraudCheck.triggeredRules.map((r) => r.reason),
      },
      reward,
      karma: karmaTier !== 'default' ? { ...karma, multiplier: karmaMultiplier, tier: karmaTier } : karma,
    }, {
      headers: {
        'X-Correlation-ID': correlationId,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request data',
        details: error.errors,
      }, {
        status: 400,
        headers: {
          'X-Correlation-ID': correlationId,
        },
      })
    }

    console.error('Verify error:', error, { correlationId })
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
    }, {
      status: 500,
      headers: {
        'X-Correlation-ID': correlationId,
      },
    })
  }
}
