/**
 * ReZ Mind Integration for ReZ Verify
 *
 * Captures product verification intent signals and provides
 * personalized recommendations based on verification history.
 */

const MIND_URL = process.env.REZ_MIND_URL || 'http://localhost:4008'
const INTENT_CAPTURE_URL = process.env.INTENT_CAPTURE_URL || 'https://rez-intent-graph.onrender.com'

export interface ProductVerifyIntent {
  userId: string
  brandId: string
  productId: string
  serialId: string
  brandName: string
  productName: string
  category: string
  location?: {
    lat: number
    lng: number
    city?: string
    country?: string
  }
  timestamp: Date
}

/**
 * Send product verification event to ReZ Mind
 */
export async function sendVerificationToMind(intent: ProductVerifyIntent): Promise<void> {
  try {
    // Send to event platform webhook
    await fetch(`${MIND_URL}/webhook/consumer/verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'product_verified',
        user_id: intent.userId,
        brand_id: intent.brandId,
        product_id: intent.productId,
        serial_id: intent.serialId,
        brand_name: intent.brandName,
        product_name: intent.productName,
        category: intent.category,
        location: intent.location,
        source: 'rez-verify',
        timestamp: intent.timestamp.toISOString(),
      }),
    })
  } catch (error) {
    console.error('Mind webhook error:', error)
    // Fire-and-forget, don't fail verification
  }
}

/**
 * Capture verification intent to intent graph
 */
export async function captureVerificationIntent(
  userId: string,
  brandId: string,
  productId: string,
  serialId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await fetch(`${INTENT_CAPTURE_URL}/api/intent/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        appType: 'verify',
        event: 'product_verified',
        intentKey: `verify_${brandId}_${productId}`,
        metadata: {
          brandId,
          productId,
          serialId,
          ...metadata,
        },
      }),
    })
  } catch (error) {
    console.error('Intent capture error:', error)
    // Fire-and-forget, don't fail verification
  }
}

/**
 * Get product recommendations based on verification history
 */
export async function getRecommendations(
  userId: string,
  limit: number = 5
): Promise<{
  success: boolean
  recommendations?: Array<{
    brandId: string
    brandName: string
    productId: string
    productName: string
    reason: string
  }>
  error?: string
}> {
  try {
    const response = await fetch(
      `${MIND_URL}/api/recommendations/verify?userId=${userId}&limit=${limit}`,
      {
        headers: {
          'X-Service-Key': process.env.INTERNAL_SERVICE_KEY || '',
        },
      }
    )

    if (!response.ok) {
      return { success: false, error: 'Failed to fetch recommendations' }
    }

    const data = await response.json()
    return {
      success: true,
      recommendations: data.recommendations || [],
    }
  } catch (error) {
    console.error('Recommendations error:', error)
    return { success: false, error: 'Recommendation service unavailable' }
  }
}

/**
 * Send fraud signal to Mind for pattern learning
 */
export async function sendFraudSignalToMind(
  userId: string,
  brandId: string,
  fraudType: string,
  details: Record<string, unknown>
): Promise<void> {
  try {
    await fetch(`${MIND_URL}/webhook/consumer/fraud`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'verification_fraud_attempt',
        user_id: userId,
        brand_id: brandId,
        fraud_type: fraudType,
        details,
        source: 'rez-verify',
        timestamp: new Date().toISOString(),
      }),
    })
  } catch (error) {
    console.error('Fraud signal error:', error)
  }
}

/**
 * Get user verification history for fraud analysis
 */
export async function getVerificationHistory(
  userId: string,
  days: number = 30
): Promise<{
  success: boolean
  history?: Array<{
    timestamp: Date
    brandId: string
    productId: string
    location?: { lat: number; lng: number }
  }>
  error?: string
}> {
  try {
    const response = await fetch(
      `${MIND_URL}/api/verify/history?userId=${userId}&days=${days}`,
      {
        headers: {
          'X-Service-Key': process.env.INTERNAL_SERVICE_KEY || '',
        },
      }
    )

    if (!response.ok) {
      return { success: false, error: 'Failed to fetch history' }
    }

    const data = await response.json()
    return {
      success: true,
      history: data.history || [],
    }
  } catch (error) {
    console.error('History fetch error:', error)
    return { success: false, error: 'History service unavailable' }
  }
}
