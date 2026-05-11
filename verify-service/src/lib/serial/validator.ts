import crypto from 'crypto'
import prisma from '../db'

export interface ValidationResult {
  valid: boolean
  serial?: string
  productId?: string
  brandId?: string
  isGenuine?: boolean
  scanCount?: number
  firstScanAt?: Date | null
  status?: string
  error?: string
  details?: Record<string, unknown>
}

export interface ValidationContext {
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
}

function verifySignature(serialNumber: string, signature: string, secretKey: string): boolean {
  const hmac = crypto.createHmac('sha256', secretKey)
  hmac.update(serialNumber)
  const expectedSignature = hmac.digest('hex').substring(0, 16).toUpperCase()
  return crypto.timingSafeEqual(
    Buffer.from(signature.toUpperCase()),
    Buffer.from(expectedSignature)
  )
}

function verifyChecksum(serialNumber: string): boolean {
  const parts = serialNumber.split('-')
  if (parts.length < 4) return false

  const baseSerial = parts.slice(0, -1).join('-')
  const providedChecksum = parts[parts.length - 1]

  let sum = 0
  for (let i = 0; i < baseSerial.length; i++) {
    sum += baseSerial.charCodeAt(i) * (i + 1)
  }
  const expectedChecksum = (sum % 97).toString().padStart(2, '0')

  return providedChecksum === expectedChecksum
}

export async function validateSerial(
  serialNumber: string,
  signature: string,
  context?: ValidationContext
): Promise<ValidationResult> {
  try {
    if (!verifyChecksum(serialNumber)) {
      return {
        valid: false,
        error: 'Invalid serial number checksum',
        details: { reason: 'checksum_failed' },
      }
    }

    const serialRecord = await prisma.serial.findUnique({
      where: { serialNumber },
      include: {
        product: {
          include: {
            brand: true,
          },
        },
      },
    })

    if (!serialRecord) {
      return {
        valid: false,
        error: 'Serial number not found',
        details: { reason: 'not_found' },
      }
    }

    if (!verifySignature(serialNumber, signature, serialRecord.product.brand.secretKey)) {
      await flagSerial(serialRecord.id, 'INVALID_SIGNATURE', 'CRITICAL')
      return {
        valid: false,
        serial: serialNumber,
        isGenuine: false,
        error: 'Signature verification failed',
        details: { reason: 'signature_invalid', serialId: serialRecord.id },
      }
    }

    return {
      valid: true,
      serial: serialNumber,
      productId: serialRecord.productId,
      brandId: serialRecord.product.brandId,
      isGenuine: serialRecord.isGenuine,
      scanCount: serialRecord.scanCount,
      firstScanAt: serialRecord.firstScanAt,
      status: serialRecord.status,
      details: {
        serialId: serialRecord.id,
        productName: serialRecord.product.name,
        brandName: serialRecord.product.brand.name,
        batchId: serialRecord.batchId,
        batchName: serialRecord.batchName,
      },
    }
  } catch (error) {
    console.error('Serial validation error:', error)
    return {
      valid: false,
      error: 'Validation service error',
      details: { reason: 'service_error' },
    }
  }
}

export async function flagSerial(
  serialId: string,
  reason: string,
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
): Promise<void> {
  try {
    const serial = await prisma.serial.findUnique({
      where: { id: serialId },
      include: { product: true },
    })

    if (serial) {
      await prisma.fraudFlag.create({
        data: {
          serialId,
          brandId: serial.product.brandId,
          reason: reason as any,
          severity,
          details: { flaggedAt: new Date().toISOString() },
        },
      })

      await prisma.serial.update({
        where: { id: serialId },
        data: { status: 'FLAGGED' },
      })
    }
  } catch (error) {
    console.error('Error flagging serial:', error)
  }
}

export async function getSerialInfo(serialNumber: string): Promise<ValidationResult> {
  try {
    const serialRecord = await prisma.serial.findUnique({
      where: { serialNumber },
      include: {
        product: {
          include: {
            brand: {
              select: {
                id: true,
                name: true,
                logo: true,
                status: true,
              },
            },
          },
        },
        ownership: true,
        scans: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            createdAt: true,
            fraudScore: true,
            fraudDecision: true,
          },
        },
      },
    })

    if (!serialRecord) {
      return {
        valid: false,
        error: 'Serial number not found',
      }
    }

    return {
      valid: true,
      serial: serialNumber,
      productId: serialRecord.productId,
      brandId: serialRecord.product.brandId,
      isGenuine: serialRecord.isGenuine,
      scanCount: serialRecord.scanCount,
      firstScanAt: serialRecord.firstScanAt,
      status: serialRecord.status,
      details: {
        serialId: serialRecord.id,
        product: {
          id: serialRecord.product.id,
          name: serialRecord.product.name,
          description: serialRecord.product.description,
          image: serialRecord.product.image,
          category: serialRecord.product.category,
        },
        brand: serialRecord.product.brand,
        ownership: serialRecord.ownership,
        recentScans: serialRecord.scans,
      },
    }
  } catch (error) {
    console.error('Get serial info error:', error)
    return {
      valid: false,
      error: 'Service error',
    }
  }
}
