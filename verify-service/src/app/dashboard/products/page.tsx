'use client'

import { Products } from '@/components/dashboard/Products'

export default function ProductsPage() {
  return (
    <Products
      products={[]}
      onAddProduct={() => {}}
      onViewProduct={(id) => {}}
      onGenerateSerials={(id) => {}}
    />
  )
}
