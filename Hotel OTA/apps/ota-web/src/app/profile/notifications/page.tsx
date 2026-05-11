'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';

interface NotificationSettings {
  booking_updates: boolean;
  coin_alerts: boolean;
  deals: boolean;
  rez_promotions: boolean;
  master: boolean;
}

const STORAGE_KEY = 'ota_notification_settings';

const defaultSettings: NotificationSettings = {
  booking_updates: true,
  coin_alerts: true,
  deals: true,
  rez_promotions: true,
  master: true,
};

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
        checked ? 'bg-blue-600' : 'bg-gray-200'
      } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

export default function NotificationsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try { setSettings(JSON.parse(stored)); } catch {}
      }
    }
  }, []);

  function update(key: keyof NotificationSettings, value: boolean) {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'master' && !value) {
        next.coin_alerts = false;
        next.deals = false;
        next.rez_promotions = false;
      }
      if (key === 'master' && value) {
        next.coin_alerts = true;
        next.deals = true;
        next.rez_promotions = true;
      }
      const anyOn = next.coin_alerts || next.deals || next.rez_promotions || next.booking_updates;
      next.master = anyOn;
      return next;
    });
    setSaved(false);
  }

  function handleSave() {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const items = [
    {
      key: 'booking_updates' as const,
      label: 'Booking Updates',
      desc: 'Confirmations, check-in reminders & cancellations',
      locked: true,
    },
    {
      key: 'coin_alerts' as const,
      label: 'Coin Alerts',
      desc: 'Earn notifications & expiry reminders',
      locked: false,
    },
    {
      key: 'deals' as const,
      label: 'Deals & Offers',
      desc: 'Flash sales, limited-time hotel deals',
      locked: false,
    },
    {
      key: 'rez_promotions' as const,
      label: 'ReZ Promotions',
      desc: 'ReZ coin campaigns and partner offers',
      locked: false,
    },
  ];

  return (
    <div className="max-w-lg mx-auto min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white px-5 pt-12 pb-4 flex items-center gap-3 border-b border-gray-100 sticky top-0 z-30">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700 text-lg font-medium">
          ←
        </button>
        <h1 className="text-lg font-bold text-gray-900">Notifications</h1>
      </div>

      <div className="px-4 py-5 space-y-4">
        {/* Master toggle */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-gray-900">All Notifications</p>
              <p className="text-xs text-gray-400 mt-0.5">Master switch for all alerts</p>
            </div>
            <Toggle checked={settings.master} onChange={(v) => update('master', v)} />
          </div>
        </div>

        {/* Individual toggles */}
        <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
          {items.map((item, idx) => (
            <div key={item.key} className={`flex items-center justify-between px-5 py-4 ${idx === 0 ? 'rounded-t-2xl' : ''} ${idx === items.length - 1 ? 'rounded-b-2xl' : ''}`}>
              <div className="flex-1 pr-4">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                  {item.locked && (
                    <span className="text-[9px] font-bold uppercase tracking-wide bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">Required</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
              </div>
              <Toggle
                checked={settings[item.key]}
                onChange={(v) => update(item.key, v)}
                disabled={item.locked}
              />
            </div>
          ))}
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          className="w-full bg-blue-600 text-white py-3.5 rounded-2xl font-semibold hover:bg-blue-700 transition text-sm"
        >
          {saved ? '✓ Saved!' : 'Save Preferences'}
        </button>

        <p className="text-center text-xs text-gray-400">
          Booking updates cannot be turned off as they contain important trip information.
        </p>
      </div>

      <BottomNav />
    </div>
  );
}
