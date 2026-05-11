import prisma from '../db'

export interface BrandCoinBalance {
  userId: string
  brandId: string
  balance: number
  lastUpdated: Date
}

export interface CoinTransaction {
  id: string
  userId: string
  brandId: string
  amount: number
  type: 'CREDIT' | 'DEBIT'
  reference: string
  balanceAfter: number
  createdAt: Date
  metadata?: Record<string, unknown>
}

export async function getBrandCoinBalance(
  userId: string,
  brandId: string
): Promise<BrandCoinBalance | null> {
  try {
    const balance = await prisma.reward.aggregate({
      where: {
        userId,
        brandId,
        coinType: 'BRANDED',
      },
      _sum: {
        amount: true,
      },
    })

    const statusBreakdown = await prisma.reward.groupBy({
      by: ['status'],
      where: {
        userId,
        brandId,
        coinType: 'BRANDED',
      },
      _sum: { amount: true },
    })

    let totalEarned = 0
    let totalClaimed = 0
    let totalExpired = 0

    statusBreakdown.forEach((group) => {
      const amount = group._sum.amount || 0
      totalEarned += amount

      switch (group.status) {
        case 'CLAIMED':
          totalClaimed = amount
          break
        case 'EXPIRED':
          totalExpired = amount
          break
      }
    })

    return {
      userId,
      brandId,
      balance: totalEarned - totalClaimed - totalExpired,
      lastUpdated: new Date(),
    }
  } catch (error) {
    console.error('Get balance error:', error)
    return null
  }
}

export async function addBrandedCoins(
  userId: string,
  brandId: string,
  amount: number,
  reference: string,
  metadata?: Record<string, unknown>
): Promise<{ success: boolean; transactionId?: string; error?: string }> {
  try {
    const brandSettings = await prisma.brandCoinSettings.findUnique({
      where: { brandId },
    })

    if (!brandSettings) {
      return { success: false, error: 'Brand coin settings not configured' }
    }

    const existingReward = await prisma.reward.findFirst({
      where: {
        serialId: metadata?.serialId as string,
        userId,
        brandId,
        status: 'CLAIMED',
      },
    })

    if (existingReward) {
      return { success: false, error: 'Coins already credited' }
    }

    const reward = await prisma.reward.create({
      data: {
        serialId: (metadata?.serialId as string) || '',
        campaignId: (metadata?.campaignId as string) || null,
        brandId,
        userId,
        type: 'COINS',
        coinType: 'BRANDED',
        amount,
        status: 'CLAIMED',
        claimedAt: new Date(),
        expiresAt: new Date(Date.now() + (brandSettings.expiryDays || 90) * 24 * 60 * 60 * 1000),
      },
    })

    return {
      success: true,
      transactionId: reward.id,
    }
  } catch (error) {
    console.error('Add branded coins error:', error)
    return { success: false, error: 'Failed to add coins' }
  }
}

export async function deductBrandedCoins(
  userId: string,
  brandId: string,
  amount: number,
  reference: string,
  metadata?: Record<string, unknown>
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  try {
    const currentBalance = await getBrandCoinBalance(userId, brandId)

    if (!currentBalance || currentBalance.balance < amount) {
      return { success: false, error: 'Insufficient balance' }
    }

    const reward = await prisma.reward.create({
      data: {
        serialId: '',
        brandId,
        userId,
        type: 'COINS',
        coinType: 'BRANDED',
        amount: -amount,
        status: 'CLAIMED',
        claimedAt: new Date(),
      },
    })

    const newBalance = await getBrandCoinBalance(userId, brandId)

    return {
      success: true,
      newBalance: newBalance?.balance || 0,
    }
  } catch (error) {
    console.error('Deduct branded coins error:', error)
    return { success: false, error: 'Failed to deduct coins' }
  }
}

export async function getCoinTransactionHistory(
  userId: string,
  brandId: string,
  options?: {
    limit?: number
    offset?: number
    type?: 'CREDIT' | 'DEBIT'
  }
): Promise<{ transactions: CoinTransaction[]; total: number }> {
  try {
    const where = {
      userId,
      brandId,
      coinType: 'BRANDED' as const,
      ...(options?.type && { amount: options.type === 'CREDIT' ? { gte: 0 } : { lt: 0 } }),
    }

    const [transactions, total] = await Promise.all([
      prisma.reward.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 50,
        skip: options?.offset || 0,
      }),
      prisma.reward.count({ where }),
    ])

    return {
      transactions: transactions.map((t) => ({
        id: t.id,
        userId: t.userId,
        brandId: t.brandId,
        amount: Math.abs(t.amount),
        type: t.amount >= 0 ? 'CREDIT' : 'DEBIT',
        reference: t.id,
        balanceAfter: 0,
        createdAt: t.createdAt,
      })),
      total,
    }
  } catch (error) {
    console.error('Transaction history error:', error)
    return { transactions: [], total: 0 }
  }
}

export async function convertBrandedToReZ(
  userId: string,
  brandId: string,
  amount: number,
  rate: number = 0.8
): Promise<{ success: boolean; rezAmount?: number; error?: string }> {
  try {
    const brandSettings = await prisma.brandCoinSettings.findUnique({
      where: { brandId },
    })

    if (!brandSettings?.allowConversion) {
      return { success: false, error: 'Conversion not allowed' }
    }

    const currentBalance = await getBrandCoinBalance(userId, brandId)
    if (!currentBalance || currentBalance.balance < amount) {
      return { success: false, error: 'Insufficient balance' }
    }

    const rezAmount = Math.floor(amount * rate)

    await deductBrandedCoins(userId, brandId, amount, `conversion:to_rez`)

    return {
      success: true,
      rezAmount,
    }
  } catch (error) {
    console.error('Conversion error:', error)
    return { success: false, error: 'Failed to convert coins' }
  }
}
