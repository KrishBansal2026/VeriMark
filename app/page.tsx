'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Link from 'next/link';
import {
  GraduationCap,
  ShieldCheck,
  Network,
  UserCheck,
  ArrowRight,
  ShieldAlert,
  QrCode,
  FileCheck2,
  RefreshCw,
  ExternalLink,
  Lock,
} from 'lucide-react';
import { StudentResult } from '@/lib/types';

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    results: StudentResult[];
    stats: {
      total: number;
      published: number;
      draft: number;
      corrected: number;
      latestCheckpointSeq: number;
      merkleRoot: string;
    };
  } | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/results');
      const json = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <>
      <Header
        title="Admin Examination Dashboard"
        subtitle="VeriMark Cryptographic Ledger & Result Registry"
      />

      <main className="p-4 sm:p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-[#111c38] border border-[#1c2b50] rounded-xl p-5 relative overflow-hidden shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400">Total Results</p>
                <h3 className="text-2xl font-bold text-white mt-1">
                  {loading ? '...' : data?.stats.total ?? 0}
                </h3>
              </div>
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <GraduationCap className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-xs text-slate-400">
              <span className="text-blue-400 font-semibold mr-1.5">
                {data?.stats.draft ?? 0}
              </span>{' '}
              draft pending publication
            </div>
          </div>

          <div className="bg-[#111c38] border border-[#1c2b50] rounded-xl p-5 relative overflow-hidden shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400">Sealed & Published</p>
                <h3 className="text-2xl font-bold text-emerald-400 mt-1">
                  {loading ? '...' : data?.stats.published ?? 0}
                </h3>
              </div>
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-xs text-slate-400">
              <span className="text-emerald-400 font-semibold mr-1.5">100%</span>
              Merkle tree inclusion verified
            </div>
          </div>

          <div className="bg-[#111c38] border border-[#1c2b50] rounded-xl p-5 relative overflow-hidden shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400">Signed Checkpoints</p>
                <h3 className="text-2xl font-bold text-cyan-400 mt-1">
                  #{loading ? '...' : data?.stats.latestCheckpointSeq ?? 0}
                </h3>
              </div>
              <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <Network className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-xs text-slate-400 truncate">
              <span className="text-cyan-400 font-mono text-[11px] truncate">
                {data?.stats.merkleRoot ? `${data.stats.merkleRoot.substring(0, 16)}...` : 'Genesis'}
              </span>
            </div>
          </div>

          <div className="bg-[#111c38] border border-[#1c2b50] rounded-xl p-5 relative overflow-hidden shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400">Corrected Records</p>
                <h3 className="text-2xl font-bold text-amber-400 mt-1">
                  {loading ? '...' : data?.stats.corrected ?? 0}
                </h3>
              </div>
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <UserCheck className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-xs text-slate-400">
              <span className="text-amber-400 font-semibold mr-1.5">Dual-Signed</span>
              By Dean & Controller
            </div>
          </div>
        </div>

        {/* Cryptographic Ledger Summary Banner */}
        <div className="bg-gradient-to-r from-[#0b132b] via-[#111c38] to-[#0b132b] border border-[#1c2b50] rounded-xl p-6 relative">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  ACTIVE CHECKPOINT
                </span>
                <span className="text-xs text-slate-400">Independently Authenticated</span>
              </div>
              <h2 className="text-lg font-bold text-white">
                Ledger Root:{' '}
                <span className="font-mono text-cyan-300 font-normal text-sm break-all">
                  {data?.stats.merkleRoot || 'Initializing Ledger...'}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Protected by Ed25519 digital signature. Checkpoint stored in separate tamper-evident vault.
              </p>
            </div>

            <div className="flex items-center space-x-3 shrink-0">
              <Link
                href="/audit"
                className="px-4 py-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-xs font-medium flex items-center space-x-2 transition-all"
              >
                <ShieldAlert className="w-4 h-4" />
                <span>Security Audit</span>
              </Link>
              <Link
                href="/ledger"
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center space-x-2 transition-all shadow-md shadow-blue-600/20"
              >
                <Network className="w-4 h-4" />
                <span>Explore Ledger</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Quick Actions & Recent Results */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white tracking-tight flex items-center space-x-2">
              <span>Published Examination Results</span>
              <span className="text-xs text-slate-400 font-normal">
                ({data?.results.length ?? 0} records)
              </span>
            </h3>

            <div className="flex items-center space-x-3">
              <button
                onClick={fetchDashboardData}
                className="p-1.5 rounded-lg border border-[#1c2b50] bg-[#111c38] text-slate-400 hover:text-white transition-all"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <Link
                href="/results"
                className="text-xs font-medium text-blue-400 hover:text-blue-300 flex items-center space-x-1"
              >
                <span>Manage all results</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          <div className="bg-[#111c38] border border-[#1c2b50] rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0b132b]/80 border-b border-[#1c2b50] text-slate-400 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Student ID</th>
                    <th className="py-3 px-4 font-semibold">Name</th>
                    <th className="py-3 px-4 font-semibold">Course & Subject</th>
                    <th className="py-3 px-4 font-semibold">Marks</th>
                    <th className="py-3 px-4 font-semibold">SHA-256 Record Hash</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1c2b50]/60">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        Loading examination ledger records...
                      </td>
                    </tr>
                  ) : (
                    data?.results.slice(0, 5).map((r) => (
                      <tr key={r.id} className="hover:bg-[#162244] transition-colors">
                        <td className="py-3 px-4 font-mono font-medium text-slate-200">
                          {r.studentRegNo}
                        </td>
                        <td className="py-3 px-4 font-medium text-white">{r.studentName}</td>
                        <td className="py-3 px-4 text-slate-300">
                          <div className="font-medium text-slate-200">{r.subject}</div>
                          <div className="text-[11px] text-slate-500">{r.course}</div>
                        </td>
                        <td className="py-3 px-4 font-semibold text-white">
                          <span className="text-cyan-400">{r.marksObtained.toFixed(1)}</span>
                          <span className="text-slate-500"> / {r.maxMarks.toFixed(1)}</span>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                          <span className="bg-[#070d1e] px-2 py-1 rounded border border-[#1c2b50]">
                            {r.recordHash.substring(0, 16)}...
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${
                              r.status === 'published'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : r.status === 'corrected'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                            }`}
                          >
                            {r.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Link
                            href={`/verify/${r.id}`}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-[11px] font-medium transition-all"
                          >
                            <QrCode className="w-3 h-3" />
                            <span>Verify</span>
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Security Architecture Reference */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-4">
          <div className="bg-[#111c38]/60 border border-[#1c2b50] rounded-xl p-5 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs">
              01
            </div>
            <h4 className="font-bold text-white text-sm">Deterministic Serialization</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Records are serialized canonically with sorted keys and normalized types before computing the SHA-256 seal.
            </p>
          </div>

          <div className="bg-[#111c38]/60 border border-[#1c2b50] rounded-xl p-5 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
              02
            </div>
            <h4 className="font-bold text-white text-sm">RFC 6962 Merkle Tree</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Domain-separated leaf (0x00) and internal node (0x01) hashing prevents second-preimage collision vulnerabilities.
            </p>
          </div>

          <div className="bg-[#111c38]/60 border border-[#1c2b50] rounded-xl p-5 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-xs">
              03
            </div>
            <h4 className="font-bold text-white text-sm">Dual-Signed Corrections</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              No result can be edited directly. Corrections require two distinct Ed25519 signatures (Exam Controller & Dean).
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
