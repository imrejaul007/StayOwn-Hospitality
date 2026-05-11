import prisma from '../db'

export interface ScanEvent {
  serialId: string
  userId?: string
  deviceId?: string
  ipAddress?: string
  userAgent?: string
  location?: {
    lat: number
    lng: number
    accuracy?: number
  }
  fingerprint?: Record<string, unknown>
  fraudScore?: number
  fraudDecision?: 'ALLOW' | 'FLAG' | 'BLOCK'
  rewardId?: string
  campaignId?: string
}

export async function trackScan(event: ScanEvent): Promise<string | null> {
  try {
    const scan = await prisma.scan.create({
      data: {
        serialId: event.serialId,
        userId: event.userId,
        deviceId: event.deviceId,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        location: event.location as any,
        fingerprint: event.fingerprint as any,
        fraudScore: event.fraudScore || 0,
        fraudDecision: event.fraudDecision || 'ALLOW',
        isRewarded: !!event.rewardId,
        rewardId: event.rewardId,
        campaignId: event.campaignId,
      },
    })

    await prisma.serial.update({
      where: { id: event.serialId },
      data: {
        scanCount: { increment: 1 },
        lastScannedAt: new Date(),
        ...(event.userId ? { firstScannedAt: new Date() } : {}),
      },
    })

    return scan.id
  } catch (error) {
    console.error('Track scan error:', error)
    return null
  }
}

export async function getScanCount(
  brandId: string,
  options?: {
    startDate?: Date
    endDate?: Date
    productId?: string
  }
): Promise<number> {
  try {
    const where: any = {
      serial: {
        product: {
          brandId,
        },
      },
    }

    if (options?.startDate || options?.endDate) {
      where.createdAt = {}
      if (options.startDate) where.createdAt.gte = options.startDate
      if (options.endDate) where.createdAt.lte = options.endDate
    }

    if (options?.productId) {
      where.serial = {
        ...where.serial,
        productId: options.productId,
      }
    }

    return prisma.scan.count({ where })
  } catch (error) {
    console.error('Get scan count error:', error)
    return 0
  }
}

export async function getUniqueUsers(
  brandId: string,
  options?: {
    startDate?: Date
    endDate?: Date
  }
): Promise<number> {
  try {
    const where: any = {
      serial: {
        product: {
          brandId,
        },
      },
      userId: { not: null },
    }

    if (options?.startDate || options?.endDate) {
      where.createdAt = {}
      if (options.startDate) where.createdAt.gte = options.startDate
      if (options.endDate) where.createdAt.lte = options.endDate
    }

    const result = await prisma.scan.groupBy({
      by: ['userId'],
      where,
    })

    return result.length
  } catch (error) {
    console.error('Get unique users error:', error)
    return 0
  }
}

export async function getFraudStats(
  brandId: string,
  options?: {
    startDate?: Date
    endDate?: Date
  }
): Promise<{
  totalScans: number
  flaggedScans: number
  blockedScans: number
  fraudRate: number
}> {
  try {
    const where: any = {
      serial: {
        product: {
          brandId,
        },
      },
    }

    if (options?.startDate || options?.endDate) {
      where.createdAt = {}
      if (options.startDate) where.createdAt.gte = options.startDate
      if (options.endDate) where.createdAt.lte = options.endDate
    }

    const [total, flagged, blocked] = await Promise.all([
      prisma.scan.count({ where }),
      prisma.scan.count({ where: { ...where, fraudDecision: 'FLAG' } }),
      prisma.scan.count({ where: { ...where, fraudDecision: 'BLOCK' } }),
    ])

    return {
      totalScans: total,
      flaggedScans: flagged,
      blockedScans: blocked,
      fraudRate: total > 0 ? (flagged + blocked) / total : 0,
    }
  } catch (error) {
    console.error('Get fraud stats error:', error)
    return {
      totalScans: 0,
      flaggedScans: 0,
      blockedScans: 0,
      fraudRate: 0,
    }
  }
}

export async function getEngagementMetrics(
  brandId: string,
  options?: {
    startDate?: Date
    endDate?: Date
    groupBy?: 'day' | 'week' | 'month'
  }
): Promise<Array<{
  period: string
  scans: number
  uniqueUsers: number
  rewardsIssued: number
  engagementRate: number
}>> {
  try {
    const where: any = {
      serial: {
        product: {
          brandId,
        },
      },
    }

    if (options?.startDate || options?.endDate) {
      where.createdAt = {}
      if (options.startDate) where.createdAt.gte = options.startDate
      if (options.endDate) where.createdAt.lte = options.endDate
    }

    const scans = await prisma.scan.findMany({
      where,
      select: {
        createdAt: true,
        userId: true,
        isRewarded: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    const grouped = new Map<string, { scans: number; users: Set<string>; rewards: number }>()

    scans.forEach((scan) => {
      const date = new Date(scan.createdAt)
      let key: string

      switch (options?.groupBy) {
        case 'week':
          const weekStart = new Date(date)
          weekStart.setDate(date.getDate() - date.getDay())
          key = weekStart.toISOString().split('T')[0]
          break
        case 'month':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
          break
        default:
          key = date.toISOString().split('T')[0]
      }

      if (!grouped.has(key)) {
        grouped.set(key, { scans: 0, users: new Set(), rewards: 0 })
      }

      const group = grouped.get(key)!
      group.scans++
      if (scan.userId) group.users.add(scan.userId)
      if (scan.isRewarded) group.rewards++
    })

    return Array.from(grouped.entries()).map(([period, data]) => ({
      period,
      scans: data.scans,
      uniqueUsers: data.users.size,
      rewardsIssued: data.rewards,
      engagementRate: data.users.size > 0 ? data.scans / data.users.size : 0,
    }))
  } catch (error) {
    console.error('Get engagement metrics error:', error)
    return []
  }
}

export async function getTopProducts(
  brandId: string,
  options?: {
    limit?: number
    startDate?: Date
    endDate?: Date
  }
): Promise<Array<{
  productId: string
  productName: string
  scanCount: number
  uniqueUsers: number
  engagementRate: number
}>> {
  try {
    const products = await prisma.product.findMany({
      where: { brandId },
      include: {
        serials: {
          select: { id: true },
        },
      },
    })

    const productStats = await Promise.all(
      products.map(async (product) => {
        const where: any = {
          serialId: { in: product.serials.map((s) => s.id) },
        }

        if (options?.startDate || options?.endDate) {
          where.createdAt = {}
          if (options.startDate) where.createdAt.gte = options.startDate
          if (options.endDate) where.createdAt.lte = options.endDate
        }

        const [scans, uniqueUsers] = await Promise.all([
          prisma.scan.count({ where }),
          prisma.scan.groupBy({
            by: ['userId'],
            where: { ...where, userId: { not: null } },
          }),
        ])

        return {
          productId: product.id,
          productName: product.name,
          scanCount: scans,
          uniqueUsers: uniqueUsers.length,
          engagementRate: uniqueUsers.length > 0 ? scans / uniqueUsers.length : 0,
        }
      })
    )

    return productStats
      .sort((a, b) => b.scanCount - a.scanCount)
      .slice(0, options?.limit || 10)
  } catch (error) {
    console.error('Get top products error:', error)
    return []
  }
}
