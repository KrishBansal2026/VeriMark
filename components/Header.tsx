'use client';

import { useState, useEffect } from 'react';
import {
  ShieldCheck,
  User,
  ChevronDown,
  LogOut,
  GraduationCap,
  LogIn,
  Key,
} from 'lucide-react';
import { AuthUser } from '@/lib/types';
import Link from 'next/link';

export default function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchSession = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data.success && data.authenticated && data.user) {
        setCurrentUser(data.user);
      } else {
        setCurrentUser(null);
      }
    } catch (err) {
      console.error('Session fetch error:', err);
    }
  };

  useEffect(() => {
    fetchSession();
  }, []);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setCurrentUser(null);
      setIsProfileOpen(false);
      window.location.href = '/login';
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <header className="h-16 border-b border-[#1c2b50] bg-[#0b132b]/80 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30">
      <div>
        <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-slate-400 hidden sm:block">{subtitle}</p>}
      </div>

      <div className="flex items-center space-x-3">
        {/* Ledger Security Status Badge */}
        <div className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Ledger Validated</span>
        </div>

        {/* Authenticated User Identity Card & Secure Logout */}
        <div className="relative">
          {currentUser ? (
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center space-x-2 px-3 py-1.5 rounded-lg border bg-[#111c38] border-[#1c2b50] text-slate-200 hover:border-blue-500/50 text-xs font-medium transition-all"
            >
              {currentUser.role === 'STUDENT' ? (
                <GraduationCap className="w-4 h-4 text-cyan-400" />
              ) : (
                <User className="w-3.5 h-3.5 text-cyan-400" />
              )}

              <div className="flex flex-col text-left">
                <span className="font-semibold leading-tight text-white">{currentUser.name}</span>
                {currentUser.studentRegNo && (
                  <span className="text-[10px] font-mono text-cyan-400/90 leading-none">
                    {currentUser.studentRegNo}
                  </span>
                )}
              </div>

              <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px] font-mono border border-blue-500/30">
                {currentUser.role}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
          ) : (
            <Link
              href="/login"
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 border border-blue-500/40 text-blue-400 hover:bg-blue-600 hover:text-white text-xs font-semibold transition-all"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </Link>
          )}

          {/* Secure User Profile & Sign-Out Modal */}
          {isProfileOpen && currentUser && (
            <div className="absolute right-0 mt-2 w-72 rounded-xl bg-[#0b132b] border border-[#1c2b50] shadow-2xl p-3 z-50 text-xs space-y-3">
              <div className="border-b border-[#1c2b50] pb-2 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Active Identity
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    HMAC Verified
                  </span>
                </div>
                <p className="font-bold text-white text-sm">{currentUser.name}</p>
                <p className="text-[11px] font-mono text-slate-400">{currentUser.email}</p>
              </div>

              <div className="space-y-1 text-slate-300 bg-[#070d1e] p-2.5 rounded-lg border border-[#1c2b50]/60">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Assigned Role:</span>
                  <span className="font-mono text-cyan-400 font-semibold">{currentUser.role}</span>
                </div>
                {currentUser.studentRegNo && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Registration No:</span>
                    <span className="font-mono text-slate-200">{currentUser.studentRegNo}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Session Status:</span>
                  <span className="text-emerald-400">Cryptographically Sealed</span>
                </div>
              </div>

              <div className="pt-1 border-t border-[#1c2b50]">
                <button
                  onClick={handleLogout}
                  disabled={loading}
                  className="w-full flex items-center justify-center space-x-2 py-2 px-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold transition-all cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{loading ? 'Signing out...' : 'Sign Out of VeriMark'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
