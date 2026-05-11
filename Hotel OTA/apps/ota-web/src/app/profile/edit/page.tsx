'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { userApi, getUser } from '@/lib/api';

export default function EditProfilePage() {
  const router = useRouter();
  const [form, setForm] = useState({ full_name: '', email: '', photo_url: '' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const user = getUser();
    if (user) {
      setForm({
        full_name: user.full_name || '',
        email: user.email || '',
        photo_url: user.photo_url || '',
      });
    }
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);
    try {
      const res = await userApi.updateProfile({
        full_name: form.full_name || undefined,
        email: form.email || undefined,
        photo_url: form.photo_url || undefined,
      });
      // Update localStorage user data
      const currentUser = getUser() || {};
      const updated = { ...currentUser, ...res.user, ...res };
      localStorage.setItem('ota_user', JSON.stringify(updated));
      setSuccess(true);
      setTimeout(() => router.push('/profile'), 1200);
    } catch (err: any) {
      setError(err.message || 'Update failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const initials = form.full_name
    ? form.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  return (
    <div className="max-w-lg mx-auto min-h-screen bg-gray-50 pb-10">
      {/* Top Bar */}
      <div className="bg-white px-5 pt-12 pb-4 flex items-center gap-3 border-b border-gray-100 sticky top-0 z-30">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700 text-lg">
          ←
        </button>
        <h1 className="text-lg font-bold text-gray-900">Edit Profile</h1>
      </div>

      {/* Avatar Preview */}
      <div className="flex flex-col items-center pt-8 pb-4">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center overflow-hidden shadow-md">
          {form.photo_url ? (
            <img src={form.photo_url} alt="avatar preview" className="w-20 h-20 object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          ) : (
            <span className="text-white text-3xl font-bold">{initials}</span>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-2">Update photo URL below</p>
      </div>

      <form onSubmit={handleSubmit} className="px-4 space-y-4">
        {/* Full Name */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Full Name</label>
          <input
            type="text"
            name="full_name"
            value={form.full_name}
            onChange={handleChange}
            placeholder="Your full name"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email Address</label>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder="your@email.com"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
          />
        </div>

        {/* Photo URL */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Profile Photo URL</label>
          <input
            type="url"
            name="photo_url"
            value={form.photo_url}
            onChange={handleChange}
            placeholder="https://example.com/your-photo.jpg"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
          />
          <p className="text-xs text-gray-400 mt-1">Paste a direct link to your profile photo.</p>
        </div>

        {/* Success / Error */}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 flex items-center gap-2">
            <span>✓</span> Profile updated successfully!
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Save Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-base hover:bg-blue-700 disabled:opacity-50 transition shadow-lg mt-2"
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </button>

        <button
          type="button"
          onClick={() => router.back()}
          className="w-full border border-gray-200 text-gray-600 py-3.5 rounded-2xl font-semibold hover:bg-gray-50 transition text-sm"
        >
          Cancel
        </button>
      </form>
    </div>
  );
}
