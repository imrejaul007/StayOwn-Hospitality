'use client';

import { useEffect, useState } from 'react';
import { usersApi, formatINR } from '@/lib/api';

interface User {
  id: string;
  name: string;
  phone: string;
  tier: string;
  joined_at: string;
  total_bookings: number;
  coin_balance_paise: number;
  status: 'active' | 'suspended';
}

const tierStyle: Record<string, string> = {
  bronze: 'bg-orange-100 text-orange-800',
  silver: 'bg-gray-200 text-gray-700',
  gold: 'bg-yellow-100 text-yellow-800',
  platinum: 'bg-blue-100 text-blue-800',
};

const statusStyle: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  suspended: 'bg-red-100 text-red-800',
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    load();
  }, [page, search]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await usersApi.list(page, search);
      setUsers(data.users ?? []);
      setTotal(data.total ?? 0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSuspend(user: User) {
    const reason = window.prompt(`Reason for suspending ${user.name}:`);
    if (reason === null) return;
    setActionLoading(user.id);
    try {
      await usersApi.suspend(user.id, reason);
      load();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleUnsuspend(user: User) {
    if (!window.confirm(`Unsuspend ${user.name}?`)) return;
    setActionLoading(user.id);
    try {
      await usersApi.unsuspend(user.id);
      load();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCoinAdjust(user: User) {
    const input = window.prompt(
      `Manual coin adjustment for ${user.name}\nEnter amount in paise (negative to deduct, e.g. 10000 = ₹100):`
    );
    if (input === null) return;
    const amount = parseInt(input);
    if (isNaN(amount)) return alert('Invalid amount');
    const reason = window.prompt('Reason for adjustment:');
    if (reason === null) return;
    setActionLoading(user.id);
    try {
      await usersApi.adjustCoins(user.id, amount, reason);
      alert('Coin balance adjusted successfully');
      load();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  const pageCount = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Users ({total.toLocaleString()})</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setSearch(searchInput);
          }}
          className="flex gap-2"
        >
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name or phone..."
            className="px-3 py-2 border rounded-lg text-sm w-56 focus:ring-2 focus:ring-indigo-400 outline-none"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800"
          >
            Search
          </button>
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setSearchInput('');
                setPage(1);
              }}
              className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200"
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading users...</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Phone</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Tier</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Joined</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Bookings</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Coin Balance</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                    <td className="px-4 py-3 text-gray-600">{u.phone}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                          tierStyle[u.tier] ?? 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {u.tier}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(u.joined_at).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-center">{u.total_bookings}</td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatINR(u.coin_balance_paise)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                          statusStyle[u.status] ?? 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleCoinAdjust(u)}
                          disabled={actionLoading === u.id}
                          className="text-xs text-indigo-600 hover:underline font-medium disabled:opacity-40"
                        >
                          Coins
                        </button>
                        {u.status === 'active' ? (
                          <button
                            onClick={() => handleSuspend(u)}
                            disabled={actionLoading === u.id}
                            className="text-xs text-red-600 hover:underline font-medium disabled:opacity-40"
                          >
                            Suspend
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUnsuspend(u)}
                            disabled={actionLoading === u.id}
                            className="text-xs text-green-600 hover:underline font-medium disabled:opacity-40"
                          >
                            Unsuspend
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {pageCount > 1 && (
            <div className="px-4 py-3 border-t flex items-center justify-between bg-gray-50">
              <p className="text-xs text-gray-500">
                Page {page} of {pageCount} ({total.toLocaleString()} users)
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 border rounded text-xs hover:bg-gray-100 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  disabled={page === pageCount}
                  className="px-3 py-1 border rounded text-xs hover:bg-gray-100 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
