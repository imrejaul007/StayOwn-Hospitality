import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'StayOwn - Book Hotels, Earn Rewards',
  description: 'Book hotels and earn Travel Coins + ReZ Coins on every stay. Part of the REZ ecosystem.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  );
}
