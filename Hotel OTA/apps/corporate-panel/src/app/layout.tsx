import './globals.css';
export const metadata = { title: 'Corporate Travel - OTA', description: 'Corporate travel booking portal' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body className="bg-gray-50 min-h-screen">{children}</body></html>;
}
