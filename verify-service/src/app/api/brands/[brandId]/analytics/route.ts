import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { getScanCount, getUniqueUsers, getFraudStats, getEngagementMetrics } from '@/lib/analytics/tracker'

export async function GET(
  request: NextRequest,
  { params }: { params: { brandId: string } }
) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.success) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')!)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const endDate = searchParams.get('endDate')
      ? new Date(searchParams.get('endDate')!)
      : new Date()

    const [totalScans, uniqueUsers, fraudStats, engagement] = await Promise.all([
      getScanCount(params.brandId, { startDate, endDate }),
      getUniqueUsers(params.brandId, { startDate, endDate }),
      getFraudStats(params.brandId, { startDate, endDate }),
      getEngagementMetrics(params.brandId, { startDate, endDate, groupBy: 'day' }),
    ])

    const totalRewards = await prisma.reward.aggregate({
      where: {
        brandId: params.brandId,
        createdAt: { gte: startDate, lte: endDate },
      },
      _sum: { amount: true },
    })

    return NextResponse.json({
      period: { start: startDate, end: endDate },
      summary: {
        totalScans,
        uniqueUsers,
        avgScansPerUser: uniqueUsers > 0 ? totalScans / uniqueUsers : 0,
        fraudRate: fraudStats.fraudRate,
        totalRewards: totalRewards._sum.amount || 0,
      },
      fraud: fraudStats,
      trends: engagement,
    })
  } catch (error) {
    console.error('Brand analytics error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
