'use client'

import { Overview } from '@/components/dashboard/Overview'

export default function DashboardPage() {
  return (
    <Overview
      stats={{
        totalScans: 0,
        uniqueUsers: 0,
        totalRewards: 0,
        fraudRate: 0,
        activeProducts: 0,
        activeCampaigns: 0,
      }}
    />
  )
}
