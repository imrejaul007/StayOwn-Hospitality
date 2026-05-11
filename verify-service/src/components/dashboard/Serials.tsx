'use client'

import React, { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card'
import { Button } from '../ui/Button'
import { Input, Select } from '../ui/Input'
import { StatusBadge } from '../ui/Badge'

interface Serial {
  id: string
  serialNumber: string
  batchName?: string
  status: 'CREATED' | 'ACTIVE' | 'SCANNED_FIRST' | 'MULTI_SCAN' | 'FLAGGED' | 'EXPIRED' | 'INVALID'
  scanCount: number
  firstScanAt?: string
  lastScannedAt?: string
  createdAt: string
}

interface SerialsProps {
  serials: Serial[]
  productName?: string
  onExport?: () => void
  onViewQR?: (serialId: string) => void
  onFilterChange?: (filters: SerialFilters) => void
}

interface SerialFilters {
  search: string
  status: string
  batch: string
}

export function Serials({
  serials,
  productName,
  onExport,
  onViewQR,
  onFilterChange,
}: SerialsProps) {
  const [filters, setFilters] = useState<SerialFilters>({
    search: '',
    status: '',
    batch: '',
  })

  const handleFilterChange = (key: keyof SerialFilters, value: string) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
    onFilterChange?.(newFilters)
  }

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'CREATED', label: 'Created' },
    { value: 'ACTIVE', label: 'Active' },
    { value: 'SCANNED_FIRST', label: 'First Scan' },
    { value: 'MULTI_SCAN', label: 'Multi Scan' },
    { value: 'FLAGGED', label: 'Flagged' },
  ]

  const filteredSerials = serials.filter((serial) => {
    if (filters.search && !serial.serialNumber.toLowerCase().includes(filters.search.toLowerCase())) {
      return false
    }
    if (filters.status && serial.status !== filters.status) {
      return false
    }
    if (filters.batch && serial.batchName !== filters.batch) {
      return false
    }
    return true
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Serial Numbers</h1>
          {productName && (
            <p className="text-gray-500">Managing serials for: {productName}</p>
          )}
        </div>
        <Button onClick={onExport} variant="outline" leftIcon={
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        }>
          Export
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input
              placeholder="Search serial number..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              leftIcon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              }
            />
            <Select
              options={statusOptions}
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
            />
            <Input
              placeholder="Filter by batch..."
              value={filters.batch}
              onChange={(e) => handleFilterChange('batch', e.target.value)}
            />
            <div className="text-sm text-gray-500 flex items-center">
              {filteredSerials.length} of {serials.length} serials
            </div>
          </div>
        </CardContent>
      </Card>

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Serial Number</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Scans</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">First Scan</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Scan</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredSerials.map((serial) => (
                <tr key={serial.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-sm">{serial.serialNumber}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{serial.batchName || '-'}</td>
                  <td className="px-4 py-3"><StatusBadge status={serial.status} size="sm" /></td>
                  <td className="px-4 py-3 text-sm">{serial.scanCount}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {serial.firstScanAt ? new Date(serial.firstScanAt).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {serial.lastScannedAt ? new Date(serial.lastScannedAt).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <Button variant="ghost" size="sm" onClick={() => onViewQR?.(serial.id)}>
                      View QR
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredSerials.length === 0 && (
            <div className="py-12 text-center text-gray-500">
              No serials found matching your filters
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
