import type { Metadata, Viewport } from 'next';
import { Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  weight: ['300', '400', '500', '600', '700'],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  weight: ['400', '500', '700'],
});

export const metadata: Metadata = {
  title: 'ROYALE — Sovereign Data Cloud',
  description: 'The Digital Ark. Create, store, and distribute your content across the decentralized ether. Censorship-free. AI-powered. Quantum-secured.',
  keywords: ['decentralized', 'IPFS', 'sovereign', 'content', 'blockchain', 'algorand', 'creator economy'],
  authors: [{ name: 'Kvon Royale' }],
  openGraph: {
    title: 'ROYALE — Sovereign Data Cloud',
    description: 'The Kingdom of Content. Quantum-secured. Censorship-resistant.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#080B0F',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <body className={`${spaceGrotesk.className} antialiased`}>
        {children}
      </body>
    </html>
  );
}
