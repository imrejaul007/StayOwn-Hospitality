'use client'

import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card'
import { Button } from '../ui/Button'
import { Badge, StatusBadge } from '../ui/Badge'

interface FraudFlag {
  id: string
  serialNumber: string
  reason: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  details?: Record<string, unknown>
  resolved?: boolean
  createdAt: string
}

interface FraudPanelProps {
  flags: FraudFlag[]
  onResolve?: (flagId: string, resolution: string) => void
  onViewDetails?: (flagId: string) => void
}

export function FraudPanel({ flags, onResolve, onViewDetails }: FraudPanelProps) {
  const severityVariant = (severity: FraudFlag['severity']) => {
    switch (severity) {
      case 'CRITICAL':
      case 'HIGH':
        return 'danger'
      case 'MEDIUM':
        return 'warning'
      default:
        return 'info'
    }
  }

  const reasonLabels: Record<string, string> = {
    VELOCITY_EXCEEDED: 'Velocity Exceeded',
    IMPOSSIBLE_TRAVEL: 'Impossible Travel',
    MULTI_USER_SERIAL: 'Multi-User Serial',
    VPN_DETECTED: 'VPN Detected',
    PROXY_DETECTED: 'Proxy Detected',
    GPS_SPOOFING: 'GPS Spoofing',
    DEVICE_FINGERPRINT_MISMATCH: 'Device Mismatch',
    SUSPICIOUS_PATTERN: 'Suspicious Pattern',
    MANUAL_REVIEW: 'Manual Review',
  }

  const unresolvedFlags = flags.filter((f) => !f.resolved)
  const criticalCount = unresolvedFlags.filter((f) => f.severity === 'CRITICAL' || f.severity === 'HIGH').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fraud Detection</h1>
          <p className="text-gray-500">Monitor and resolve suspicious activity</p>
        </div>
        {criticalCount > 0 && (
          <Badge variant="danger" size="lg" icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          }>
            {criticalCount} Critical Alert{criticalCount > 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="text-center">
            <p className="text-3xl font-bold text-gray-900">{unresolvedFlags.length}</p>
            <p className="text-sm text-gray-500">Unresolved Flags</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center">
            <p className="text-3xl font-bold text-red-600">{criticalCount}</p>
            <p className="text-sm text-gray-500">Critical/High</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center">
            <p className="text-3xl font-bold text-yellow-600">
              {unresolvedFlags.filter((f) => f.severity === 'MEDIUM').length}
            </p>
            <p className="text-sm text-gray-500">Medium</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center">
            <p className="text-3xl font-bold text-blue-600">
              {unresolvedFlags.filter((f) => f.severity === 'LOW').length}
            </p>
            <p className="text-sm text-gray-500">Low</p>
          </CardContent>
        </Card>
      </div>

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Serial</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Severity</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {unresolvedFlags.map((flag) => (
                <tr key={flag.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-sm">{flag.serialNumber}</td>
                  <td className="px-4 py-3 text-sm">{reasonLabels[flag.reason] || flag.reason}</td>
                  <td className="px-4 py-3">
                    <Badge variant={severityVariant(flag.severity)} size="sm">
                      {flag.severity}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(flag.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => onViewDetails?.(flag.id)}>
                        Details
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => onResolve?.(flag.id, 'Resolved')}>
                        Resolve
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {unresolvedFlags.length === 0 && (
            <div className="py-12 text-center text-gray-500">
              <svg className="w-12 h-12 mx-auto text-green-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <p>No unresolved fraud flags</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
