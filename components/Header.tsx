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
  Lock,
  X,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { AuthUser } from '@/lib/types';
import Link from 'next/link';

export default function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Change password modal state
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [submittingPassword, setSubmittingPassword] = useState(false);

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

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirm password do not match.');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters long.');
      return;
    }

    setSubmittingPassword(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to change password');
      }

      setPasswordSuccess('Password successfully changed and secured!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setIsPasswordModalOpen(false);
        setPasswordSuccess(null);
      }, 1500);
    } catch (err: any) {
      setPasswordError(err.message);
    } finally {
      setSubmittingPassword(false);
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

              <div className="pt-1 border-t border-[#1c2b50] space-y-2">
                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    setIsPasswordModalOpen(true);
                  }}
                  className="w-full flex items-center justify-center space-x-2 py-2 px-3 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-cyan-400 border border-blue-500/30 text-xs font-semibold transition-all cursor-pointer"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Change Password</span>
                </button>

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

      {/* Change Password Modal */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b132b] border border-[#1c2b50] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[#1c2b50] pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Change Account Password</h3>
                  <p className="text-xs text-slate-400">Update your credentials cryptographically</p>
                </div>
              </div>
              <button
                onClick={() => setIsPasswordModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {passwordError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            {passwordSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Current Password</label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full px-3 py-2 rounded-lg bg-[#070d1e] border border-[#1c2b50] text-white focus:outline-none focus:border-cyan-400 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">New Password</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 chars, uppercase, lowercase, number, symbol"
                  className="w-full px-3 py-2 rounded-lg bg-[#070d1e] border border-[#1c2b50] text-white focus:outline-none focus:border-cyan-400 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Confirm New Password</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full px-3 py-2 rounded-lg bg-[#070d1e] border border-[#1c2b50] text-white focus:outline-none focus:border-cyan-400 font-mono"
                />
              </div>

              <div className="pt-2 flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPassword}
                  className="flex-1 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-semibold shadow-md shadow-cyan-500/20 transition-all disabled:opacity-50"
                >
                  {submittingPassword ? 'Saving...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
}
