'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ShieldAlert, ArrowLeft, LogOut } from 'lucide-react';
import { useState, useEffect, Suspense } from 'react';
import { AuthUser } from '@/lib/types';

function AccessDeniedContent() {
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason');
  const path = searchParams.get('path') || 'Requested Resource';
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.user) {
          setUser(data.user);
        }
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-[#070d1e] text-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#0b132b] border border-red-500/30 rounded-2xl shadow-2xl p-6 sm:p-8 text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center shadow-lg shadow-red-500/20">
          <ShieldAlert className="w-8 h-8 text-red-400" />
        </div>

        <div className="space-y-2">
          <span className="text-[11px] font-mono px-2.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 uppercase tracking-wider font-bold">
            HTTP 403 Forbidden
          </span>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Access Denied
          </h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            {reason === 'student_restricted'
              ? 'Student accounts are strictly restricted from institutional administrative portals and executive governance controls under university examination bylaws.'
              : 'Your authenticated session does not possess authorized cryptographic privileges to access this resource.'}
          </p>
        </div>

        {user && (
          <div className="p-3 bg-[#111c38]/70 rounded-xl border border-[#1c2b50] text-left text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Authenticated Persona:</span>
              <span className="font-semibold text-white">{user.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Role Privilege:</span>
              <span className="font-mono text-cyan-400">{user.role}</span>
            </div>
            {user.studentRegNo && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Assigned Reg No:</span>
                <span className="font-mono text-slate-200">{user.studentRegNo}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-1 border-t border-[#1c2b50]/60">
              <span className="text-slate-400">Target Path:</span>
              <span className="font-mono text-[11px] text-amber-400 truncate max-w-[200px]">{path}</span>
            </div>
          </div>
        )}

        <div className="flex flex-col space-y-2.5 pt-2">
          {user?.role === 'STUDENT' ? (
            <Link
              href="/student"
              className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Student Portal</span>
            </Link>
          ) : (
            <Link
              href="/"
              className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Institutional Dashboard</span>
            </Link>
          )}

          <button
            onClick={handleLogout}
            className="inline-flex items-center justify-center space-x-2 px-4 py-2 rounded-xl bg-[#111c38] hover:bg-[#162447] text-slate-300 hover:text-white text-xs font-medium border border-[#1c2b50] transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 text-slate-400" />
            <span>Sign Out & Switch Account</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AccessDeniedPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#070d1e] flex items-center justify-center text-xs text-slate-400 animate-pulse">
          Loading access verification...
        </div>
      }
    >
      <AccessDeniedContent />
    </Suspense>
  );
}
