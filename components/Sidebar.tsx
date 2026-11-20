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
  X,
  Sparkles,
} from 'lucide-react';
import { AuthUser } from '@/lib/types';
import { useNav } from './NavContext';

interface NavItem {
  name: string;
  href: string;
  icon: any;
  description?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const adminSections: NavSection[] = [
  {
    title: 'Academic Governance',
    items: [
      { name: 'Admin Dashboard', href: '/', icon: LayoutDashboard, description: 'Overview & metrics' },
      { name: 'Student Results', href: '/results', icon: GraduationCap, description: 'Manage marks & publishing' },
      { name: 'User Management', href: '/admin/users', icon: Users, description: 'Accounts & credentials' },
    ],
  },
  {
    title: 'Ledger & Cryptography',
    items: [
      { name: 'Institutional Analytics', href: '/analytics', icon: BarChart3, description: 'Aggregated analytics' },
      { name: 'Ledger Explorer', href: '/ledger', icon: Network, description: 'Merkle tree & checkpoints' },
      { name: 'Dual Approvals', href: '/corrections', icon: UserCheck, description: 'Two-person rule governance' },
      { name: 'Security Audit', href: '/audit', icon: ShieldAlert, description: 'Tamper detection & audit' },
    ],
  },
];

const studentSections: NavSection[] = [
  {
    title: 'My Academic Records',
    items: [
      { name: 'Student Overview', href: '/student', icon: LayoutDashboard, description: 'Personal dashboard & KPIs' },
      { name: 'My Published Results', href: '/student/results', icon: GraduationCap, description: 'Official verified marks' },
      { name: 'Semester History', href: '/student/history', icon: Clock, description: 'Examination session timeline' },
    ],
  },
  {
    title: 'Transcripts & Compliance',
    items: [
      { name: 'Digital Marksheet', href: '/student/marksheet', icon: FileText, description: 'Printable certificate & QR' },
      { name: 'Correction History', href: '/student/corrections', icon: ShieldCheck, description: 'Two-officer audit trail' },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const { mobileMenuOpen, closeMobileMenu } = useNav();

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
  const activeSections = isStudent ? studentSections : adminSections;

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {mobileMenuOpen && (
        <div
          onClick={closeMobileMenu}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Main Responsive Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#0b132b] border-r border-[#1c2b50] flex flex-col shrink-0 min-h-screen transition-transform duration-300 md:static md:w-64 md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-[#1c2b50] flex items-center justify-between">
          <Link href={isStudent ? '/student' : '/'} onClick={closeMobileMenu} className="flex items-center space-x-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-xl font-bold tracking-tight text-white">
                  Veri<span className="text-cyan-400">Mark</span>
                </span>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 font-mono">
                  H8
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Tamper-Proof Result Ledger</p>
            </div>
          </Link>

          {/* Mobile Close Button */}
          <button
            onClick={closeMobileMenu}
            className="md:hidden p-1.5 rounded-lg bg-[#111c38] text-slate-400 hover:text-white transition-colors"
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Sections */}
        <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
          {activeSections.map((section, sIdx) => (
            <div key={section.title} className="space-y-1">
              <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>{section.title}</span>
                {sIdx === 0 && (
                  <span className="text-[9px] font-mono text-cyan-400/90 font-semibold bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                    {currentUser?.role || (isStudent ? 'STUDENT' : 'ADMIN')}
                  </span>
                )}
              </div>

              {section.items.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={closeMobileMenu}
                    className={`group flex items-start px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 border border-blue-400/30'
                        : 'text-slate-300 hover:bg-[#111c38] hover:text-white border border-transparent'
                    }`}
                  >
                    <Icon className={`w-4 h-4 mr-2.5 mt-0.5 shrink-0 transition-colors ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-cyan-400'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{item.name}</div>
                      {item.description && (
                        <div className={`text-[10px] truncate ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>
                          {item.description}
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          ))}

          {/* Cryptographic Standards Reference Box */}
          <div className="pt-2">
            <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              <span>Cryptographic Standards</span>
            </div>
            <div className="px-3 py-2.5 bg-[#111c38]/70 rounded-xl border border-[#1c2b50] space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400">Digital Signature</span>
                <span className="font-mono text-cyan-400 font-semibold" title="Ed25519 high-speed elliptic curve digital signature scheme">Ed25519</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400">Hashing Standard</span>
                <span className="font-mono text-blue-400 font-semibold" title="SHA-256 cryptographic hash function">SHA-256</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400">Merkle Hash Tree</span>
                <span className="font-mono text-emerald-400 font-semibold" title="RFC 6962 append-only Certificate Transparency Merkle Tree">RFC 6962</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400">Checkpoint Store</span>
                <span className="font-mono text-amber-300 font-semibold" title="Independent tamper-evident cryptographic vault">Vault Verified</span>
              </div>
            </div>
          </div>
        </nav>

        {/* Footer Info & Sign-Out */}
        <div className="p-4 border-t border-[#1c2b50] bg-[#070d1e]/80 text-xs text-slate-400 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-300">VeriMark Ledger</span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono">
              Live • Synced
            </span>
          </div>
          <p className="text-[11px] text-slate-400 truncate">
            {currentUser ? `Signed in as ${currentUser.name}` : 'Autonomous Role Isolation'}
          </p>

          {currentUser && (
            <button
              onClick={handleLogout}
              className="w-full mt-2 flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl bg-[#111c38] hover:bg-red-500/15 text-slate-300 hover:text-red-400 border border-[#1c2b50] hover:border-red-500/40 text-xs font-semibold transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
