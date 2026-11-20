'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  GraduationCap,
  Network,
  UserCheck,
  ShieldAlert,
  QrCode,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Student Results', href: '/results', icon: GraduationCap },
  { name: 'Ledger Explorer', href: '/ledger', icon: Network },
  { name: 'Dual Approvals', href: '/corrections', icon: UserCheck },
  { name: 'Security Audit', href: '/audit', icon: ShieldAlert },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-[#0b132b] border-r border-[#1c2b50] flex flex-col shrink-0 min-h-screen">
      {/* Brand Header */}
      <div className="p-5 border-b border-[#1c2b50] flex items-center space-x-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <ShieldCheck className="w-6 h-6 text-white" />
        </div>
        <div>
          <div className="flex items-center space-x-1.5">
            <span className="text-xl font-bold tracking-tight text-white">Veri<span className="text-cyan-400">Mark</span></span>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">H8</span>
          </div>
          <p className="text-[11px] text-slate-400 font-medium">Tamper-Proof Result Ledger</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-6 space-y-1.5">
        <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Core Modules
        </div>
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 border border-blue-400/30'
                  : 'text-slate-300 hover:bg-[#111c38] hover:text-white'
              }`}
            >
              <Icon className={`w-4 h-4 mr-3 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              {item.name}
            </Link>
          );
        })}

        <div className="pt-6 px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Cryptographic Services
        </div>
        <div className="px-3 py-2.5 bg-[#111c38]/60 rounded-lg border border-[#1c2b50]/60 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span className="text-slate-400">Algorithm</span>
            <span className="font-mono text-cyan-400 font-semibold">Ed25519</span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span className="text-slate-400">Hashing</span>
            <span className="font-mono text-blue-400 font-semibold">SHA-256</span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span className="text-slate-400">Tree Structure</span>
            <span className="font-mono text-emerald-400 font-semibold">RFC 6962</span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span className="text-slate-400">Checkpoint Store</span>
            <span className="text-[11px] text-amber-300 font-semibold">Isolated Vault</span>
          </div>
        </div>
      </nav>

      {/* Footer Info */}
      <div className="p-4 border-t border-[#1c2b50] bg-[#070d1e]/50 text-xs text-slate-400 space-y-1">
        <div className="flex items-center justify-between">
          <span>Code Fuzion 2026</span>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            Live Ledger
          </span>
        </div>
        <p className="text-[11px] text-slate-500">Dual Ed25519 Authorization Enabled</p>
      </div>
    </aside>
  );
}
