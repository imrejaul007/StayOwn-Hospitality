import prisma from '../db'

export interface OwnershipRecord {
  id: string
  serialId: string
  userId: string
  scannedAt: Date
  purchaseProof: boolean
  warrantyStart: Date | null
  warrantyEnd: Date | null
  warrantyClaimed: boolean
  transferredAt: Date | null
  previousOwnerId: string | null
}

export interface TransferOwnershipInput {
  serialId: string
  fromUserId: string
  toUserId: string
  reason?: string
}

export async function recordOwnership(
  serialId: string,
  userId: string,
  scannedAt: Date,
  purchaseProof = true
): Promise<{ success: boolean; ownershipId?: string; error?: string }> {
  try {
    const existing = await prisma.ownership.findUnique({
      where: { serialId },
    })

    if (existing) {
      return {
        success: false,
        error: 'Ownership record already exists',
      }
    }

    const ownership = await prisma.ownership.create({
      data: {
        serialId,
        userId,
        scannedAt,
        purchaseProof,
      },
    })

    await prisma.serial.update({
      where: { id: serialId },
      data: { firstUserId: userId },
    })

    return { success: true, ownershipId: ownership.id }
  } catch (error) {
    console.error('Record ownership error:', error)
    return { success: false, error: 'Failed to record ownership' }
  }
}

export async function transferOwnership(
  input: TransferOwnershipInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const existing = await prisma.ownership.findUnique({
      where: { serialId: input.serialId },
    })

    if (!existing) {
      return { success: false, error: 'No ownership record found' }
    }

    if (existing.userId !== input.fromUserId) {
      return { success: false, error: 'Not the current owner' }
    }

    if (existing.warrantyClaimed) {
      return { success: false, error: 'Cannot transfer - warranty has been claimed' }
    }

    await prisma.ownership.update({
      where: { serialId: input.serialId },
      data: {
        userId: input.toUserId,
        transferredAt: new Date(),
        previousOwnerId: input.fromUserId,
      },
    })

    return { success: true }
  } catch (error) {
    console.error('Transfer ownership error:', error)
    return { success: false, error: 'Failed to transfer ownership' }
  }
}

export async function getOwnership(serialId: string): Promise<OwnershipRecord | null> {
  try {
    const ownership = await prisma.ownership.findUnique({
      where: { serialId },
    })

    return ownership
  } catch (error) {
    console.error('Get ownership error:', error)
    return null
  }
}

export async function getUserOwnerships(
  userId: string,
  options?: {
    limit?: number
    offset?: number
  }
): Promise<{
  ownerships: Array<{
    serialId: string
    serialNumber: string
    productName: string
    brandName: string
    scannedAt: Date
    warrantyStatus: 'ACTIVE' | 'EXPIRED' | 'CLAIMED' | 'NO_WARRANTY'
    transferredAt: Date | null
  }>
  total: number
}> {
  try {
    const [ownerships, total] = await Promise.all([
      prisma.ownership.findMany({
        where: { userId },
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
        orderBy: { scannedAt: 'desc' },
        take: options?.limit || 20,
        skip: options?.offset || 0,
      }),
      prisma.ownership.count({ where: { userId } }),
    ])

    return {
      ownerships: ownerships.map((o) => {
        let warrantyStatus: 'ACTIVE' | 'EXPIRED' | 'CLAIMED' | 'NO_WARRANTY' = 'NO_WARRANTY'

        if (o.warrantyClaimed) {
          warrantyStatus = 'CLAIMED'
        } else if (o.warrantyEnd && o.warrantyEnd < new Date()) {
          warrantyStatus = 'EXPIRED'
        } else if (o.warrantyStart && o.warrantyEnd) {
          warrantyStatus = 'ACTIVE'
        }

        return {
          serialId: o.serialId,
          serialNumber: o.serial.serialNumber,
          productName: o.serial.product.name,
          brandName: o.serial.product.brand.name,
          scannedAt: o.scannedAt,
          warrantyStatus,
          transferredAt: o.transferredAt,
        }
      }),
      total,
    }
  } catch (error) {
    console.error('Get user ownerships error:', error)
    return { ownerships: [], total: 0 }
  }
}

export async function verifyOwnership(
  serialId: string,
  userId: string
): Promise<{ verified: boolean; error?: string }> {
  try {
    const ownership = await prisma.ownership.findUnique({
      where: { serialId },
    })

    if (!ownership) {
      return { verified: false, error: 'No ownership record' }
    }

    if (ownership.userId !== userId) {
      return { verified: false, error: 'Not the owner' }
    }

    return { verified: true }
  } catch (error) {
    console.error('Verify ownership error:', error)
    return { verified: false, error: 'Verification failed' }
  }
}

export async function getOwnershipHistory(
  serialId: string
): Promise<Array<{
  userId: string
  action: 'PURCHASED' | 'TRANSFERRED'
  timestamp: Date
  previousOwnerId?: string
}>> {
  try {
    const ownership = await prisma.ownership.findUnique({
      where: { serialId },
    })

    if (!ownership) {
      return []
    }

    const history: Array<{
      userId: string
      action: 'PURCHASED' | 'TRANSFERRED'
      timestamp: Date
      previousOwnerId?: string
    }> = [
      {
        userId: ownership.userId,
        action: 'PURCHASED',
        timestamp: ownership.scannedAt,
      },
    ]

    if (ownership.transferredAt && ownership.previousOwnerId) {
      history.push({
        userId: ownership.userId,
        action: 'TRANSFERRED',
        timestamp: ownership.transferredAt,
        previousOwnerId: ownership.previousOwnerId,
      })
    }

    return history
  } catch (error) {
    console.error('Get ownership history error:', error)
    return []
  }
}
