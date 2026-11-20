import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/Sidebar';

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
      <body className="bg-[#070d1e] text-slate-100 flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          {children}
        </div>
      </body>
    </html>
  );
}
