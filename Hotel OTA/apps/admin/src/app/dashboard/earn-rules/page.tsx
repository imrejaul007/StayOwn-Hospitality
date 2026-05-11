'use client';

import { useEffect, useState } from 'react';
import { earnRulesApi } from '@/lib/api';

interface EarnRule {
  id: string;
  rule_name: string;
  coin_type: string;
  channel_source: string;
  earn_pct: number;
  valid_from: string;
  valid_until?: string;
  active: boolean;
}

const defaultForm = {
  rule_name: '',
  coin_type: 'ota',
  channel_source: 'all',
  earn_pct: '',
  valid_from: new Date().toISOString().split('T')[0],
  valid_until: '',
};

export default function EarnRulesPage() {
  const [rules, setRules] = useState<EarnRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await earnRulesApi.list();
      setRules(data.rules ?? []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function startEdit(rule: EarnRule) {
    setEditId(rule.id);
    setForm({
      rule_name: rule.rule_name,
      coin_type: rule.coin_type,
      channel_source: rule.channel_source,
      earn_pct: String(rule.earn_pct),
      valid_from: rule.valid_from.split('T')[0],
      valid_until: rule.valid_until ? rule.valid_until.split('T')[0] : '',
    });
    setShowForm(true);
    setSuccess('');
    setError('');
  }

  function cancelForm() {
    setShowForm(false);
    setEditId(null);
    setForm(defaultForm);
    setSuccess('');
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        ...form,
        earn_pct: parseFloat(form.earn_pct),
        valid_until: form.valid_until || undefined,
      };
      if (editId) {
        await earnRulesApi.update(editId, payload);
        setSuccess('Earn rule updated');
      } else {
        await earnRulesApi.create(payload);
        setSuccess('Earn rule created');
      }
      cancelForm();
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Delete earn rule "${name}"?`)) return;
    try {
      await earnRulesApi.delete(id);
      load();
    } catch (err: any) {
      alert(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Earn Rules</h1>
        {!showForm && (
          <button
            onClick={() => {
              setShowForm(true);
              setEditId(null);
              setForm(defaultForm);
              setSuccess('');
              setError('');
            }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            + New Rule
          </button>
        )}
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
          {success}
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border p-6 max-w-2xl">
          <h2 className="font-semibold text-gray-800 mb-4">
            {editId ? 'Edit Earn Rule' : 'Create New Earn Rule'}
          </h2>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rule Name</label>
              <input
                value={form.rule_name}
                onChange={(e) => setForm({ ...form, rule_name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                placeholder="Diwali Bonus Campaign"
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Coin Type</label>
                <select
                  value={form.coin_type}
                  onChange={(e) => setForm({ ...form, coin_type: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                >
                  <option value="ota">OTA Coin</option>
                  <option value="rez">ReZ Coin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Channel</label>
                <select
                  value={form.channel_source}
                  onChange={(e) => setForm({ ...form, channel_source: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                >
                  <option value="all">All</option>
                  <option value="ota_app">OTA App</option>
                  <option value="rez_app">ReZ App</option>
                  <option value="corporate">Corporate</option>
                  <option value="hotel_qr">Hotel QR</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Earn %</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.earn_pct}
                  onChange={(e) => setForm({ ...form, earn_pct: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                  placeholder="6.00"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valid From</label>
                <input
                  type="date"
                  value={form.valid_from}
                  onChange={(e) => setForm({ ...form, valid_from: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valid Until <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="date"
                  value={form.valid_until}
                  onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : editId ? 'Update Rule' : 'Create Rule'}
              </button>
              <button
                type="button"
                onClick={cancelForm}
                className="px-5 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading earn rules...</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-4 py-3 text-left font-medium text-gray-600">Rule Name</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Coin Type</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Channel</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Earn %</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Valid From</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Valid Until</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                    No earn rules configured
                  </td>
                </tr>
              ) : (
                rules.map((r) => (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{r.rule_name}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 rounded text-xs bg-indigo-50 text-indigo-700 uppercase font-medium">
                        {r.coin_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-xs capitalize">{r.channel_source}</td>
                    <td className="px-4 py-3 text-center font-semibold">{r.earn_pct}%</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {new Date(r.valid_from).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {r.valid_until ? new Date(r.valid_until).toLocaleDateString('en-IN') : 'Ongoing'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          r.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {r.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <button
                          onClick={() => startEdit(r)}
                          className="text-xs text-indigo-600 hover:underline font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(r.id, r.rule_name)}
                          className="text-xs text-red-500 hover:underline font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
