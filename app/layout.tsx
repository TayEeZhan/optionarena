import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { ModeProvider } from '@/components/ModeProvider';
import { canSign } from '@/lib/thetanuts/client';

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
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
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
      </body>
    </html>
  );
}
