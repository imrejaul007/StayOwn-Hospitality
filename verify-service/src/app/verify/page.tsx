'use client'

import { useState } from 'react'
import Link from 'next/link'
import { VerifyForm } from '@/components/verify/VerifyForm'
import { VerifyResult } from '@/components/verify/VerifyResult'

export default function VerifyPage() {
  const [result, setResult] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleVerify = async (serial: string) => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serialNumber: serial }),
      })
      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult({ success: false, valid: false, error: 'Network error' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">R</span>
            </div>
            <span className="font-bold text-gray-900">ReZ Verify</span>
          </Link>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-12">
        <VerifyForm onSubmit={handleVerify} isLoading={isLoading} />

        {result && (
          <div className="mt-6">
            <VerifyResult result={result} />
            <button
              onClick={() => setResult(null)}
              className="mt-4 w-full py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              Verify Another Product
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
