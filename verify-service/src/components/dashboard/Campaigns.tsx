'use client'

import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card'
import { Button } from '../ui/Button'
import { StatusBadge } from '../ui/Badge'

interface Campaign {
  id: string
  name: string
  description?: string
  type: 'PER_SCAN' | 'FIRST_N' | 'GEO_TARGETED' | 'TIME_BOOST'
  rewardAmount: number
  usedCount: number
  cap?: number
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'BUDGET_EXHAUSTED'
  startDate: string
  endDate?: string
}

interface CampaignsProps {
  campaigns: Campaign[]
  onCreateCampaign?: () => void
  onViewCampaign?: (id: string) => void
  onToggleStatus?: (id: string, action: 'activate' | 'pause') => void
}

export function Campaigns({
  campaigns,
  onCreateCampaign,
  onViewCampaign,
  onToggleStatus,
}: CampaignsProps) {
  const getProgress = (campaign: Campaign) => {
    if (!campaign.cap) return null
    return Math.min((campaign.usedCount / campaign.cap) * 100, 100)
  }

  const getCampaignTypeLabel = (type: Campaign['type']) => {
    const labels: Record<Campaign['type'], string> = {
      PER_SCAN: 'Per Scan',
      FIRST_N: 'First N Scanners',
      GEO_TARGETED: 'Geo Targeted',
      TIME_BOOST: 'Time Boost',
    }
    return labels[type]
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
          <p className="text-gray-500">Create and manage reward campaigns</p>
        </div>
        <Button onClick={onCreateCampaign} leftIcon={
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        }>
          Create Campaign
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {campaigns.map((campaign) => {
          const progress = getProgress(campaign)

          return (
            <Card key={campaign.id} hover onClick={() => onViewCampaign?.(campaign.id)}>
              <CardContent>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{campaign.name}</h3>
                    {campaign.description && (
                      <p className="text-sm text-gray-500 mt-1">{campaign.description}</p>
                    )}
                  </div>
                  <StatusBadge status={campaign.status} />
                </div>

                <div className="flex items-center gap-4 mb-4">
                  <span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium text-gray-600">
                    {getCampaignTypeLabel(campaign.type)}
                  </span>
                  <span className="text-lg font-bold text-primary">
                    {campaign.rewardAmount} coins
                  </span>
                </div>

                {progress !== null && (
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-500">Budget Used</span>
                      <span className="font-medium">
                        {campaign.usedCount} / {campaign.cap}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          progress >= 90 ? 'bg-red-500' : progress >= 70 ? 'bg-yellow-500' : 'bg-primary'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <div className="text-sm text-gray-500">
                    {new Date(campaign.startDate).toLocaleDateString()}
                    {campaign.endDate && ` - ${new Date(campaign.endDate).toLocaleDateString()}`}
                  </div>
                  {campaign.status === 'ACTIVE' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        onToggleStatus?.(campaign.id, 'pause')
                      }}
                    >
                      Pause
                    </Button>
                  )}
                  {campaign.status === 'PAUSED' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        onToggleStatus?.(campaign.id, 'activate')
                      }}
                    >
                      Activate
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}

        {campaigns.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="py-12 text-center">
              <svg className="w-12 h-12 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-1">No campaigns yet</h3>
              <p className="text-gray-500 mb-4">Create your first reward campaign</p>
              <Button onClick={onCreateCampaign}>Create Campaign</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
