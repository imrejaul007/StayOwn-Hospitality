'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/home', label: 'Home', icon: '🏠' },
  { href: '/saved', label: 'Saved', icon: '❤️' },
  { href: '/trips', label: 'Trips', icon: '🧳' },
  { href: '/rewards', label: 'Rewards', icon: '🏆' },
  { href: '/profile', label: 'Profile', icon: '👤' },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="max-w-lg mx-auto flex">
        {tabs.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link key={tab.href} href={tab.href}
              className={`flex-1 flex flex-col items-center py-2 text-xs transition ${active ? 'text-blue-600' : 'text-gray-400'}`}>
              <span className="text-xl mb-0.5">{tab.icon}</span>
              <span className={active ? 'font-semibold' : ''}>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
