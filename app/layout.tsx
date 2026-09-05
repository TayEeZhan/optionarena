import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, JetBrains_Mono } from 'next/font/google';
import { Toaster } from 'sonner';

import './globals.css';
import { Header, TabBar } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { ModeProvider } from '@/components/ModeProvider';
import { WalletProvider } from '@/components/WalletProvider';
import { canSign } from '@/lib/thetanuts/client';

/**
 * Fonts are self-hosted by next/font rather than linked from Google.
 * No external request on load, no flash of unstyled text, and the demo still
 * looks right if the venue's wifi is hostile.
 */
const display = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
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

/**
 * Mobile-first, so the viewport is declared rather than inherited. The theme
 * colour matches the ground so the phone's status bar does not sit on a
 * different background than the page.
 */
export const viewport: Viewport = {
  themeColor: '#0a0c0a',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Whether the live path is even available is decided on the server, so the
  // browser is never told anything about the key beyond yes or no.
  const liveAvailable = canSign();

  return (
    <html lang="en" className={`${display.variable} ${mono.variable}`}>
      <body className="min-h-screen">
        <ModeProvider liveAvailable={liveAvailable}>
          <WalletProvider>
            <Header />
            {/* The bottom padding clears the fixed tab bar on phones. */}
            <main className="mx-auto max-w-5xl px-5 pt-7 pb-32 md:pb-16">
              {children}
              <Footer />
            </main>
            <TabBar />
          </WalletProvider>
        </ModeProvider>
        <Toaster
          theme="dark"
          position="top-center"
          toastOptions={{
            style: {
              background: 'var(--color-surface-high)',
              border: '1px solid var(--color-hairline-bright)',
              color: 'var(--color-ink)',
              borderRadius: '1rem',
            },
          }}
        />
      </body>
    </html>
  );
}
