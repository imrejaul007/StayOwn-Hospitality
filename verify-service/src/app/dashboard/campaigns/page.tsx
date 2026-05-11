'use client'

import { Campaigns } from '@/components/dashboard/Campaigns'
import { useRouter } from 'next/navigation'

export default function CampaignsPage() {
  const router = useRouter()

  return (
    <Campaigns
      campaigns={[]}
      onCreateCampaign={() => router.push('/dashboard/campaigns/create')}
      onViewCampaign={(id) => router.push(`/dashboard/campaigns/${id}`)}
      onToggleStatus={(id, action) => {
        console.log('Toggle campaign:', id, action)
      }}
    />
  )
}
