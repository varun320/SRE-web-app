import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { Providers } from './providers';
import { ConfettiHost } from '@/components/ui/confetti';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono-google', display: 'swap' });

export const metadata: Metadata = {
  // Auth-gated internal tool — do NOT index. Google finding /login is pure downside.
  robots: { index: false, follow: false, nocache: true },
  title: {
    default: 'SRE Timesheet',
    template: '%s · SRE Timesheet',
  },
  description: 'Weekly timesheet, TIL, and expense system for Sulfur Recovery Engineering Inc.',
  applicationName: 'SRE Timesheet',
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f2340' },
  ],
  colorScheme: 'light dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${mono.variable}`}>
      <head>
        <script
          // Runs before hydration so there's no flash-of-wrong-theme.
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var t = localStorage.getItem('theme');
                  var wantDark = t === 'dark' || ((!t || t === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches);
                  if (wantDark) document.documentElement.classList.add('dark');
                } catch (_) {}
              })();
            `,
          }}
        />
      </head>
      <body>
        <Providers>{children}</Providers>
        <ConfettiHost />
      </body>
    </html>
  );
}
