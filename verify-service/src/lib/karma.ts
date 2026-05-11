/**
 * Karma Integration for ReZ Verify
 *
 * Records product verification events as karma signals (qr_in)
 * to build user engagement scores and unlock perks.
 */

const KARMA_API_URL = process.env.KARMA_API_URL || 'http://localhost:4001'

export interface KarmaVerifyPayload {
  userId: string
  eventId: string // In verify context: serial verification event
  mode: 'qr' | 'gps'
  qrCode?: string
  gpsCoords?: {
    lat: number
    lng: number
  }
  metadata?: {
    serialId: string
    brandId: string
    productId: string
    scanType: 'product_verify'
  }
}

export interface KarmaResult {
  success: boolean
  karmaEarned?: number
  newTotal?: number
  level?: string
  error?: string
}

/**
 * Record product verification to karma service
 * Maps to qr_in signal for engagement scoring
 */
export async function recordProductVerification(
  userId: string,
  brandId: string,
  productId: string,
  serialId: string,
  location?: { lat: number; lng: number }
): Promise<KarmaResult> {
  try {
    const eventId = `verify:${serialId}`

    const payload: KarmaVerifyPayload = {
      userId,
      eventId,
      mode: location ? 'gps' : 'qr',
      qrCode: undefined, // Product verify doesn't use event QR
      gpsCoords: location,
      metadata: {
        serialId,
        brandId,
        productId,
        scanType: 'product_verify',
      },
    }

    const response = await fetch(`${KARMA_API_URL}/api/karma/verify/checkin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Key': process.env.INTERNAL_SERVICE_KEY || '',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      return {
        success: false,
        error: error.message || 'Karma service unavailable',
      }
    }

    const result = await response.json()

    return {
      success: true,
      karmaEarned: result.karmaEarned,
      newTotal: result.totalKarma,
      level: result.level,
    }
  } catch (error) {
    console.error('Karma record error:', error)
    // Don't fail verification if karma is unavailable
    return {
      success: false,
      error: 'Karma service unavailable',
    }
  }
}

/**
 * Get user's karma profile for verification context
 */
export async function getKarmaProfile(userId: string): Promise<{
  success: boolean
  profile?: {
    totalKarma: number
    level: string
    verificationCount: number
  }
  error?: string
}> {
  try {
    const response = await fetch(`${KARMA_API_URL}/api/karma/user/${userId}`, {
      headers: {
        'X-Service-Key': process.env.INTERNAL_SERVICE_KEY || '',
      },
    })

    if (!response.ok) {
      return { success: false, error: 'Failed to fetch karma profile' }
    }

    const data = await response.json()
    return {
      success: true,
      profile: {
        totalKarma: data.totalKarma || data.activeKarma || 0,
        level: data.level || 'bronze',
        verificationCount: data.verificationCount || 0,
      },
    }
  } catch (error) {
    console.error('Karma profile error:', error)
    return { success: false, error: 'Karma service unavailable' }
  }
}

/**
 * Check if user qualifies for bonus rewards based on karma level
 */
export async function getKarmaMultiplier(userId: string): Promise<{
  multiplier: number
  tier: string
}> {
  try {
    const profile = await getKarmaProfile(userId)
    if (!profile.success || !profile.profile) {
      return { multiplier: 1.0, tier: 'default' }
    }

    // Karma multipliers based on tier
    const tierMultipliers: Record<string, number> = {
      bronze: 1.0,
      silver: 1.25,
      gold: 1.5,
      platinum: 2.0,
    }

    return {
      multiplier: tierMultipliers[profile.profile.level] || 1.0,
      tier: profile.profile.level,
    }
  } catch {
    return { multiplier: 1.0, tier: 'default' }
  }
}
