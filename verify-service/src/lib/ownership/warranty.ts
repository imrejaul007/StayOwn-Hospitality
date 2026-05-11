import prisma from '../db'

export interface WarrantyInfo {
  serialId: string
  serialNumber: string
  productName: string
  brandName: string
  warrantyStart: Date | null
  warrantyEnd: Date | null
  status: 'ACTIVE' | 'EXPIRED' | 'NO_WARRANTY'
  daysRemaining: number | null
  isClaimable: boolean
}

export interface ClaimWarrantyInput {
  serialId: string
  userId: string
  reason: string
  description: string
  evidence?: string[]
  contactEmail?: string
  contactPhone?: string
}

export async function setupWarranty(
  serialId: string,
  startDate: Date,
  durationMonths: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const endDate = new Date(startDate)
    endDate.setMonth(endDate.getMonth() + durationMonths)

    await prisma.ownership.update({
      where: { serialId },
      data: {
        warrantyStart: startDate,
        warrantyEnd: endDate,
      },
    })

    return { success: true }
  } catch (error) {
    console.error('Setup warranty error:', error)
    return { success: false, error: 'Failed to setup warranty' }
  }
}

export async function getWarrantyInfo(serialId: string): Promise<WarrantyInfo | null> {
  try {
    const ownership = await prisma.ownership.findUnique({
      where: { serialId },
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
    })

    if (!ownership) {
      return null
    }

    const now = new Date()
    let status: 'ACTIVE' | 'EXPIRED' | 'NO_WARRANTY' = 'NO_WARRANTY'
    let daysRemaining: number | null = null
    let isClaimable = false

    if (ownership.warrantyClaimed) {
      status = 'EXPIRED'
    } else if (ownership.warrantyEnd) {
      if (ownership.warrantyEnd > now) {
        status = 'ACTIVE'
        daysRemaining = Math.ceil(
          (ownership.warrantyEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        )
        isClaimable = true
      } else {
        status = 'EXPIRED'
      }
    }

    return {
      serialId: ownership.serialId,
      serialNumber: ownership.serial.serialNumber,
      productName: ownership.serial.product.name,
      brandName: ownership.serial.product.brand.name,
      warrantyStart: ownership.warrantyStart,
      warrantyEnd: ownership.warrantyEnd,
      status,
      daysRemaining,
      isClaimable,
    }
  } catch (error) {
    console.error('Get warranty info error:', error)
    return null
  }
}

export async function claimWarranty(
  input: ClaimWarrantyInput
): Promise<{ success: boolean; claimId?: string; error?: string }> {
  try {
    const ownership = await prisma.ownership.findUnique({
      where: { serialId: input.serialId },
    })

    if (!ownership) {
      return { success: false, error: 'Ownership record not found' }
    }

    if (ownership.userId !== input.userId) {
      return { success: false, error: 'Not the current owner' }
    }

    if (ownership.warrantyClaimed) {
      return { success: false, error: 'Warranty already claimed' }
    }

    if (!ownership.warrantyStart || !ownership.warrantyEnd) {
      return { success: false, error: 'No warranty configured' }
    }

    const now = new Date()
    if (now < ownership.warrantyStart || now > ownership.warrantyEnd) {
      return { success: false, error: 'Outside warranty period' }
    }

    await prisma.ownership.update({
      where: { serialId: input.serialId },
      data: { warrantyClaimed: true },
    })

    return { success: true, claimId: input.serialId }
  } catch (error) {
    console.error('Claim warranty error:', error)
    return { success: false, error: 'Failed to claim warranty' }
  }
}

export async function extendWarranty(
  serialId: string,
  additionalMonths: number
): Promise<{ success: boolean; newEndDate?: Date; error?: string }> {
  try {
    const ownership = await prisma.ownership.findUnique({
      where: { serialId },
    })

    if (!ownership) {
      return { success: false, error: 'Ownership record not found' }
    }

    const currentEnd = ownership.warrantyEnd || new Date()
    const newEnd = new Date(currentEnd)
    newEnd.setMonth(newEnd.getMonth() + additionalMonths)

    await prisma.ownership.update({
      where: { serialId },
      data: { warrantyEnd: newEnd },
    })

    return { success: true, newEndDate: newEnd }
  } catch (error) {
    console.error('Extend warranty error:', error)
    return { success: false, error: 'Failed to extend warranty' }
  }
}

export async function getWarrantyClaims(
  brandId: string,
  options?: {
    status?: 'PENDING' | 'APPROVED' | 'REJECTED'
    limit?: number
    offset?: number
  }
): Promise<{
  claims: Array<{
    serialId: string
    serialNumber: string
    productName: string
    ownerId: string
    reason: string
    description: string
    submittedAt: Date
  }>
  total: number
}> {
  return { claims: [], total: 0 }
}

export async function getUserWarrantyClaims(
  userId: string
): Promise<Array<{
  serialId: string
  serialNumber: string
  productName: string
  claimStatus: 'ACTIVE' | 'CLAIMED' | 'EXPIRED'
  warrantyStart: Date | null
  warrantyEnd: Date | null
  isClaimable: boolean
}>> {
  try {
    const ownerships = await prisma.ownership.findMany({
      where: {
        userId,
        warrantyStart: { not: null },
      },
      include: {
        serial: {
          include: {
            product: { select: { name: true } },
          },
        },
      },
    })

    const now = new Date()

    return ownerships.map((o) => {
      let claimStatus: 'ACTIVE' | 'CLAIMED' | 'EXPIRED' = 'ACTIVE'

      if (o.warrantyClaimed) {
        claimStatus = 'CLAIMED'
      } else if (o.warrantyEnd && o.warrantyEnd < now) {
        claimStatus = 'EXPIRED'
      }

      const isClaimable =
        !o.warrantyClaimed &&
        o.warrantyStart !== null &&
        o.warrantyEnd !== null &&
        o.warrantyEnd > now

      return {
        serialId: o.serialId,
        serialNumber: o.serial.serialNumber,
        productName: o.serial.product.name,
        claimStatus,
        warrantyStart: o.warrantyStart,
        warrantyEnd: o.warrantyEnd,
        isClaimable,
      }
    })
  } catch (error) {
    console.error('Get user warranty claims error:', error)
    return []
  }
}
