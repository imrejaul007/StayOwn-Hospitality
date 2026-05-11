'use client'

import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card'
import { Button } from '../ui/Button'
import { StatusBadge } from '../ui/Badge'

interface Product {
  id: string
  name: string
  category?: string
  totalSerials: number
  scannedSerials: number
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED'
  image?: string
}

interface ProductsProps {
  products: Product[]
  onAddProduct?: () => void
  onViewProduct?: (id: string) => void
  onGenerateSerials?: (id: string) => void
}

export function Products({
  products,
  onAddProduct,
  onViewProduct,
  onGenerateSerials,
}: ProductsProps) {
  const scanRate = (product: Product) => {
    if (product.totalSerials === 0) return 0
    return (product.scannedSerials / product.totalSerials) * 100
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-gray-500">Manage your product catalog and serial numbers</p>
        </div>
        <Button onClick={onAddProduct} leftIcon={
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        }>
          Add Product
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((product) => (
          <Card key={product.id} hover onClick={() => onViewProduct?.(product.id)}>
            <CardContent>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                    {product.image ? (
                      <img src={product.image} alt={product.name} className="w-10 h-10 rounded" />
                    ) : (
                      <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{product.name}</h3>
                    {product.category && (
                      <p className="text-sm text-gray-500">{product.category}</p>
                    )}
                  </div>
                </div>
                <StatusBadge status={product.status} size="sm" />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total Serials</span>
                  <span className="font-medium">{product.totalSerials.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Scanned</span>
                  <span className="font-medium">{product.scannedSerials.toLocaleString()}</span>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-500">Scan Rate</span>
                    <span className="font-medium">{scanRate(product).toFixed(1)}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${scanRate(product)}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100">
                <Button
                  variant="outline"
                  size="sm"
                  fullWidth
                  onClick={(e) => {
                    e.stopPropagation()
                    onGenerateSerials?.(product.id)
                  }}
                >
                  Generate Serials
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {products.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="py-12 text-center">
              <svg className="w-12 h-12 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-1">No products yet</h3>
              <p className="text-gray-500 mb-4">Get started by adding your first product</p>
              <Button onClick={onAddProduct}>Add Product</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
