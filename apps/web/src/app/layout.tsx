import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';
import { BottomNav } from '@/components/navigation/BottomNav';

export const metadata: Metadata = {
  title: 'Bossing - Compara preus de supermercats',
  description: 'Troba les millors ofertes i estalvia a la teva compra',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Bossing',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#16a34a',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ca">
      <body className="bg-gray-50 min-h-screen pb-20">
        <Providers>
          <main className="max-w-lg mx-auto">{children}</main>
          <BottomNav />
        </Providers>
      </body>
    </html>
  );
}
