'use client'

import React from 'react'
import { Button } from '../ui/Button'

interface ClaimButtonProps {
  amount: number
  coinType: 'BRANDED' | 'REZ'
  onClaim: () => void
  isLoading?: boolean
  disabled?: boolean
}

export function ClaimButton({
  amount,
  coinType,
  onClaim,
  isLoading = false,
  disabled = false,
}: ClaimButtonProps) {
  return (
    <Button
      onClick={onClaim}
      isLoading={isLoading}
      disabled={disabled || isLoading}
      leftIcon={
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      }
    >
      Claim {amount} {coinType === 'BRANDED' ? 'Brand Coins' : 'ReZ Coins'}
    </Button>
  )
}
