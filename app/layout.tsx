import type { Metadata } from 'next';
import { Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import { Toaster } from 'sonner';

import './globals.css';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { ModeProvider } from '@/components/ModeProvider';
import { canSign } from '@/lib/thetanuts/client';

/**
 * Fonts are self-hosted by next/font rather than linked from Google.
 * No external request on load, no flash of unstyled text, and the demo still
 * looks right if the venue's wifi is hostile.
 */
const display = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-display-loaded',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono-loaded',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'OptionArena',
  description:
    'Describe your view, understand the risk, prove the trade. On-chain options on Base.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Whether the live path is even available is decided on the server, so the
  // browser is never told anything about the key beyond yes or no.
  const liveAvailable = canSign();

  return (
    <html lang="en" className={`${display.variable} ${mono.variable}`}>
      <body className="min-h-screen">
        <ModeProvider liveAvailable={liveAvailable}>
          <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <TopBar />
              <main className="min-w-0 flex-1 px-8 py-8">{children}</main>
            </div>
          </div>
        </ModeProvider>
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'var(--color-surface-high)',
              border: '1px solid var(--color-hairline-bright)',
              color: 'var(--color-ink)',
            },
          }}
        />
      </body>
    </html>
  );
}
