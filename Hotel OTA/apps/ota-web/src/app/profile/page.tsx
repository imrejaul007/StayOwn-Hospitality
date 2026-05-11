'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import BottomNav from '@/components/BottomNav';
import { clearSessionCookie, getUser } from '@/lib/api';

const tierColors: Record<string, string> = {
  basic: 'bg-gray-100 text-gray-700',
  silver: 'bg-gray-200 text-gray-700',
  gold: 'bg-amber-100 text-amber-700',
  platinum: 'bg-purple-100 text-purple-700',
};

interface MenuSection {
  title: string;
  items: { label: string; icon: string; href?: string; onClick?: () => void; danger?: boolean }[];
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    setUser(getUser());
  }, []);

  function handleLogout() {
    clearSessionCookie();
    router.push('/');
  }

  const tier = user?.tier || 'basic';
  const initials = user?.full_name
    ? user.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : (user?.phone?.[0] || 'U');

  const menuSections: MenuSection[] = [
    {
      title: 'My Account',
      items: [
        { label: 'Edit Profile', icon: '✏️', href: '/profile/edit' },
        { label: 'Notifications', icon: '🔔', href: '/profile/notifications' },
        { label: 'Privacy Settings', icon: '🔒', href: '/profile/privacy' },
      ],
    },
    {
      title: 'Travel',
      items: [
        { label: 'My Bookings', icon: '📋', href: '/trips' },
        { label: 'Vouchers & Offers', icon: '🎟️', href: '/profile/vouchers' },
      ],
    },
    {
      title: 'Rewards',
      items: [
        { label: 'My Coins', icon: '🏆', href: '/rewards' },
        { label: 'Refer &amp; Earn', icon: '👥', href: '/profile/referral' },
      ],
    },
    {
      title: 'Support',
      items: [
        { label: 'Chat with Us', icon: '💬', href: '/profile/support' },
        { label: 'Call Support', icon: '📞', href: 'tel:+918001234567' },
        { label: 'FAQ', icon: '❓', href: '/profile/support' },
      ],
    },
    {
      title: 'Legal',
      items: [
        { label: 'Terms &amp; Conditions', icon: '📄', href: '/profile/terms' },
        { label: 'Privacy Policy', icon: '🛡️', href: '/profile/privacy-policy' },
      ],
    },
  ];

  return (
    <div className="max-w-lg mx-auto min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="px-5 pt-12 pb-4">
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
      </div>

      {/* Avatar Card */}
      <div className="mx-4 bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shrink-0">
            {user?.photo_url ? (
              <img
                src={user.photo_url}
                alt="avatar"
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : (
              <span className="text-white text-2xl font-bold">{initials}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-gray-900 truncate">{user?.full_name || 'Traveller'}</h2>
            <p className="text-sm text-gray-400 mt-0.5">+91 {user?.phone || '—'}</p>
            {user?.email && (
              <p className="text-xs text-gray-400 mt-0.5 truncate">{user.email}</p>
            )}
          </div>
          <Link href="/profile/edit" className="shrink-0 text-blue-600 hover:text-blue-700">
            <span className="text-lg">✏️</span>
          </Link>
        </div>
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-50">
          <span className={`px-3 py-1 rounded-full text-xs font-bold capitalize ${tierColors[tier] || tierColors.basic}`}>
            {tier} Tier
          </span>
          <Link href="/rewards" className="text-xs text-blue-600 font-medium hover:underline ml-auto">
            View Rewards →
          </Link>
        </div>
      </div>

      {/* Menu Sections */}
      <div className="space-y-4 mt-4 px-4">
        {menuSections.map((section) => (
          <div key={section.title} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <p className="px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-50">
              {section.title}
            </p>
            {section.items.map((item, idx) => {
              const isLast = idx === section.items.length - 1;
              const content = (
                <div
                  className={`flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition ${!isLast ? 'border-b border-gray-50' : ''}`}
                >
                  <span className="text-lg shrink-0">{item.icon}</span>
                  <span className={`flex-1 text-sm font-medium ${item.danger ? 'text-red-600' : 'text-gray-700'}`}>
                    {item.label}
                  </span>
                  <span className="text-gray-300 text-sm">›</span>
                </div>
              );

              if (item.onClick) {
                return (
                  <button key={item.label} onClick={item.onClick} className="w-full text-left">
                    {content}
                  </button>
                );
              }
              if (item.href?.startsWith('tel:') || item.href?.startsWith('http')) {
                return (
                  <a key={item.label} href={item.href}>
                    {content}
                  </a>
                );
              }
              return (
                <Link key={item.label} href={item.href || '#'}>
                  {content}
                </Link>
              );
            })}
          </div>
        ))}

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full bg-white border border-red-200 text-red-600 py-4 rounded-2xl font-semibold hover:bg-red-50 transition text-sm"
        >
          Sign Out
        </button>

        <p className="text-center text-[10px] text-gray-300 pb-2">StayOwn · v1.0.0</p>
      </div>

      <BottomNav />
    </div>
  );
}
