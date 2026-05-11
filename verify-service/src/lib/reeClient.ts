/**
 * REE Client for Verify Service
 *
 * Connects to REE for:
 * - Karma scoring
 * - Fraud detection
 * - Feature flags
 * - Cashback/reward calculation
 */

const REE_URL = process.env.REE_URL || 'http://localhost:4000/api'

export interface REEVerifyResult {
  success: boolean
  verified: boolean
  fraud: {
    isFraud: boolean
    riskScore: number
    action: 'allow' | 'flag' | 'block'
  }
  rewards: {
    coinType: 'rez'
    amount: number
  }
  karma: {
    earned: number
    total: number
    multiplier: number
    tier: string
  }
}

/**
 * Full REE verification check
 */
export async function verifyWithREE(
  userId: string,
  brandId: string,
  productId: string,
  serialId: string,
  location?: { lat: number; lng: number }
): Promise<REEVerifyResult> {
  const payload = {
    eventType: 'qr.verified',
    source: 'verify-service',
    userId,
    data: {
      brandId,
      productId,
      serialId,
      location,
    },
  }

  try {
    // 1. Fraud check + reward calculation
    const response = await fetch(`${REE_URL}/query/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: 'qr_verify',
        context: {
          user: { id: userId },
          event: { type: 'qr.verified' },
          transaction: { brandId, productId, serialId },
        },
      }),
    })

    if (!response.ok) {
      return {
        success: false,
        verified: false,
        fraud: { isFraud: false, riskScore: 0, action: 'allow' },
        rewards: { coinType: 'rez', amount: 0 },
        karma: { earned: 0, total: 0, multiplier: 1, tier: 'starter' },
      }
    }

    const data = await response.json()

    return {
      success: true,
      verified: true,
      fraud: data.fraudResult || { isFraud: false, riskScore: 0, action: 'allow' },
      rewards: {
        coinType: 'rez',
        amount: data.rewards?.amount || 50,
      },
      karma: {
        earned: data.karmaEarned || 5,
        total: data.karmaTotal || 0,
        multiplier: data.multiplier || 1,
        tier: data.tier || 'starter',
      },
    }
  } catch (error) {
    console.error('[REE Client] Verify error:', error)
    return {
      success: false,
      verified: false,
      fraud: { isFraud: false, riskScore: 0, action: 'allow' },
      rewards: { coinType: 'rez', amount: 50 },
      karma: { earned: 5, total: 0, multiplier: 1, tier: 'starter' },
    }
  }
}

/**
 * Record verification event to REE
 */
export async function recordVerificationEvent(
  userId: string,
  brandId: string,
  productId: string,
  serialId: string,
  verified: boolean,
  location?: { lat: number; lng: number }
): Promise<void> {
  try {
    await fetch(`${REE_URL}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType: verified ? 'qr.verified' : 'qr.fraud_detected',
        source: 'verify-service',
        userId,
        data: {
          brandId,
          productId,
          serialId,
          location,
        },
      }),
    })
  } catch (error) {
    console.error('[REE Client] Event record error:', error)
  }
}

/**
 * Get user karma multiplier from REE
 */
export async function getKarmaMultiplier(
  userId: string
): Promise<{ multiplier: number; tier: string }> {
  try {
    const response = await fetch(`${REE_URL}/query/karma`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        baseKarma: 5,
        userTier: 'L1',
      }),
    })

    if (!response.ok) {
      return { multiplier: 1, tier: 'starter' }
    }

    const data = await response.json()

    return {
      multiplier: data.rewardMultiplier || 1,
      tier: data.tier || 'starter',
    }
  } catch (error) {
    return { multiplier: 1, tier: 'starter' }
  }
}

/**
 * Check if user can earn rewards
 */
export async function canEarnRewards(
  userId: string,
  brandId: string
): Promise<{ canEarn: boolean; reason?: string }> {
  try {
    const response = await fetch(`${REE_URL}/query/features/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        features: ['canEarnRez', 'hasExclusiveEvents'],
      }),
    })

    if (!response.ok) {
      return { canEarn: true }
    }

    const data = await response.json()

    if (!data.features?.canEarnRez) {
      return { canEarn: false, reason: 'Feature disabled for user tier' }
    }

    return { canEarn: true }
  } catch (error) {
    return { canEarn: true }
  }
}
