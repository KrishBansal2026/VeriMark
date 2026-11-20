import type { Metadata } from 'next';
import './globals.css';
import AppLayout from '@/components/AppLayout';

export const metadata: Metadata = {
  title: 'VeriMark – Tamper-Proof Academic Result Ledger',
  description: 'Cryptographically sealed academic results with Merkle tree proofs and Ed25519 digital signatures',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#070d1e] text-slate-100 antialiased">
        <AppLayout>{children}</AppLayout>
      </body>
    </html>
  );
}
