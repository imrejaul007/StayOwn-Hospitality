import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { getUserOwnerships } from '@/lib/ownership/tracker'
import { getRewardHistory } from '@/lib/rewards/calculator'

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
    const type = searchParams.get('type') || 'all'
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    const result: any = {}

    if (type === 'all' || type === 'ownerships') {
      const ownerships = await getUserOwnerships(params.userId, { limit, offset })
      result.ownerships = ownerships
    }

    if (type === 'all' || type === 'rewards') {
      const rewards = await getRewardHistory(params.userId, 'all', {
        limit,
        offset,
      })
      result.rewards = rewards
    }

    if (type === 'scans') {
      const scans = await prisma.scan.findMany({
        where: { userId: params.userId },
        include: {
          serial: {
            include: {
              product: {
                include: {
                  brand: { select: { name: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      })

      result.scans = scans.map((scan) => ({
        id: scan.id,
        serialNumber: scan.serial.serialNumber,
        productName: scan.serial.product.name,
        brandName: scan.serial.product.brand.name,
        fraudDecision: scan.fraudDecision,
        isRewarded: scan.isRewarded,
        createdAt: scan.createdAt,
      }))
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Get history error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
