import QRCode from 'qrcode'
import { generateQRPayload } from './generator'

export interface QRCodeOptions {
  width?: number
  margin?: number
  color?: {
    dark?: string
    light?: string
  }
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'
}

const DEFAULT_OPTIONS: QRCodeOptions = {
  width: 300,
  margin: 2,
  color: {
    dark: '#000000',
    light: '#FFFFFF',
  },
  errorCorrectionLevel: 'H',
}

export async function generateQRCodeDataURL(
  serialNumber: string,
  signature: string,
  options: QRCodeOptions = {}
): Promise<string> {
  const payload = generateQRPayload(serialNumber, signature)
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options }

  try {
    const dataURL = await QRCode.toDataURL(payload, {
      width: mergedOptions.width,
      margin: mergedOptions.margin,
      color: mergedOptions.color,
      errorCorrectionLevel: mergedOptions.errorCorrectionLevel,
    })

    return dataURL
  } catch (error) {
    console.error('QR code generation error:', error)
    throw new Error('Failed to generate QR code')
  }
}

export async function generateQRCodeBuffer(
  serialNumber: string,
  signature: string,
  options: QRCodeOptions = {}
): Promise<Buffer> {
  const payload = generateQRPayload(serialNumber, signature)
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options }

  try {
    const buffer = await QRCode.toBuffer(payload, {
      width: mergedOptions.width,
      margin: mergedOptions.margin,
      color: mergedOptions.color,
      errorCorrectionLevel: mergedOptions.errorCorrectionLevel,
      type: 'png',
    })

    return buffer
  } catch (error) {
    console.error('QR code buffer generation error:', error)
    throw new Error('Failed to generate QR code buffer')
  }
}

export async function generateBulkQRCodes(
  serials: Array<{ serialNumber: string; signature: string }>,
  options: QRCodeOptions = {}
): Promise<Array<{ serialNumber: string; qrCode: string }>> {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options }

  const results = await Promise.all(
    serials.map(async (serial) => {
      const qrCode = await generateQRCodeDataURL(serial.serialNumber, serial.signature, mergedOptions)
      return {
        serialNumber: serial.serialNumber,
        qrCode,
      }
    })
  )

  return results
}

export interface QRCodeSVGOptions {
  width?: number
  margin?: number
  color?: {
    dark?: string
    light?: string
  }
}

export async function generateQRCodeSVG(
  serialNumber: string,
  signature: string,
  options: QRCodeSVGOptions = {}
): Promise<string> {
  const payload = generateQRPayload(serialNumber, signature)

  try {
    const svg = await QRCode.toString(payload, {
      type: 'svg',
      width: options.width || 300,
      margin: options.margin || 2,
      color: options.color || { dark: '#000000', light: '#FFFFFF' },
    })

    return svg
  } catch (error) {
    console.error('QR code SVG generation error:', error)
    throw new Error('Failed to generate QR code SVG')
  }
}

export function generatePrintablePDFData(
  serials: Array<{
    serialNumber: string
    signature: string
    productName?: string
    brandName?: string
  }>,
  pageSize: 'A4' | 'Letter' = 'A4'
): {
  width: number
  height: number
  serials: Array<{
    serialNumber: string
    qrDataURL: string
    productName?: string
    brandName?: string
    position: { page: number; x: number; y: number }
  }>
} {
  const pageDimensions = pageSize === 'A4'
    ? { width: 210, height: 297 }
    : { width: 215.9, height: 279.4 }

  const qrSize = 25
  const marginX = 10
  const marginY = 10
  const cols = Math.floor((pageDimensions.width - 2 * marginX) / (qrSize + 30))
  const rows = Math.floor((pageDimensions.height - 2 * marginY) / (qrSize + 20))

  const itemsPerPage = cols * rows

  return {
    width: pageDimensions.width,
    height: pageDimensions.height,
    serials: serials.map((serial, index) => ({
      serialNumber: serial.serialNumber,
      qrDataURL: '', // Generated asynchronously
      productName: serial.productName,
      brandName: serial.brandName,
      position: {
        page: Math.floor(index / itemsPerPage) + 1,
        x: (index % cols) * (qrSize + 30) + marginX,
        y: Math.floor((index % itemsPerPage) / cols) * (qrSize + 20) + marginY,
      },
    })),
  }
}
