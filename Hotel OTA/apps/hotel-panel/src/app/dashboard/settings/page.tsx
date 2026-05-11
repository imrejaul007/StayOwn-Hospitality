'use client';

import { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { brandCoinApi } from '@/lib/api';

function BillPayQRSection() {
  const [hotelId, setHotelId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setHotelId(sessionStorage.getItem('hotel_id'));
    }
  }, []);

  const qrPayload = hotelId
    ? JSON.stringify({ type: 'hotel_bill_pay', hotel_id: hotelId })
    : null;

  function handleCopy() {
    if (!qrPayload) return;
    navigator.clipboard.writeText(qrPayload).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6">
      <h2 className="font-semibold text-gray-800 mb-1">Bill Pay QR Code</h2>
      <p className="text-sm text-gray-500 mb-4">
        Display this QR code at checkout so guests can pay their bill and earn coins via the OTA app.
      </p>

      {hotelId ? (
        <div className="space-y-3">
          {/* QR Code */}
          <div className="border-2 border-dashed border-blue-200 rounded-xl p-6 bg-blue-50 flex flex-col items-center gap-3">
            <div className="bg-white p-3 rounded-lg shadow-sm">
              <QRCodeSVG value={qrPayload ?? ''} size={160} />
            </div>
            <p className="text-xs text-blue-600 text-center">
              Guests scan this with the OTA app to pay their bill and earn Travel Coins.
            </p>
          </div>

          {/* Raw payload */}
          <div>
            <p className="text-xs font-medium text-gray-600 mb-1">QR Payload (JSON)</p>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-start justify-between gap-2">
              <code className="text-xs font-mono text-gray-700 break-all">{qrPayload}</code>
              <button
                onClick={handleCopy}
                className="flex-shrink-0 px-2 py-1 text-xs bg-blue-600 text-white rounded font-medium hover:bg-blue-700 transition"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

        </div>
      ) : (
        <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-500">
          Hotel ID not found. Please log in again to load your Bill Pay QR Code.
        </div>
      )}
    </div>
  );
}

