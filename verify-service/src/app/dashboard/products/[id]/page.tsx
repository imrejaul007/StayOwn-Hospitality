'use client'

import { useParams } from 'next/navigation'
import { Products } from '@/components/dashboard/Products'

export default function ProductDetailPage() {
  const params = useParams()
  const productId = params.id as string

  return (
    <Products
      products={[]}
      onAddProduct={() => {}}
      onViewProduct={(id) => {}}
      onGenerateSerials={(id) => {}}
    />
  )
}
