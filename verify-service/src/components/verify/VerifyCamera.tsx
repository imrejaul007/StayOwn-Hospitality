'use client'

import React, { useRef, useEffect, useState } from 'react'
import { Button } from '../ui/Button'

interface VerifyCameraProps {
  onScan: (data: string) => void
  onClose: () => void
  isActive?: boolean
}

export function VerifyCamera({ onScan, onClose, isActive = true }: VerifyCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState<string>()
  const [hasCamera, setHasCamera] = useState(true)

  useEffect(() => {
    if (!isActive) return

    let stream: MediaStream | null = null

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      } catch (err) {
        console.error('Camera error:', err)
        setHasCamera(false)
        setError('Unable to access camera. Please check permissions.')
      }
    }

    startCamera()

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [isActive])

  const captureAndScan = () => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    if (!ctx) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0)

    // Note: For actual QR scanning, you would integrate a library like jsQR
    // This is a placeholder for the camera functionality
  }

  return (
    <div className="relative w-full max-w-md mx-auto">
      <div className="relative aspect-square bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />

        {!hasCamera && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <div className="text-center text-white p-6">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <p className="text-gray-300">{error || 'Camera not available'}</p>
            </div>
          </div>
        )}

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-48 h-48 border-2 border-white rounded-lg" />
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </div>

      <div className="mt-4 flex gap-3">
        <Button variant="outline" onClick={onClose} className="flex-1">
          Cancel
        </Button>
        <Button onClick={captureAndScan} className="flex-1">
          Capture
        </Button>
      </div>

      <p className="text-center text-sm text-gray-500 mt-4">
        Position the QR code within the frame
      </p>
    </div>
  )
}