function BrandCoinsTab() {
  const [program, setProgram] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    brand_coin_name: '',
    brand_coin_symbol: '',
    earn_pct: 5,
    max_burn_pct: 20,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await brandCoinApi.getProgram();
      setProgram(data);
      setForm({
        brand_coin_name: data.brandCoinName ?? '',
        brand_coin_symbol: data.brandCoinSymbol ?? '',
        earn_pct: data.earnPct ?? 5,
        max_burn_pct: data.maxBurnPct ?? 20,
      });
    } catch {
      /* program not configured yet */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!form.brand_coin_name.trim() || !form.brand_coin_symbol.trim()) {
      setError('Coin name and symbol are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await brandCoinApi.updateProgram(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-gray-400">Loading loyalty program settings...</p>;

  return (
    <div className="space-y-6 max-w-lg">
      {/* Status banner */}
      {program?.brandCoinEnabled ? (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <span className="text-green-600 text-lg">✓</span>
          <div>
            <p className="text-sm font-semibold text-green-800">Loyalty Program Active</p>
            <p className="text-xs text-green-600">
              Guests earn {form.brand_coin_symbol} coins on every stay. They can spend up to {form.max_burn_pct}% on future bookings.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <span className="text-amber-600 text-lg">⚠</span>
          <div>
            <p className="text-sm font-semibold text-amber-800">Program Not Active</p>
            <p className="text-xs text-amber-600">Configure your coin name and symbol, then ask admin to enable your program.</p>
          </div>
        </div>
      )}

      {/* Coin Identity */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
        <h2 className="font-semibold text-gray-800">Coin Identity</h2>
        <p className="text-sm text-gray-500">Give your loyalty coin a unique name. Guests see this in their wallet.</p>
        <div>
          <label className="text-sm font-medium text-gray-600 block mb-1">Coin Name</label>
          <input
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            placeholder="e.g. Grand Points"
            value={form.brand_coin_name}
            onChange={(e) => setForm((f) => ({ ...f, brand_coin_name: e.target.value }))}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-600 block mb-1">Coin Symbol</label>
          <input
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            placeholder="e.g. GP (2-4 chars)"
            maxLength={4}
            value={form.brand_coin_symbol}
            onChange={(e) => setForm((f) => ({ ...f, brand_coin_symbol: e.target.value.toUpperCase() }))}
          />
        </div>
      </div>

      {/* Earn & Burn Rules */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-5">
        <h2 className="font-semibold text-gray-800">Earn & Burn Rules</h2>
        <div>
          <label className="text-sm font-medium text-gray-600 block mb-1">
            Earn Rate — <span className="text-blue-600">{form.earn_pct}% of booking value</span>
          </label>
          <input
            type="range" min={1} max={20} step={0.5}
            value={form.earn_pct}
            onChange={(e) => setForm((f) => ({ ...f, earn_pct: parseFloat(e.target.value) }))}
            className="w-full accent-blue-600"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1"><span>1%</span><span>20%</span></div>
          <p className="text-xs text-gray-500 mt-2">
            Guest books ₹5,000 → earns {Math.round(5000 * form.earn_pct / 100)} {form.brand_coin_symbol || 'coins'} (~₹{(5000 * form.earn_pct / 100 / 100).toFixed(0)})
          </p>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-600 block mb-1">
            Max Burn — <span className="text-purple-600">{form.max_burn_pct}% of booking value</span>
          </label>
          <input
            type="range" min={5} max={40} step={5}
            value={form.max_burn_pct}
            onChange={(e) => setForm((f) => ({ ...f, max_burn_pct: parseInt(e.target.value) }))}
            className="w-full accent-purple-600"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1"><span>5%</span><span>40%</span></div>
          <p className="text-xs text-gray-500 mt-2">
            Guest can offset up to {form.max_burn_pct}% of any future booking using {form.brand_coin_symbol || 'coins'}.
          </p>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
        <p className="text-sm font-semibold text-blue-800 mb-2">How the program works</p>
        <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
          <li>Coins are credited to guest wallet after checkout (via OTA platform)</li>
          <li>Coins expire 12 months after issue</li>
          <li>Guests can burn coins on future bookings at this hotel only</li>
          <li>Your hotel bears the coin cost; coins do not affect OTA settlement</li>
        </ul>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
      >
        {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Program Settings'}
      </button>
      <p className="text-xs text-gray-400">
        After saving, contact OTA admin to enable your loyalty program for guests.
      </p>
    </div>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile');

  const tabs = [
    { id: 'profile', label: 'Hotel Profile' },
    { id: 'bank', label: 'Bank Details' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'team', label: 'Team Access' },
    { id: 'brandcoins', label: '🪙 Loyalty Coins' },
    { id: 'api', label: 'API Access' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

      <div className="flex gap-2 mb-6 overflow-x-auto">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
              activeTab === tab.id ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>{tab.label}</button>
        ))}
      </div>

      {activeTab === 'profile' && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4 max-w-2xl">
          <h2 className="font-semibold text-gray-800">Hotel Profile</h2>
          {['Hotel Name', 'Description', 'Address Line 1', 'Address Line 2', 'City', 'Pincode'].map((field) => (
            <div key={field}>
              <label className="text-sm font-medium text-gray-600 block mb-1">{field}</label>
              <input className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder={field} />
            </div>
          ))}
          <div>
            <label className="text-sm font-medium text-gray-600 block mb-1">Category</label>
            <select className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
              <option>Budget</option><option>Midscale</option><option>Upscale</option><option>Boutique</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 block mb-1">Check-in / Check-out Times</label>
            <div className="flex gap-3">
              <input type="time" defaultValue="14:00" className="px-3 py-2 border rounded-lg text-sm" />
              <input type="time" defaultValue="11:00" className="px-3 py-2 border rounded-lg text-sm" />
            </div>
          </div>
          <button className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Save Changes</button>
        </div>
      )}

      {activeTab === 'bank' && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 max-w-lg">
          <h2 className="font-semibold text-gray-800 mb-4">Bank Account Details</h2>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-1">Account Number</label>
              <input className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="XXXX XXXX 1234" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-1">IFSC Code</label>
              <input className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="HDFC0001234" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-1">Account Name</label>
              <input className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
          </div>
          <p className="text-xs text-amber-600 mt-3">⚠️ Bank detail changes require OTP verification</p>
          <button className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Update Bank Details</button>
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 max-w-lg space-y-4">
          <h2 className="font-semibold text-gray-800">Notification Preferences</h2>
          {[
            { label: 'New bookings', channels: ['Email', 'SMS', 'WhatsApp'] },
            { label: 'Check-in reminders', channels: ['Email', 'SMS'] },
            { label: 'Settlement alerts', channels: ['Email'] },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between py-2 border-b border-gray-50">
              <span className="text-sm text-gray-700">{item.label}</span>
              <div className="flex gap-2">
                {item.channels.map((ch) => (
                  <label key={ch} className="flex items-center gap-1 text-xs text-gray-500">
                    <input type="checkbox" defaultChecked className="rounded" /> {ch}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'team' && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 max-w-lg">
          <h2 className="font-semibold text-gray-800 mb-4">Team Access</h2>
          <p className="text-sm text-gray-500 mb-4">Add staff phone numbers to give them access to this panel.</p>
          <div className="flex gap-2 mb-4">
            <input className="flex-1 px-3 py-2 border rounded-lg text-sm" placeholder="Phone number" />
            <select className="px-3 py-2 border rounded-lg text-sm">
              <option>Admin</option><option>Staff</option>
            </select>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">Add</button>
          </div>
          <p className="text-xs text-gray-400">Phase 2: Full team management coming soon</p>
        </div>
      )}

      {activeTab === 'brandcoins' && <BrandCoinsTab />}

      {activeTab === 'api' && (
        <div className="space-y-6 max-w-lg">
          {/* PMS API Access */}
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h2 className="font-semibold text-gray-800 mb-4">PMS API Access</h2>
            <p className="text-sm text-gray-500 mb-4">Connect your Property Management System to sync inventory and bookings automatically.</p>
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="text-xs font-mono text-gray-600 break-all">API Key: ••••••••••••••••</p>
            </div>
            <div className="flex gap-2">
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">Generate New Key</button>
              <button className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-600">View API Docs</button>
            </div>
          </div>

          {/* Bill Pay QR Code */}
          <BillPayQRSection />
        </div>
      )}
    </div>
  );
}
