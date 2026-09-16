import React from 'react';
import type { Metadata, Viewport } from 'next';
import { DM_Sans } from 'next/font/google';
import '../styles/tailwind.css';

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'ChessDesk — Chess Coaching Operations',
  description: 'Run your chess coaching business from one place. Manage sessions, clients, invoices, and finances.',
  icons: {
    icon: [{ url: '/assets/chess-bishop-logo.svg', type: 'image/svg+xml' }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} dark`}>
      <body className={dmSans.className}>
        {children}
      </body>
    </html>
  );
}
