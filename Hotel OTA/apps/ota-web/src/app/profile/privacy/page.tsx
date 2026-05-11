'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';

const STORAGE_KEY = 'ota_privacy_settings';

interface PrivacySettings {
  data_sharing: boolean;
  analytics: boolean;
}

const defaultSettings: PrivacySettings = {
  data_sharing: false,
  analytics: true,
};

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
        checked ? 'bg-blue-600' : 'bg-gray-200'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

export default function PrivacyPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<PrivacySettings>(defaultSettings);
  const [saved, setSaved] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try { setSettings(JSON.parse(stored)); } catch {}
      }
    }
  }, []);

  function update(key: keyof PrivacySettings, value: boolean) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function handleSave() {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleDeleteRequest() {
    if (deleteConfirm.toLowerCase() !== 'delete') return;
    setDeleting(true);
    try {
      // In production: call DELETE /user/account
      await new Promise((r) => setTimeout(r, 1000));
      setDeleteSuccess(true);
      setDeleteModal(false);
    } catch (err: any) {
      alert(err.message || 'Request failed. Please contact support.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white px-5 pt-12 pb-4 flex items-center gap-3 border-b border-gray-100 sticky top-0 z-30">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700 text-lg font-medium">
          ←
        </button>
        <h1 className="text-lg font-bold text-gray-900">Privacy & Data</h1>
      </div>

      <div className="px-4 py-5 space-y-4">
        {/* Privacy toggles */}
        <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
          <div className="flex items-center justify-between px-5 py-4 rounded-t-2xl">
            <div className="flex-1 pr-4">
              <p className="text-sm font-semibold text-gray-900">Data Sharing with Partners</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Allow us to share anonymised data with hotel partners to improve offers
              </p>
            </div>
            <Toggle checked={settings.data_sharing} onChange={(v) => update('data_sharing', v)} />
          </div>

          <div className="flex items-center justify-between px-5 py-4 rounded-b-2xl">
            <div className="flex-1 pr-4">
              <p className="text-sm font-semibold text-gray-900">Analytics & Crash Reports</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Help us improve the app by sharing usage analytics and crash data
              </p>
            </div>
            <Toggle checked={settings.analytics} onChange={(v) => update('analytics', v)} />
          </div>
        </div>

        <button
          onClick={handleSave}
          className="w-full bg-blue-600 text-white py-3.5 rounded-2xl font-semibold hover:bg-blue-700 transition text-sm"
        >
          {saved ? '✓ Saved!' : 'Save Privacy Settings'}
        </button>

        {/* Info box */}
        <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
          <p className="text-xs font-semibold text-blue-700 mb-1">Your data is protected</p>
          <p className="text-xs text-blue-600 leading-relaxed">
            We never sell your personal data. Any sharing is anonymised and subject to our Privacy Policy.
            You can request a full data export by contacting support.
          </p>
        </div>

        {/* Account Deletion */}
        <div className="bg-white rounded-2xl border border-red-100 p-5">
          <h3 className="font-bold text-gray-900 mb-1">Account Deletion</h3>
          <p className="text-xs text-gray-400 mb-4 leading-relaxed">
            Deleting your account is permanent. All your data, bookings history, coins and rewards will be removed.
            Active bookings must be cancelled before deletion.
          </p>
          <button
            onClick={() => setDeleteModal(true)}
            className="w-full border border-red-300 text-red-600 py-3 rounded-xl font-semibold hover:bg-red-50 transition text-sm"
          >
            Request Account Deletion
          </button>
        </div>

        {deleteSuccess && (
          <div className="bg-green-50 border border-green-100 rounded-2xl p-4 text-center">
            <p className="text-sm font-semibold text-green-700">Deletion request submitted</p>
            <p className="text-xs text-green-600 mt-1">Our team will process your request within 7 business days.</p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full max-w-lg mx-auto rounded-t-3xl p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Delete Account</h3>
            <p className="text-sm text-gray-500 mb-4">
              This action is permanent and cannot be undone. Type <span className="font-bold text-red-600">delete</span> to confirm.
            </p>
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder='Type "delete" to confirm'
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-red-400 focus:outline-none mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setDeleteModal(false); setDeleteConfirm(''); }}
                className="flex-1 border border-gray-200 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-50 transition text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteRequest}
                disabled={deleting || deleteConfirm.toLowerCase() !== 'delete'}
                className="flex-1 bg-red-600 text-white py-3 rounded-xl font-semibold hover:bg-red-700 disabled:opacity-50 transition text-sm"
              >
                {deleting ? 'Submitting...' : 'Delete My Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
