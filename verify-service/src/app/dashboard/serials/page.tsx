'use client'

import { Serials } from '@/components/dashboard/Serials'

export default function SerialsPage() {
  return (
    <Serials
      serials={[]}
      onExport={() => {}}
      onViewQR={(serialId) => {}}
    />
  )
}
