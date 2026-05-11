'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { clearSessionCookie } from '@/lib/api';

interface NavItem {
  href?: string;
  label: string;
  children?: { href: string; label: string }[];
}

const navGroups: NavItem[] = [
  { href: '/dashboard', label: 'Overview' },
  {
    label: 'Hotels',
    children: [
      { href: '/dashboard/hotels', label: 'All Hotels' },
      { href: '/dashboard/hotels/onboarding', label: 'Onboarding' },
      { href: '/dashboard/hotels/suspended', label: 'Suspended' },
    ],
  },
  { href: '/dashboard/bookings', label: 'Bookings' },
  { href: '/dashboard/users', label: 'Users' },
  {
    label: 'Coins',
    children: [
      { href: '/dashboard/coin-liability', label: 'Liability' },
      { href: '/dashboard/earn-rules', label: 'Earn Rules' },
      { href: '/dashboard/burn-rules', label: 'Burn Rules' },
    ],
  },
  {
    label: 'Settlements',
    children: [
      { href: '/dashboard/settlements', label: 'Pending' },
      { href: '/dashboard/settlements/history', label: 'History' },
    ],
  },
  {
    label: 'Ownership Mining',
    children: [
      { href: '/dashboard/mining', label: 'Run Mining' },
      { href: '/dashboard/mining/disputes', label: 'Disputes' },
    ],
  },
  { href: '/dashboard/stay-registrations', label: 'Stay Registrations' },
  { href: '/dashboard/bill-payments', label: 'Bill Payments' },
  { href: '/dashboard/rez', label: 'ReZ Integration' },
  { href: '/dashboard/config', label: 'Config' },
  { href: '/dashboard/admin-users', label: 'Admin Users' },
];

function NavGroup({ item, pathname }: { item: NavItem; pathname: string }) {
  const isChildActive = item.children?.some((c) => pathname.startsWith(c.href));
  const [open, setOpen] = useState(isChildActive ?? false);

  if (!item.children) {
    const isActive = pathname === item.href;
    return (
      <Link
        href={item.href!}
        className={`block px-4 py-2 rounded-lg text-sm transition ${
          isActive
            ? 'bg-indigo-600 text-white font-medium'
            : 'text-gray-300 hover:bg-gray-800 hover:text-white'
        }`}
      >
        {item.label}
      </Link>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between px-4 py-2 rounded-lg text-sm transition ${
          isChildActive
            ? 'text-white font-medium'
            : 'text-gray-300 hover:bg-gray-800 hover:text-white'
        }`}
      >
        <span>{item.label}</span>
        <svg
          className={`w-4 h-4 transition-transform ${open ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
      {open && (
        <div className="ml-4 mt-1 space-y-0.5">
          {item.children.map((child) => {
            const isActive = pathname === child.href || pathname.startsWith(child.href + '/');
            return (
              <Link
                key={child.href}
                href={child.href}
                className={`block px-4 py-2 rounded-lg text-sm transition ${
                  isActive
                    ? 'bg-indigo-600 text-white font-medium'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                {child.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <aside className="w-60 bg-gray-900 text-gray-300 min-h-screen flex flex-col flex-shrink-0">
      <div className="p-5 border-b border-gray-800">
        <h2 className="text-lg font-bold text-white">OTA Admin</h2>
        <p className="text-xs text-gray-500 mt-0.5">Platform Administration</p>
      </div>
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navGroups.map((item) => (
          <NavGroup key={item.href ?? item.label} item={item} pathname={pathname} />
        ))}
      </nav>
      <div className="p-3 border-t border-gray-800">
        <button
          onClick={() => {
            clearSessionCookie();
            router.push('/');
          }}
          className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-gray-800 rounded-lg transition"
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}
