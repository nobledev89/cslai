import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Company Intel Bot — Admin',
  description: 'Multi-tenant company intelligence Slack bot admin panel',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
