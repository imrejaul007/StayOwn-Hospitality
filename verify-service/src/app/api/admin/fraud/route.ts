import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.success || auth.user!.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const brandId = searchParams.get('brandId')
    const resolved = searchParams.get('resolved')
    const severity = searchParams.get('severity')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const where: any = {}
    if (brandId) where.brandId = brandId
    if (resolved !== null) where.resolved = resolved === 'true'
    if (severity) where.severity = severity

    const [flags, total] = await Promise.all([
      prisma.fraudFlag.findMany({
        where,
        include: {
          brand: { select: { id: true, name: true } },
          serial: { select: { serialNumber: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.fraudFlag.count({ where }),
    ])

    return NextResponse.json({ flags, total, limit, offset })
  } catch (error) {
    console.error('Get fraud flags error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
