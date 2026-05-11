'use client'

import { Settings } from '@/components/dashboard/Settings'

export default function SettingsPage() {
  return (
    <Settings
      brandName="My Brand"
      coinName="Brand Coins"
      coinSymbol="BC"
      valuePerCoin={1}
      minRedeem={100}
      expiryDays={90}
      onSave={(settings) => {
        console.log('Save settings:', settings)
      }}
    />
  )
}
