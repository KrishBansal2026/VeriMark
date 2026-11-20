'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Lock,
  ShieldAlert,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  LogIn,
  Home,
  ShieldCheck,
} from 'lucide-react';
import Header from '@/components/Header';

export interface StudentErrorStateProps {
  type: 'SESSION_EXPIRED' | 'ACCESS_DENIED' | 'SERVER_ERROR';
  message: string;
  onRetry?: () => void;
  currentPath: string;
}

export default function StudentErrorState({
  type,
  message,
  onRetry,
  currentPath,
}: StudentErrorStateProps) {
  const router = useRouter();
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    if (type !== 'SESSION_EXPIRED') return;

    // Automatic redirect countdown to preserve confidentiality
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          const target = `/login?redirect=${encodeURIComponent(currentPath)}`;
          router.push(target);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [type, currentPath, router]);

  const loginRedirectUrl = `/login?redirect=${encodeURIComponent(currentPath)}`;

  return (
    <>
      <Header
        title={
          type === 'SESSION_EXPIRED'
            ? 'Authentication Required'
            : type === 'ACCESS_DENIED'
            ? 'Access Denied'
            : 'Service Unavailable'
        }
        subtitle="VeriMark Cryptographic Examination Ledger Security Boundary"
      />

      <main className="p-4 sm:p-8 max-w-4xl mx-auto space-y-6">
        {type === 'SESSION_EXPIRED' && (
          <div className="bg-[#111c38] border-2 border-amber-500/40 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden space-y-6">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                <Lock className="w-6 h-6" />
              </div>
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] font-mono uppercase font-bold text-amber-400 tracking-wider bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                    HTTP 401 — Session Expired
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white">
                  Academic Session Expired or Authentication Required
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Your authenticated student session has expired or requires re-authentication following security updates.
                  To protect the confidentiality of your official academic records, examination marks cannot be displayed without a valid session.
                </p>
                {message && (
                  <p className="text-xs font-mono text-amber-300/90 bg-[#081426] p-2.5 rounded-lg border border-amber-500/20">
                    Security Notice: {message}
                  </p>
                )}
              </div>
            </div>

            <div className="p-4 bg-[#081426] rounded-xl border border-[#1c2b50] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="text-xs text-slate-400 space-y-0.5">
                <p className="font-semibold text-slate-200">Automatic Redirect Active</p>
                <p>
                  Redirecting to login in <span className="font-mono text-amber-400 font-bold">{countdown}</span> seconds to preserve record confidentiality.
                </p>
              </div>

              <Link
                href={loginRedirectUrl}
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-[#081426] text-xs font-bold transition-all shadow-lg shadow-amber-500/20"
              >
                <LogIn className="w-4 h-4" />
                <span>Log In Immediately</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Link>
            </div>
          </div>
        )}

        {type === 'ACCESS_DENIED' && (
          <div className="bg-[#111c38] border-2 border-rose-500/40 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] font-mono uppercase font-bold text-rose-400 tracking-wider bg-rose-500/10 px-2.5 py-0.5 rounded-full border border-rose-500/20">
                    HTTP 403 — Access Forbidden
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white">
                  Access Denied — Confidential Academic Record
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  You are not authorized to view this student record. Under VeriMark statutory privacy controls, students may only access examination records bound strictly to their own authenticated registration number.
                </p>
                {message && (
                  <p className="text-xs font-mono text-rose-300/90 bg-[#081426] p-2.5 rounded-lg border border-rose-500/20">
                    Authorization Policy: {message}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-[#1c2b50]">
              <span className="text-xs text-slate-400">
                You remain signed in to your account.
              </span>
              <Link
                href="/student"
                className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all shadow-md shadow-blue-500/20"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Return to My Student Portal</span>
              </Link>
            </div>
          </div>
        )}

        {type === 'SERVER_ERROR' && (
          <div className="bg-[#111c38] border-2 border-slate-700 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0">
                <AlertTriangle className="w-6 h-6 text-amber-400" />
              </div>
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] font-mono uppercase font-bold text-slate-400 tracking-wider bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-700">
                    Verification Communication Error
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white">
                  Unable to Verify Examination Records
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  The client could not retrieve or verify your academic records from the VeriMark ledger service.
                  This does not indicate missing records; your examination marks remain cryptographically sealed in the immutable vault.
                </p>
                {message && (
                  <p className="text-xs font-mono text-slate-300 bg-[#081426] p-2.5 rounded-lg border border-slate-700">
                    Diagnostic Info: {message}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-[#1c2b50]">
              <span className="text-xs text-slate-400 flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Immutable vault store integrity intact.</span>
              </span>

              <div className="flex items-center space-x-3">
                {onRetry && (
                  <button
                    onClick={onRetry}
                    className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all shadow-md shadow-blue-500/20"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry Verification</span>
                  </button>
                )}
                <Link
                  href="/student"
                  className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-[#081426] hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium transition-all"
                >
                  <Home className="w-3.5 h-3.5" />
                  <span>Overview</span>
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
