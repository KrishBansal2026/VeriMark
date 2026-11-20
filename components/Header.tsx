'use client';

import { Shield, Lock, CheckCircle2, AlertTriangle, Key } from 'lucide-react';

export default function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="h-16 border-b border-[#1c2b50] bg-[#0b132b]/80 backdrop-blur-md px-8 flex items-center justify-between sticky top-0 z-30">
      <div>
        <h1 className="text-lg font-bold text-white tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
      </div>

      <div className="flex items-center space-x-4">
        {/* Ledger Security Status Badge */}
        <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Ledger Validated</span>
        </div>

        {/* Cryptographic Key Ring Indicator */}
        <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-mono">
          <Key className="w-3.5 h-3.5" />
          <span>Ed25519 Keys Active</span>
        </div>
      </div>
    </header>
  );
}
