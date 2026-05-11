import prisma from '../db'
import {
  getScanCount,
  getUniqueUsers,
  getFraudStats,
  getEngagementMetrics,
  getTopProducts,
} from './tracker'

export interface BrandReport {
  brandId: string
  brandName: string
  period: {
    start: Date
    end: Date
  }
  summary: {
    totalScans: number
    uniqueUsers: number
    avgScansPerUser: number
    fraudRate: number
    totalRewards: number
  }
  trends: Array<{
    date: string
    scans: number
    users: number
    rewards: number
  }>
  topProducts: Array<{
    productId: string
    productName: string
    scans: number
  }>
  fraudBreakdown: {
    flagged: number
    blocked: number
    allowed: number
  }
  locationData?: Array<{
    lat: number
    lng: number
    count: number
  }>
}

export interface ProductReport {
  productId: string
  productName: string
  brandId: string
  period: {
    start: Date
    end: Date
  }
  summary: {
    totalSerials: number
    activeSerials: number
    scannedSerials: number
    scanRate: number
    uniqueUsers: number
  }
  scanDistribution: Array<{
    scanCount: number
    serialCount: number
  }>
  timeline: Array<{
    date: string
    scans: number
    newUsers: number
  }>
}

export async function generateBrandReport(
  brandId: string,
  startDate: Date,
  endDate: Date
): Promise<BrandReport | null> {
  try {
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
    })

    if (!brand) return null

    const [totalScans, uniqueUsers, fraudStats, engagement, top] = await Promise.all([
      getScanCount(brandId, { startDate, endDate }),
      getUniqueUsers(brandId, { startDate, endDate }),
      getFraudStats(brandId, { startDate, endDate }),
      getEngagementMetrics(brandId, { startDate, endDate, groupBy: 'day' }),
      getTopProducts(brandId, { limit: 5, startDate, endDate }),
    ])

    const totalRewards = await prisma.reward.aggregate({
      where: {
        brandId,
        createdAt: { gte: startDate, lte: endDate },
        status: { in: ['PENDING', 'CLAIMED'] },
      },
      _sum: { amount: true },
    })

    return {
      brandId,
      brandName: brand.name,
      period: { start: startDate, end: endDate },
      summary: {
        totalScans,
        uniqueUsers,
        avgScansPerUser: uniqueUsers > 0 ? totalScans / uniqueUsers : 0,
        fraudRate: fraudStats.fraudRate,
        totalRewards: totalRewards._sum.amount || 0,
      },
      trends: engagement.map((e) => ({
        date: e.period,
        scans: e.scans,
        users: e.uniqueUsers,
        rewards: e.rewardsIssued,
      })),
      topProducts: top.map((p) => ({
        productId: p.productId,
        productName: p.productName,
        scans: p.scanCount,
      })),
      fraudBreakdown: {
        flagged: fraudStats.flaggedScans,
        blocked: fraudStats.blockedScans,
        allowed: totalScans - fraudStats.flaggedScans - fraudStats.blockedScans,
      },
    }
  } catch (error) {
    console.error('Generate brand report error:', error)
    return null
  }
}

