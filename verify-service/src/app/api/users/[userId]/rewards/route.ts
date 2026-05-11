import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { getUserRewardSummary } from '@/lib/rewards/calculator'
import { getBrandCoinBalance } from '@/lib/rewards/brandCoins'

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.success) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (auth.user!.userId !== params.userId && auth.user!.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const brandId = searchParams.get('brandId')

    if (brandId) {
      const [summary, balance] = await Promise.all([
        getUserRewardSummary(params.userId, brandId),
        getBrandCoinBalance(params.userId, brandId),
      ])

      return NextResponse.json({ summary, balance })
    }

    const rewards = await prisma.reward.groupBy({
      by: ['brandId'],
      where: { userId: params.userId },
      _sum: { amount: true },
    })

    const brandSummaries = await Promise.all(
      rewards.map(async (r) => {
        const summary = await getUserRewardSummary(params.userId, r.brandId)
        const balance = await getBrandCoinBalance(params.userId, r.brandId)
        return {
          brandId: r.brandId,
          summary,
          balance,
        }
      })
    )

    return NextResponse.json({ brands: brandSummaries })
  } catch (error) {
    console.error('Get rewards error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
