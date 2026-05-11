'use client';

import { useEffect, useState } from 'react';
import { burnRulesApi } from '@/lib/api';

interface BurnRule {
  id: string;
  rule_name: string;
  coin_type: string;
  tier: string;
  max_burn_pct: number;
  min_cash_pct: number;
  active: boolean;
  created_at: string;
}

const defaultForm = {
  rule_name: '',
  coin_type: 'ota',
  tier: 'all',
  max_burn_pct: '',
  min_cash_pct: '',
};

export default function BurnRulesPage() {
  const [rules, setRules] = useState<BurnRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await burnRulesApi.list();
      setRules(data.rules ?? []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function startEdit(rule: BurnRule) {
    setEditId(rule.id);
    setForm({
      rule_name: rule.rule_name,
      coin_type: rule.coin_type,
      tier: rule.tier,
      max_burn_pct: String(rule.max_burn_pct),
      min_cash_pct: String(rule.min_cash_pct),
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
        max_burn_pct: parseFloat(form.max_burn_pct),
        min_cash_pct: parseFloat(form.min_cash_pct),
      };
      if (editId) {
        await burnRulesApi.update(editId, payload);
        setSuccess('Burn rule updated successfully');
      } else {
        await burnRulesApi.create(payload);
        setSuccess('Burn rule created successfully');
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
    if (!window.confirm(`Delete burn rule "${name}"?`)) return;
    try {
      await burnRulesApi.delete(id);
      load();
    } catch (err: any) {
      alert(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Burn Rules</h1>
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
            {editId ? 'Edit Burn Rule' : 'Create New Burn Rule'}
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
                placeholder="e.g. Gold Tier Standard"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Applicable Tier</label>
                <select
                  value={form.tier}
                  onChange={(e) => setForm({ ...form, tier: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                >
                  <option value="all">All Tiers</option>
                  <option value="bronze">Bronze</option>
                  <option value="silver">Silver</option>
                  <option value="gold">Gold</option>
                  <option value="platinum">Platinum</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Burn % <span className="text-gray-400 font-normal">(max coins to use)</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={form.max_burn_pct}
                  onChange={(e) => setForm({ ...form, max_burn_pct: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                  placeholder="30.00"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Min Cash % <span className="text-gray-400 font-normal">(minimum cash portion)</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={form.min_cash_pct}
                  onChange={(e) => setForm({ ...form, min_cash_pct: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                  placeholder="70.00"
                  required
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
        <div className="text-center py-12 text-gray-400 text-sm">Loading burn rules...</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-4 py-3 text-left font-medium text-gray-600">Rule Name</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Coin Type</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Tier</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Max Burn %</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Min Cash %</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                    No burn rules configured yet
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
                    <td className="px-4 py-3 text-center capitalize">{r.tier}</td>
                    <td className="px-4 py-3 text-center font-medium">{r.max_burn_pct}%</td>
                    <td className="px-4 py-3 text-center font-medium">{r.min_cash_pct}%</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          r.active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-600'
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
