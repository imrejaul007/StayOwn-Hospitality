'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { VerifyResult } from '@/components/verify/VerifyResult'

export default function VerifySerialPage() {
  const params = useParams()
  const serial = params.serial as string
  const [result, setResult] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const verifySerial = async () => {
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

    if (serial) {
      verifySerial()
    }
  }, [serial])

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
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-500">Verifying product...</p>
          </div>
        ) : result ? (
          <>
            <VerifyResult result={result} />
            <button
              onClick={() => window.history.back()}
              className="mt-4 w-full py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              Go Back
            </button>
          </>
        ) : null}
      </main>
    </div>
  )
}
