export type SerialStatus = 'CREATED' | 'ACTIVE' | 'SCANNED_FIRST' | 'MULTI_SCAN' | 'FLAGGED' | 'EXPIRED' | 'INVALID'

export interface Serial {
  id: string
  productId: string
  serialNumber: string
  signature: string
  batchId?: string
  batchName?: string
  status: SerialStatus
  firstScanAt?: Date
  firstUserId?: string
  scanCount: number
  isGenuine: boolean
  lastScannedAt?: Date
  createdAt: Date
}

export interface SerialGenerationRequest {
  productId: string
  count: number
  batchName?: string
}

export interface SerialGenerationResponse {
  success: boolean
  serials: Array<{
    serialNumber: string
    signature: string
    qrCode?: string
  }>
  batchId: string
  batchName?: string
}

export interface SerialBatch {
  id: string
  name?: string
  productId: string
  serialCount: number
  createdAt: Date
  serials: Serial[]
}

export interface SerialFilter {
  productId?: string
  status?: SerialStatus
  batchId?: string
  startDate?: Date
  endDate?: Date
  search?: string
}