export async function generateProductReport(
  productId: string,
  startDate: Date,
  endDate: Date
): Promise<ProductReport | null> {
  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        serials: {
          select: { id: true },
        },
      },
    })

    if (!product) return null

    const serialIds = product.serials.map((s) => s.id)

    const [totalScans, uniqueUsers, serialsStats] = await Promise.all([
      prisma.scan.count({
        where: {
          serialId: { in: serialIds },
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
      prisma.scan.groupBy({
        by: ['userId'],
        where: {
          serialId: { in: serialIds },
          userId: { not: null },
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
      prisma.serial.groupBy({
        by: ['status'],
        where: { productId },
        _count: true,
      }),
    ])

    const activeSerials = serialsStats.find((s) => s.status === 'ACTIVE')?._count || 0
    const scannedSerials = serialsStats
      .filter((s) => ['SCANNED_FIRST', 'MULTI_SCAN'].includes(s.status))
      .reduce((sum, s) => sum + s._count, 0)

    return {
      productId,
      productName: product.name,
      brandId: product.brandId,
      period: { start: startDate, end: endDate },
      summary: {
        totalSerials: product.serials.length,
        activeSerials,
        scannedSerials,
        scanRate: product.serials.length > 0 ? scannedSerials / product.serials.length : 0,
        uniqueUsers: uniqueUsers.length,
      },
      scanDistribution: [],
      timeline: [],
    }
  } catch (error) {
    console.error('Generate product report error:', error)
    return null
  }
}

export interface ExecutiveSummary {
  totalBrands: number
  totalScans: number
  totalUsers: number
  totalRewards: number
  fraudRate: number
  topBrands: Array<{
    brandId: string
    brandName: string
    scans: number
    growth: number
  }>
  fraudAlerts: number
  recentActivity: Array<{
    type: string
    brandId: string
    brandName: string
    timestamp: Date
    details: string
  }>
}

export async function generateExecutiveSummary(): Promise<ExecutiveSummary> {
  try {
    const [totalBrands, totalScans, fraudStats, recentScans, recentFlags] = await Promise.all([
      prisma.brand.count({ where: { status: 'ACTIVE' } }),
      prisma.scan.count(),
      getFraudStats(''),
      prisma.scan.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          serial: {
            include: {
              product: {
                include: {
                  brand: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      }),
      prisma.fraudFlag.findMany({
        where: { resolved: false },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          brand: { select: { id: true, name: true } },
        },
      }),
    ])

    const totalRewards = await prisma.reward.aggregate({
      _sum: { amount: true },
    })

    const totalUsers = await prisma.scan.groupBy({
      by: ['userId'],
      where: { userId: { not: null } },
    })

    const recentActivity = [
      ...recentScans.map((s) => ({
        type: 'scan' as const,
        brandId: s.serial.product.brand.id,
        brandName: s.serial.product.brand.name,
        timestamp: s.createdAt,
        details: `New scan on ${s.serial.serialNumber}`,
      })),
      ...recentFlags.map((f) => ({
        type: 'fraud' as const,
        brandId: f.brand.id,
        brandName: f.brand.name,
        timestamp: f.createdAt,
        details: `Fraud alert: ${f.reason}`,
      })),
    ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

    return {
      totalBrands,
      totalScans,
      totalUsers: totalUsers.length,
      totalRewards: totalRewards._sum.amount || 0,
      fraudRate: fraudStats.fraudRate,
      topBrands: [],
      fraudAlerts: recentFlags.length,
      recentActivity: recentActivity.slice(0, 10),
    }
  } catch (error) {
    console.error('Generate executive summary error:', error)
    return {
      totalBrands: 0,
      totalScans: 0,
      totalUsers: 0,
      totalRewards: 0,
      fraudRate: 0,
      topBrands: [],
      fraudAlerts: 0,
      recentActivity: [],
    }
  }
}

export async function exportReport(
  reportType: 'brand' | 'product' | 'executive',
  id: string,
  format: 'json' | 'csv'
): Promise<{ success: boolean; data?: string; error?: string }> {
  try {
    let report: unknown

    switch (reportType) {
      case 'brand':
        const endDate = new Date()
        const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000)
        report = await generateBrandReport(id, startDate, endDate)
        break
      case 'product':
        const end = new Date()
        const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000)
        report = await generateProductReport(id, start, end)
        break
      case 'executive':
        report = await generateExecutiveSummary()
        break
    }

    if (!report) {
      return { success: false, error: 'Report generation failed' }
    }

    if (format === 'json') {
      return { success: true, data: JSON.stringify(report, null, 2) }
    }

    return { success: false, error: 'CSV export not implemented' }
  } catch (error) {
    console.error('Export report error:', error)
    return { success: false, error: 'Export failed' }
  }
}
