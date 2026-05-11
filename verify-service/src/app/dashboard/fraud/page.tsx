'use client'

import { FraudPanel } from '@/components/dashboard/FraudPanel'

export default function FraudPage() {
  return (
    <FraudPanel
      flags={[]}
      onResolve={(flagId, resolution) => {
        console.log('Resolve flag:', flagId, resolution)
      }}
      onViewDetails={(flagId) => {
        console.log('View details:', flagId)
      }}
    />
  )
}
