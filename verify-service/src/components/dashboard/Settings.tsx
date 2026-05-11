'use client'

import React from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../ui/Card'
import { Button } from '../ui/Button'
import { Input, Select } from '../ui/Input'

interface BrandSettingsProps {
  brandName: string
  coinName: string
  coinSymbol: string
  valuePerCoin: number
  minRedeem: number
  expiryDays: number
  onSave?: (settings: Settings) => void
}

interface Settings {
  brandName: string
  coinName: string
  coinSymbol: string
  valuePerCoin: number
  minRedeem: number
  expiryDays: number
  allowRedemption: boolean
  allowConversion: boolean
}

export function Settings({
  brandName: initialBrandName,
  coinName: initialCoinName,
  coinSymbol: initialCoinSymbol,
  valuePerCoin: initialValuePerCoin,
  minRedeem: initialMinRedeem,
  expiryDays: initialExpiryDays,
  onSave,
}: BrandSettingsProps) {
  const [settings, setSettings] = React.useState<Settings>({
    brandName: initialBrandName,
    coinName: initialCoinName,
    coinSymbol: initialCoinSymbol,
    valuePerCoin: initialValuePerCoin,
    minRedeem: initialMinRedeem,
    expiryDays: initialExpiryDays,
    allowRedemption: true,
    allowConversion: true,
  })

  const [saved, setSaved] = React.useState(false)

  const handleSave = () => {
    onSave?.(settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-500">Manage your brand settings and coin configuration</p>
        </div>
        <Button onClick={handleSave}>
          {saved ? 'Saved!' : 'Save Changes'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Brand Information</CardTitle>
          <CardDescription>Basic information about your brand</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label="Brand Name"
            value={settings.brandName}
            onChange={(e) => setSettings({ ...settings, brandName: e.target.value })}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Coin Name"
              value={settings.coinName}
              onChange={(e) => setSettings({ ...settings, coinName: e.target.value })}
              hint="Name displayed to users (e.g., Brand Coins)"
            />
            <Input
              label="Coin Symbol"
              value={settings.coinSymbol}
              onChange={(e) => setSettings({ ...settings, coinSymbol: e.target.value })}
              hint="Short symbol (e.g., BC)"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Coin Configuration</CardTitle>
          <CardDescription>Configure how your brand coins work</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Value per Coin (INR)"
              type="number"
              value={settings.valuePerCoin}
              onChange={(e) => setSettings({ ...settings, valuePerCoin: parseFloat(e.target.value) })}
            />
            <Input
              label="Minimum Redeem Amount"
              type="number"
              value={settings.minRedeem}
              onChange={(e) => setSettings({ ...settings, minRedeem: parseInt(e.target.value) })}
            />
            <Input
              label="Coin Expiry (days)"
              type="number"
              value={settings.expiryDays}
              onChange={(e) => setSettings({ ...settings, expiryDays: parseInt(e.target.value) })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Permissions</CardTitle>
          <CardDescription>Control user abilities with brand coins</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.allowRedemption}
              onChange={(e) => setSettings({ ...settings, allowRedemption: e.target.checked })}
              className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <div>
              <p className="font-medium text-gray-900">Allow Redemption</p>
              <p className="text-sm text-gray-500">Users can redeem coins for rewards</p>
            </div>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.allowConversion}
              onChange={(e) => setSettings({ ...settings, allowConversion: e.target.checked })}
              className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <div>
              <p className="font-medium text-gray-900">Allow Conversion</p>
              <p className="text-sm text-gray-500">Users can convert brand coins to ReZ coins</p>
            </div>
          </label>
        </CardContent>
      </Card>
    </div>
  )
}
