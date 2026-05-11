'use client'

import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card'
import { Button } from '../ui/Button'
import { Select } from '../ui/Input'

interface AnalyticsProps {
  brandId?: string
  period?: string
  onExport?: (format: 'pdf' | 'csv') => void
}

export function Analytics({ brandId, period = '30d', onExport }: AnalyticsProps) {
  const periodOptions = [
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
    { value: '1y', label: 'Last year' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-500">Detailed insights and performance metrics</p>
        </div>
        <div className="flex items-center gap-4">
          <Select
            options={periodOptions}
            value={period}
            className="w-40"
          />
          <Button variant="outline" onClick={() => onExport?.('pdf')}>
            Export PDF
          </Button>
          <Button variant="outline" onClick={() => onExport?.('csv')}>
            Export CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Scan Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72 flex items-center justify-center text-gray-400">
              Scan trends chart placeholder
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>User Engagement</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72 flex items-center justify-center text-gray-400">
              User engagement chart placeholder
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Location Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72 flex items-center justify-center text-gray-400">
              Location map placeholder
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fraud Detection</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72 flex items-center justify-center text-gray-400">
              Fraud detection chart placeholder
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top Performing Products</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Scans</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unique Users</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Engagement</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Growth</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="px-4 py-3 text-gray-900">Loading...</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
