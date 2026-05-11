'use client'

import React from 'react'
import { Card, CardContent } from '../ui/Card'
import { Badge, StatusBadge } from '../ui/Badge'

interface Reward {
  id: string
  amount: number
  coinType: 'BRANDED' | 'REZ'
  status: 'PENDING' | 'CLAIMED' | 'EXPIRED' | 'CANCELLED'
  createdAt: string
  expiresAt?: string
  campaignName?: string
}

interface RewardCardProps {
  reward: Reward
  onClaim?: (id: string) => void
}

export function RewardCard({ reward, onClaim }: RewardCardProps) {
  const isClaimable = reward.status === 'PENDING'
  const isExpired = reward.status === 'EXPIRED' || (reward.expiresAt && new Date(reward.expiresAt) < new Date())

  return (
    <Card>
      <CardContent>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">
                +{reward.amount} {reward.coinType === 'BRANDED' ? 'Brand Coins' : 'ReZ Coins'}
              </p>
              {reward.campaignName && (
                <p className="text-sm text-gray-500">{reward.campaignName}</p>
              )}
            </div>
          </div>
          <StatusBadge status={reward.status} />
        </div>

        <div className="mt-4 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">
              {isClaimable ? 'Claim by' : isExpired ? 'Expired' : 'Claimed on'}
            </span>
            <span className="font-medium">
              {reward.expiresAt && isClaimable
                ? new Date(reward.expiresAt).toLocaleDateString()
                : reward.createdAt
                ? new Date(reward.createdAt).toLocaleDateString()
                : '-'}
            </span>
          </div>

          {isClaimable && onClaim && (
            <button
              onClick={() => onClaim(reward.id)}
              className="mt-3 w-full py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              Claim Reward
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
