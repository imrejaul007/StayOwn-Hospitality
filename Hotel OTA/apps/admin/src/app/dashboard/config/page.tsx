'use client';

import { useEffect, useState } from 'react';
import { configApi } from '@/lib/api';

interface SystemConfig {
  commission_default_pct: number;
  booking_advance_days_min: number;
  booking_advance_days_max: number;
  max_rooms_per_booking: number;
  coin_earn_default_pct: number;
  coin_burn_max_pct: number;
  coin_min_burn_amount_paise: number;
  coin_expiry_days: number;
  maintenance_mode: boolean;
  maintenance_message: string;
}

export default function ConfigPage() {
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [cities, setCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newCity, setNewCity] = useState('');
  const [addingCity, setAddingCity] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState<string>('commission');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [c, ci] = await Promise.allSettled([configApi.get(), configApi.getCities()]);
      if (c.status === 'fulfilled') setConfig(c.value);
      if (ci.status === 'fulfilled') setCities(ci.value.cities ?? []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!config) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await configApi.update(config);
      setSuccess('Configuration saved successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddCity(e: React.FormEvent) {
    e.preventDefault();
    if (!newCity.trim()) return;
    setAddingCity(true);
    try {
      await configApi.addCity(newCity.trim());
      setNewCity('');
      const data = await configApi.getCities();
      setCities(data.cities ?? []);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAddingCity(false);
    }
  }

  async function handleRemoveCity(city: string) {
    if (!window.confirm(`Remove city "${city}"?`)) return;
    try {
      await configApi.removeCity(city);
      setCities((prev) => prev.filter((c) => c !== city));
    } catch (err: any) {
      alert(err.message);
    }
  }

  function update(key: keyof SystemConfig, value: any) {
    setConfig((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  const sections = [
    { id: 'commission', label: 'Commission & Booking' },
    { id: 'coins', label: 'Coin Defaults' },
    { id: 'cities', label: 'Cities' },
    { id: 'maintenance', label: 'Maintenance Mode' },
  ];

  if (loading) {
    return <div className="text-center py-12 text-gray-400 text-sm">Loading config...</div>;
  }

  if (!config) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 text-sm">{error || 'Failed to load configuration'}</p>
        <button onClick={load} className="mt-3 text-indigo-600 text-sm hover:underline">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">System Configuration</h1>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
          {success}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-6">
        {/* Section Nav */}
        <aside className="w-48 flex-shrink-0">
          <nav className="space-y-1">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`w-full text-left px-4 py-2.5 rounded-lg text-sm transition ${
                  activeSection === s.id
                    ? 'bg-indigo-50 text-indigo-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {s.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <div className="flex-1">
          <form onSubmit={handleSave}>
            {/* Commission & Booking */}
            {activeSection === 'commission' && (
              <div className="bg-white rounded-xl shadow-sm border p-6 space-y-5">
                <h2 className="font-semibold text-gray-800">Commission & Booking Rules</h2>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Default Commission %
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={config.commission_default_pct}
                    onChange={(e) => update('commission_default_pct', parseFloat(e.target.value))}
                    className="w-48 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                  />
                  <p className="text-xs text-gray-400 mt-1">Applied to hotels without custom commission</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Min Advance Booking (days)
                    </label>
                    <input
                      type="number"
                      value={config.booking_advance_days_min}
                      onChange={(e) => update('booking_advance_days_min', parseInt(e.target.value))}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Advance Booking (days)
                    </label>
                    <input
                      type="number"
                      value={config.booking_advance_days_max}
                      onChange={(e) => update('booking_advance_days_max', parseInt(e.target.value))}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Rooms per Booking
                  </label>
                  <input
                    type="number"
                    value={config.max_rooms_per_booking}
                    onChange={(e) => update('max_rooms_per_booking', parseInt(e.target.value))}
                    className="w-48 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                  />
                </div>
              </div>
            )}

            {/* Coin Defaults */}
            {activeSection === 'coins' && (
              <div className="bg-white rounded-xl shadow-sm border p-6 space-y-5">
                <h2 className="font-semibold text-gray-800">Coin Defaults</h2>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Default Earn %
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={config.coin_earn_default_pct}
                      onChange={(e) => update('coin_earn_default_pct', parseFloat(e.target.value))}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                    />
                    <p className="text-xs text-gray-400 mt-1">Default earn rate when no rule matches</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Burn %
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={config.coin_burn_max_pct}
                      onChange={(e) => update('coin_burn_max_pct', parseFloat(e.target.value))}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                    />
                    <p className="text-xs text-gray-400 mt-1">Global cap on coin usage per booking</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Min Burn Amount (paise)
                    </label>
                    <input
                      type="number"
                      value={config.coin_min_burn_amount_paise}
                      onChange={(e) => update('coin_min_burn_amount_paise', parseInt(e.target.value))}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                    />
                    <p className="text-xs text-gray-400 mt-1">Minimum coins user must burn</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Coin Expiry (days)
                    </label>
                    <input
                      type="number"
                      value={config.coin_expiry_days}
                      onChange={(e) => update('coin_expiry_days', parseInt(e.target.value))}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                    />
                    <p className="text-xs text-gray-400 mt-1">Days before coins expire after earning</p>
                  </div>
                </div>
              </div>
            )}

            {/* Maintenance Mode */}
            {activeSection === 'maintenance' && (
              <div className="bg-white rounded-xl shadow-sm border p-6 space-y-5">
                <h2 className="font-semibold text-gray-800">Maintenance Mode</h2>

                <div className="flex items-center gap-4">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.maintenance_mode}
                      onChange={(e) => update('maintenance_mode', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-400 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                  </label>
                  <span className={`text-sm font-medium ${config.maintenance_mode ? 'text-red-700' : 'text-gray-700'}`}>
                    {config.maintenance_mode ? 'MAINTENANCE MODE ON — App is inaccessible to users' : 'Maintenance mode off'}
                  </span>
                </div>

                {config.maintenance_mode && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Maintenance Message (shown to users)
                    </label>
                    <textarea
                      value={config.maintenance_message}
                      onChange={(e) => update('maintenance_message', e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none resize-none"
                      placeholder="We are currently performing maintenance. We'll be back shortly."
                    />
                  </div>
                )}
              </div>
            )}

            {activeSection !== 'cities' && (
              <div className="mt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}
          </form>

          {/* Cities Section */}
          {activeSection === 'cities' && (
            <div className="bg-white rounded-xl shadow-sm border p-6 space-y-5">
              <h2 className="font-semibold text-gray-800">Active Cities</h2>

              <form onSubmit={handleAddCity} className="flex gap-2">
                <input
                  value={newCity}
                  onChange={(e) => setNewCity(e.target.value)}
                  placeholder="Add new city..."
                  className="px-3 py-2 border rounded-lg text-sm w-64 focus:ring-2 focus:ring-indigo-400 outline-none"
                />
                <button
                  type="submit"
                  disabled={addingCity || !newCity.trim()}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  {addingCity ? 'Adding...' : 'Add City'}
                </button>
              </form>

              <div className="flex flex-wrap gap-2">
                {cities.length === 0 ? (
                  <p className="text-sm text-gray-400">No cities configured</p>
                ) : (
                  cities.map((city) => (
                    <div
                      key={city}
                      className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full text-sm"
                    >
                      <span className="text-gray-800">{city}</span>
                      <button
                        onClick={() => handleRemoveCity(city)}
                        className="text-gray-400 hover:text-red-600 font-medium text-xs ml-1"
                      >
                        ×
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
