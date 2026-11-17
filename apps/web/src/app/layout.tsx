import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';
import { BottomNav } from '@/components/navigation/BottomNav';

export const metadata: Metadata = {
  title: 'Bossing - La llista de la nevera 📝',
  description: 'Troba les millors ofertes i estalvia a la teva compra',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/icon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-180.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Bossing',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#d4b58b',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ca">
      <body className="min-h-screen text-ink">
        <Providers>
          {children}
          <BottomNav />
        </Providers>
      </body>
    </html>
  );
}
