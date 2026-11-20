'use client';

import { useState, useEffect } from 'react';
import { Shield, Lock, CheckCircle2, User, ChevronDown, LogOut, Key } from 'lucide-react';
import { AuthUser, UserRole } from '@/lib/types';

export default function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [availableAccounts, setAvailableAccounts] = useState<{ email: string; name: string; role: UserRole }[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchSession = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data.success) {
        setCurrentUser(data.user);
        setAvailableAccounts(data.availableAccounts || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchSession();
  }, []);

  const handleSwitchRole = async (role: UserRole) => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demoRole: role }),
      });
      const data = await res.json();
      if (data.success) {
        setCurrentUser(data.user);
        setIsDropdownOpen(false);
        // Refresh page data so components re-evaluate permissions
        window.location.reload();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setCurrentUser(null);
      setIsDropdownOpen(false);
      window.location.reload();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <header className="h-16 border-b border-[#1c2b50] bg-[#0b132b]/80 backdrop-blur-md px-8 flex items-center justify-between sticky top-0 z-30">
      <div>
        <h1 className="text-lg font-bold text-white tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
      </div>

      <div className="flex items-center space-x-4">
        {/* Ledger Security Status Badge */}
        <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Ledger Validated</span>
        </div>

        {/* User Identity & Role Switcher */}
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
              currentUser
                ? 'bg-[#111c38] border-[#1c2b50] text-slate-200 hover:border-blue-500/50'
                : 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
            }`}
          >
            <User className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-semibold">
              {currentUser ? currentUser.name : 'Anonymous (No Session)'}
            </span>
            {currentUser && (
              <span className="px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-400 text-[10px] font-mono border border-blue-500/30">
                {currentUser.role}
              </span>
            )}
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-72 rounded-xl bg-[#0b132b] border border-[#1c2b50] shadow-2xl p-2 z-50 text-xs space-y-1">
              <div className="px-3 py-2 border-b border-[#1c2b50] text-[11px] text-slate-400 font-semibold uppercase">
                Active Security Session (RBAC)
              </div>

              <div className="py-1">
                {availableAccounts.map((acc) => (
                  <button
                    key={acc.role}
                    onClick={() => handleSwitchRole(acc.role)}
                    className={`w-full text-left px-3 py-2 rounded-lg flex flex-col space-y-0.5 hover:bg-[#111c38] transition-colors ${
                      currentUser?.role === acc.role ? 'bg-blue-600/20 border border-blue-500/30' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">{acc.name}</span>
                      <span className="text-[10px] font-mono px-1 rounded bg-[#070d1e] text-cyan-300 border border-[#1c2b50]">
                        {acc.role}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">{acc.email}</span>
                  </button>
                ))}
              </div>

              {currentUser && (
                <div className="pt-1 border-t border-[#1c2b50]">
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-3 py-2 rounded-lg flex items-center space-x-2 text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Log Out (Test Anonymous Access)</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
