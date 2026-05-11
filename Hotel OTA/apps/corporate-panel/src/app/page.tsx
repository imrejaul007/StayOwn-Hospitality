'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CorporateLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    // For now, corporate users authenticate via admin JWT
    // In production, this would be a separate corporate auth flow
    alert('Corporate login coming soon. Use admin panel to manage corporate accounts.');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-100">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-gray-900 text-center">Corporate Travel</h1>
        <p className="text-gray-500 text-center mt-2 mb-8">OTA Business Booking Portal</p>
        <form onSubmit={handleLogin}>
          <label className="block text-sm font-medium text-gray-700 mb-1">Work Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg mb-4" placeholder="you@company.com" required />
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg mb-4" required />
          <button type="submit"
            className="w-full bg-emerald-600 text-white py-3 rounded-lg font-semibold hover:bg-emerald-700 transition">
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
