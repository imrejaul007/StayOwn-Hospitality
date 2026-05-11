'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'

export default function CreateCampaignPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    // Handle form submission
    setTimeout(() => {
      setIsSubmitting(false)
      router.push('/dashboard/campaigns')
    }, 1000)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Create Campaign</h1>
        <p className="text-gray-500">Create a new reward campaign for your products</p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Campaign Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input label="Campaign Name" required placeholder="Summer Sale Rewards" />
            <Textarea label="Description" placeholder="Describe your campaign..." />
            <Select
              label="Campaign Type"
              options={[
                { value: 'PER_SCAN', label: 'Per Scan' },
                { value: 'FIRST_N', label: 'First N Scanners' },
                { value: 'GEO_TARGETED', label: 'Geo Targeted' },
                { value: 'TIME_BOOST', label: 'Time Boost' },
              ]}
            />
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Rewards</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Reward Amount"
              type="number"
              required
              placeholder="50"
              hint="Number of coins to award per qualifying scan"
            />
            <Input
              label="Budget Cap (Optional)"
              type="number"
              placeholder="1000"
              hint="Maximum total rewards to distribute"
            />
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Schedule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input label="Start Date" type="date" required />
            <Input label="End Date (Optional)" type="date" />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            Create Campaign
          </Button>
        </div>
      </form>
    </div>
  )
}
