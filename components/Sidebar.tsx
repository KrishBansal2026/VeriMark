'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  GraduationCap,
  BarChart3,
  Network,
  UserCheck,
  ShieldAlert,
  ShieldCheck,
  Clock,
  FileText,
  LogOut,
  LogIn,
  Users,
  Calendar,
  UserCog,
} from 'lucide-react';
import { AuthUser } from '@/lib/types';

const adminNavigation = [
  { name: 'Admin Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Student Directory', href: '/students', icon: Users },
  { name: 'Examinations', href: '/examinations', icon: Calendar },
  { name: 'Student Results', href: '/results', icon: GraduationCap },
  { name: 'User Management', href: '/users', icon: UserCog },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Ledger Explorer', href: '/ledger', icon: Network },
  { name: 'Dual Approvals', href: '/corrections', icon: UserCheck },
  { name: 'Security Audit', href: '/audit', icon: ShieldAlert },
];

const studentNavigation = [
  { name: 'Student Overview', href: '/student', icon: LayoutDashboard },
  { name: 'My Results', href: '/student/results', icon: GraduationCap },
  { name: 'Semester History', href: '/student/history', icon: Clock },
  { name: 'Digital Marksheet', href: '/student/marksheet', icon: FileText },
  { name: 'Correction History', href: '/student/corrections', icon: ShieldCheck },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  const fetchSession = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data.success && data.authenticated && data.user) {
        setCurrentUser(data.user);
      } else {
        setCurrentUser(null);
      }
    } catch {
      // Background fetch catch
    }
  };

  useEffect(() => {
    fetchSession();
  }, [pathname]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  const isStudent = currentUser?.role === 'STUDENT' || pathname.startsWith('/student');
  const activeNavigation = isStudent ? studentNavigation : adminNavigation;

  return (
    <aside className="w-64 bg-[#0b132b] border-r border-[#1c2b50] flex flex-col shrink-0 min-h-screen">
      {/* Brand Header */}
      <div className="p-5 border-b border-[#1c2b50] flex items-center space-x-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <ShieldCheck className="w-6 h-6 text-white" />
        </div>
        <div>
          <div className="flex items-center space-x-1.5">
            <span className="text-xl font-bold tracking-tight text-white">
              Veri<span className="text-cyan-400">Mark</span>
            </span>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
              H8
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-medium">Tamper-Proof Result Ledger</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-6 space-y-1.5">
        <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
          <span>{isStudent ? 'Student Academic Portal' : 'Institutional Governance'}</span>
          <span className="text-[9px] font-mono text-cyan-400/80">
            {currentUser?.role || 'AUTH'}
          </span>
        </div>

        {activeNavigation.map((item) => {
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
            <span className="text-[11px] text-amber-300 font-semibold">Protected Local Vault</span>
          </div>
        </div>
      </nav>

      {/* Footer Info & Sign-Out */}
      <div className="p-4 border-t border-[#1c2b50] bg-[#070d1e]/50 text-xs text-slate-400 space-y-2">
        <div className="flex items-center justify-between">
          <span>Code Fuzion 2026</span>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            Live Ledger
          </span>
        </div>
        <p className="text-[11px] text-slate-500">
          {currentUser ? `Signed in as ${currentUser.name}` : 'Autonomous Role Isolation'}
        </p>

        {currentUser && (
          <button
            onClick={handleLogout}
            className="w-full mt-2 flex items-center justify-center space-x-1.5 py-1.5 px-3 rounded-lg bg-[#111c38] hover:bg-red-500/10 text-slate-400 hover:text-red-400 border border-[#1c2b50] hover:border-red-500/30 text-[11px] font-medium transition-colors cursor-pointer"
          >
            <LogOut className="w-3 h-3" />
            <span>Sign Out</span>
          </button>
        )}
      </div>
    </aside>
  );
}
