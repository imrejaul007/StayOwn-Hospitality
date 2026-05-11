import prisma from './db'

const WALLET_API_URL = process.env.WALLET_API_URL || 'http://localhost:3001'

export interface WalletTransaction {
  userId: string
  brandId: string
  amount: number
  type: 'CREDIT' | 'DEBIT'
  coinType: 'BRANDED' | 'REZ'
  reference: string
  metadata?: Record<string, unknown>
}

export interface WalletBalance {
  userId: string
  balances: {
    branded: number
    rez: number
  }
}

export async function creditCoins(
  userId: string,
  brandId: string,
  amount: number,
  coinType: 'BRANDED' | 'REZ',
  reference: string,
  metadata?: Record<string, unknown>
): Promise<{ success: boolean; transactionId?: string; error?: string }> {
  try {
    const response = await fetch(`${WALLET_API_URL}/api/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Key': process.env.INTERNAL_SERVICE_KEY || '',
      },
      body: JSON.stringify({
        userId,
        brandId,
        amount,
        type: 'CREDIT',
        coinType,
        reference,
        metadata,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      return { success: false, error: error.message || 'Failed to credit coins' }
    }

    const result = await response.json()
    return { success: true, transactionId: result.transactionId }
  } catch (error) {
    console.error('Wallet credit error:', error)
    return { success: false, error: 'Wallet service unavailable' }
  }
}

export async function debitCoins(
  userId: string,
  brandId: string,
  amount: number,
  coinType: 'BRANDED' | 'REZ',
  reference: string,
  metadata?: Record<string, unknown>
): Promise<{ success: boolean; transactionId?: string; error?: string }> {
  try {
    const response = await fetch(`${WALLET_API_URL}/api/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Key': process.env.INTERNAL_SERVICE_KEY || '',
      },
      body: JSON.stringify({
        userId,
        brandId,
        amount,
        type: 'DEBIT',
        coinType,
        reference,
        metadata,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      return { success: false, error: error.message || 'Failed to debit coins' }
    }

    const result = await response.json()
    return { success: true, transactionId: result.transactionId }
  } catch (error) {
    console.error('Wallet debit error:', error)
    return { success: false, error: 'Wallet service unavailable' }
  }
}

export async function getBalance(userId: string): Promise<WalletBalance | null> {
  try {
    const response = await fetch(`${WALLET_API_URL}/api/wallets/${userId}/balance`, {
      headers: {
        'X-Service-Key': process.env.INTERNAL_SERVICE_KEY || '',
      },
    })

    if (!response.ok) {
      return null
    }

    const text = await response.text()
    if (!text) {
      return null
    }

    try {
      return JSON.parse(text) as WalletBalance
    } catch {
      console.error('Wallet balance: Invalid JSON response')
      return null
    }
  } catch (error) {
    console.error('Wallet balance error:', error)
    return null
  }
}

export async function checkRedemptionEligibility(
  userId: string,
  brandId: string,
  amount: number
): Promise<{ eligible: boolean; reason?: string }> {
  try {
    const response = await fetch(
      `${WALLET_API_URL}/api/wallets/${userId}/eligibility?brandId=${brandId}&amount=${amount}`,
      {
        headers: {
          'X-Service-Key': process.env.INTERNAL_SERVICE_KEY || '',
        },
      }
    )

    if (!response.ok) {
      return { eligible: false, reason: 'Service unavailable' }
    }

    return response.json()
  } catch (error) {
    console.error('Eligibility check error:', error)
    return { eligible: false, reason: 'Service unavailable' }
  }
}

export async function createRedemption(
  userId: string,
  brandId: string,
  amount: number,
  destination: string,
  destinationType: 'UPI' | 'BANK' | 'VOUCHER'
): Promise<{ success: boolean; redemptionId?: string; error?: string }> {
  try {
    const response = await fetch(`${WALLET_API_URL}/api/redemptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Key': process.env.INTERNAL_SERVICE_KEY || '',
      },
      body: JSON.stringify({
        userId,
        brandId,
        amount,
        destination,
        destinationType,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      return { success: false, error: error.message || 'Failed to create redemption' }
    }

    const result = await response.json()
    return { success: true, redemptionId: result.redemptionId }
  } catch (error) {
    console.error('Redemption error:', error)
    return { success: false, error: 'Redemption service unavailable' }
  }
}
