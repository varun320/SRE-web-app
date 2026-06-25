import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { Providers } from './providers';
import { ConfettiHost } from '@/components/ui/confetti';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono-google', display: 'swap' });

export const metadata: Metadata = { title: 'SRE Timesheet', description: 'Weekly timesheet for SRE Inc.' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${mono.variable}`}>
      <body>
        <Providers>{children}</Providers>
        <ConfettiHost />
      </body>
    </html>
  );
}
