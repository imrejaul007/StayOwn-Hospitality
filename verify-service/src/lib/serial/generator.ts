import crypto from 'crypto'

export interface SerialGenerationOptions {
  prefix?: string
  length?: number
  batchId?: string
  batchName?: string
  count?: number
}

export interface GeneratedSerial {
  serialNumber: string
  signature: string
  batchId?: string
  batchName?: string
}

function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let result = ''
  const randomBytes = crypto.randomBytes(length)
  for (let i = 0; i < length; i++) {
    result += chars[randomBytes[i] % chars.length]
  }
  return result
}

function generateChecksum(input: string): string {
  let sum = 0
  for (let i = 0; i < input.length; i++) {
    sum += input.charCodeAt(i) * (i + 1)
  }
  return (sum % 97).toString().padStart(2, '0')
}

function createSignature(serialNumber: string, secretKey: string): string {
  const hmac = crypto.createHmac('sha256', secretKey)
  hmac.update(serialNumber)
  return hmac.digest('hex').substring(0, 16).toUpperCase()
}

export function generateSerial(options: SerialGenerationOptions = {}): GeneratedSerial {
  const {
    prefix = 'RZ',
    length = 12,
    batchId,
    batchName,
  } = options

  const timestamp = Date.now().toString(36).toUpperCase()
  const random = generateRandomString(6)
  const baseSerial = `${prefix}-${timestamp}-${random}`

  const checksum = generateChecksum(baseSerial)
  const serialNumber = `${baseSerial}-${checksum}`

  const fullSerial = `${serialNumber}${batchId ? `-B${batchId}` : ''}`

  return {
    serialNumber: fullSerial,
    signature: '',
    batchId,
    batchName,
  }
}

export function generateSerials(
  count: number,
  secretKey: string,
  options: SerialGenerationOptions = {}
): GeneratedSerial[] {
  const serials: GeneratedSerial[] = []
  const batchId = crypto.randomBytes(4).toString('hex').toUpperCase()

  for (let i = 0; i < count; i++) {
    const serial = generateSerial({
      ...options,
      batchId,
    })
    serial.signature = createSignature(serial.serialNumber, secretKey)
    serials.push(serial)
  }

  return serials
}

export function generateQRPayload(serialNumber: string, signature: string): string {
  return JSON.stringify({
    s: serialNumber,
    sig: signature,
    v: 1,
    ts: Date.now(),
  })
}

export function parseQRPayload(qrData: string): { serial: string; signature: string; version: number } | null {
  try {
    const parsed = JSON.parse(qrData)
    if (parsed.s && parsed.sig && parsed.v) {
      return {
        serial: parsed.s,
        signature: parsed.sig,
        version: parsed.v,
      }
    }
    return null
  } catch {
    return null
  }
}

export function generateBatchId(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase()
}

// Re-export QR code generator
export { generateQRCodeDataURL } from './qr'
