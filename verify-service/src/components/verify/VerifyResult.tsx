'use client'

import React from 'react'
import { Card, CardContent } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'

interface VerifyResultProps {
  result: {
    valid: boolean
    isGenuine?: boolean
    serial?: string
    product?: {
      name: string
      description?: string
      image?: string
    }
    brand?: {
      name: string
      logo?: string
    }
    scanCount?: number
    firstScanAt?: string
    reward?: {
      amount: number
      coinType: 'BRANDED' | 'REZ'
      campaignName?: string
    }
    fraud?: {
      score: number
      decision: 'ALLOW' | 'FLAG' | 'BLOCK'
    }
  }
  onClose?: () => void
}

export function VerifyResult({ result, onClose }: VerifyResultProps) {
  if (!result.valid) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-red-900 mb-2">Product Not Verified</h3>
          <p className="text-red-700 mb-4">This serial number could not be verified.</p>
          {onClose && (
            <Button variant="outline" onClick={onClose}>Try Again</Button>
          )}
        </CardContent>
      </Card>
    )
  }

  if (!result.isGenuine) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-red-900 mb-2">Counterfeit Product</h3>
          <p className="text-red-700">Warning: This product appears to be fake.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-green-200 bg-green-50">
      <CardContent className="py-6">
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-green-900">Genuine Product</h3>
          <p className="text-green-700 mt-1">This product is verified as authentic</p>
        </div>

        {result.brand && (
          <div className="flex items-center gap-3 mb-4 pb-4 border-b border-green-200">
            {result.brand.logo ? (
              <img src={result.brand.logo} alt={result.brand.name} className="w-10 h-10 rounded" />
            ) : (
              <div className="w-10 h-10 bg-green-200 rounded-full flex items-center justify-center">
                <span className="text-green-700 font-bold">{result.brand.name[0]}</span>
              </div>
            )}
            <span className="font-medium text-green-900">{result.brand.name}</span>
          </div>
        )}

        {result.product && (
          <div className="mb-4">
            <h4 className="font-semibold text-green-900">{result.product.name}</h4>
            {result.product.description && (
              <p className="text-sm text-green-700 mt-1">{result.product.description}</p>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-white/50 rounded-lg p-3">
            <p className="text-xs text-green-600 uppercase">Scan Count</p>
            <p className="text-lg font-bold text-green-900">{result.scanCount || 0}</p>
          </div>
          <div className="bg-white/50 rounded-lg p-3">
            <p className="text-xs text-green-600 uppercase">First Scanned</p>
            <p className="text-sm font-bold text-green-900">
              {result.firstScanAt
                ? new Date(result.firstScanAt).toLocaleDateString()
                : 'Not yet'}
            </p>
          </div>
        </div>

        {result.fraud && (
          <div className="mb-4">
            <Badge variant={result.fraud.decision === 'ALLOW' ? 'success' : 'warning'}>
              Fraud Check: {result.fraud.decision}
            </Badge>
            <p className="text-xs text-green-600 mt-1">Score: {result.fraud.score.toFixed(1)}</p>
          </div>
        )}

        {result.reward && (
          <div className="bg-white rounded-lg p-4 border border-green-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-green-900">
                  +{result.reward.amount} {result.reward.coinType === 'BRANDED' ? 'Brand Coins' : 'ReZ Coins'}
                </p>
                {result.reward.campaignName && (
                  <p className="text-xs text-green-600">From: {result.reward.campaignName}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {result.serial && (
          <p className="text-xs text-green-600 mt-4 font-mono text-center">
            {result.serial}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
