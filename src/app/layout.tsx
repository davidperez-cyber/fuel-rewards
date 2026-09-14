import type { Metadata } from 'next';
import { Anton, Inter } from 'next/font/google';
import './globals.css';

const anton = Anton({ subsets: ['latin'], weight: '400', variable: '--font-anton' });
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'UFC GYM FUEL — Recompensas',
  description: 'Programa de lealtad Protein Shake Rewards de UFC GYM FUEL.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${anton.variable} ${inter.variable}`} style={{ minHeight: '100vh' }}>
        {children}
      </body>
    </html>
  );
}
