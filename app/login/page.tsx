'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ShieldCheck,
  Mail,
  KeyRound,
  AlertTriangle,
  ArrowRight,
  Lock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { AuthUser, UserRole } from '@/lib/types';

interface DevAccount {
  email: string;
  name: string;
  role: UserRole;
  studentRegNo?: string;
  type: 'INSTITUTIONAL' | 'STUDENT';
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect') || '';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dev-only helper state (strictly stripped in production builds)
  const [devAccounts, setDevAccounts] = useState<DevAccount[]>([]);
  const [showDevPanel, setShowDevPanel] = useState(false);

  useEffect(() => {
    // If user already possesses a valid session, redirect immediately
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.authenticated && data.user) {
          if (redirectPath && redirectPath.startsWith('/')) {
            if (data.user.role === 'STUDENT' && !redirectPath.startsWith('/student')) {
              router.replace('/student');
            } else if (data.user.role !== 'STUDENT' && redirectPath.startsWith('/student')) {
              router.replace('/');
            } else {
              router.replace(redirectPath);
            }
          } else if (data.user.role === 'STUDENT') {
            router.replace('/student');
          } else {
            router.replace('/');
          }
        }
        // In development mode, fetch non-sensitive account metadata for testing
        if (process.env.NODE_ENV === 'development' && data.availableAccounts?.length > 0) {
          setDevAccounts(data.availableAccounts);
        }
      })
      .catch(() => {});
  }, [router, redirectPath]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Authentication failed. Please verify credentials.');
      }

      const user: AuthUser = data.user;
      if (redirectPath && redirectPath.startsWith('/')) {
        // Enforce role-appropriate destination
        if (user.role === 'STUDENT' && !redirectPath.startsWith('/student')) {
          window.location.href = '/student';
        } else if (user.role !== 'STUDENT' && redirectPath.startsWith('/student')) {
          window.location.href = '/';
        } else {
          window.location.href = redirectPath;
        }
      } else {
        if (user.role === 'STUDENT') {
          window.location.href = '/student';
        } else {
          window.location.href = '/';
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDevEmail = (selectedEmail: string) => {
    setEmail(selectedEmail);
    setPassword('');
    setError(null);
  };

  return (
    <div className="min-h-screen w-full bg-[#070d1e] text-slate-100 flex flex-col justify-between py-10 px-4 sm:px-6 lg:px-8">
      {/* Brand Header */}
      <header className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-3 pt-4">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <ShieldCheck className="w-8 h-8 text-white" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-center space-x-2">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white uppercase">
              Veri<span className="text-cyan-400">Mark</span>
            </h1>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
              H8
            </span>
          </div>
          <p className="text-xs text-slate-400 font-medium">
            Tamper-Proof Academic Result Ledger • Secure University Gateway
          </p>
        </div>
      </header>

      {/* Main Authentication Card */}
      <main className="my-auto sm:mx-auto sm:w-full sm:max-w-md w-full py-6">
        <div className="bg-[#0b132b] py-8 px-6 sm:px-10 border border-[#1c2b50] rounded-2xl shadow-2xl space-y-6">
          <div className="space-y-1 border-b border-[#1c2b50] pb-4">
            <h2 className="text-base font-bold text-white tracking-tight flex items-center space-x-2">
              <Lock className="w-4 h-4 text-cyan-400" />
              <span>University Sign In</span>
            </h2>
            <p className="text-xs text-slate-400">
              Enter your provisioned institutional or student credentials.
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                University Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-slate-500" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. admin@verimark.edu or student@student.verimark.edu"
                  className="block w-full pl-10 pr-3.5 py-2.5 bg-[#111c38] border border-[#1c2b50] rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Password / Activation Token
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <KeyRound className="h-4 w-4 text-slate-500" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full pl-10 pr-3.5 py-2.5 bg-[#111c38] border border-[#1c2b50] rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center space-x-2 py-3 px-4 border border-transparent rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/20 focus:outline-none transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <span>Verifying Cryptographic Credentials...</span>
              ) : (
                <>
                  <span>Authenticate & Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Development-Only Account Hint Accordion (Eliminated from Production Builds) */}
          {process.env.NODE_ENV === 'development' && devAccounts.length > 0 && (
            <div className="pt-4 border-t border-[#1c2b50]/60 space-y-2">
              <button
                type="button"
                onClick={() => setShowDevPanel(!showDevPanel)}
                className="w-full flex items-center justify-between text-[11px] font-semibold text-cyan-400/90 hover:text-cyan-300 transition-colors"
              >
                <span>Local Development Testing Directory</span>
                {showDevPanel ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showDevPanel && (
                <div className="space-y-2 text-xs bg-[#111c38]/60 p-3 rounded-xl border border-[#1c2b50] max-h-56 overflow-y-auto">
                  <p className="text-[10px] text-slate-400">
                    Click an account to populate the email address. This development directory is strictly excluded from production builds.
                  </p>
                  <div className="space-y-1">
                    {devAccounts.map((acc) => (
                      <button
                        key={acc.email}
                        type="button"
                        onClick={() => handleSelectDevEmail(acc.email)}
                        className="w-full text-left p-1.5 rounded-lg bg-[#070d1e] hover:bg-[#162447] border border-[#1c2b50] flex items-center justify-between text-[11px] transition-colors"
                      >
                        <span className="font-mono text-slate-300 truncate max-w-[220px]">{acc.email}</span>
                        <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-blue-500/20 text-blue-400">
                          {acc.role}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Security Notice */}
          <div className="pt-2 text-[10px] text-slate-400 text-center leading-relaxed">
            Authorized institutional and student access only. Sessions are cryptographically verified with HMAC-SHA256 tokens and logged to the ledger.
          </div>
        </div>
      </main>

      {/* Appropriate University Ledger Footer */}
      <footer className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-1.5 pb-4 text-xs text-slate-500">
        <div className="flex items-center justify-center space-x-2 text-[11px] text-slate-400 font-mono">
          <span>Ed25519 Authority Signatures</span>
          <span>•</span>
          <span>RFC 6962 Merkle Trees</span>
        </div>
        <p className="text-[10px] text-slate-500">
          VeriMark Platform • Code Fuzion 2026 Problem Statement H8
        </p>
      </footer>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#070d1e] flex items-center justify-center text-xs text-slate-400 animate-pulse">
          Loading authentication gateway...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
