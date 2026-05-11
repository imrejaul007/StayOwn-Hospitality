import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ReZ Verify - Product Authentication Platform',
  description: 'Verify product authenticity and earn rewards with ReZ Verify',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">{children}</body>
    </html>
  )
}
