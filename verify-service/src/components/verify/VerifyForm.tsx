'use client'

import React, { useState } from 'react'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'

interface VerifyFormProps {
  onSubmit: (serial: string) => void
  isLoading?: boolean
}

export function VerifyForm({ onSubmit, isLoading = false }: VerifyFormProps) {
  const [serial, setSerial] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (serial.trim()) {
      onSubmit(serial.trim())
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md mx-auto">
      <div className="space-y-4">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Verify Product</h2>
          <p className="text-gray-500 mt-2">Enter the serial number or scan QR code</p>
        </div>

        <Input
          value={serial}
          onChange={(e) => setSerial(e.target.value.toUpperCase())}
          placeholder="Enter serial number (e.g., RZ-XXXX-XXXX-XXXX)"
          className="text-center font-mono text-lg"
          autoFocus
          autoComplete="off"
          leftIcon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
          }
        />

        <Button
          type="submit"
          fullWidth
          size="lg"
          isLoading={isLoading}
          disabled={!serial.trim()}
        >
          Verify
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">or</span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          fullWidth
          size="lg"
          onClick={() => {
            const event = new CustomEvent('openCamera')
            window.dispatchEvent(event)
          }}
          leftIcon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        >
          Scan QR Code
        </Button>
      </div>
    </form>
  )
}
