'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Link from 'next/link';
import {
  GraduationCap,
  ShieldCheck,
  QrCode,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  Key,
  X,
  FileText,
  Search,
} from 'lucide-react';
import { StudentResult } from '@/lib/types';
import StudentErrorState from '@/components/StudentErrorState';

export default function StudentResultsPage() {
  const [results, setResults] = useState<StudentResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentInfo, setStudentInfo] = useState<{ studentRegNo: string; studentName: string; course: string } | null>(null);
  const [search, setSearch] = useState('');
  const [errorState, setErrorState] = useState<{
    type: 'SESSION_EXPIRED' | 'ACCESS_DENIED' | 'SERVER_ERROR';
    message: string;
  } | null>(null);

  // QR Modal state
  const [selectedResult, setSelectedResult] = useState<StudentResult | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [verifyUrl, setVerifyUrl] = useState<string>('');
  const [qrLoading, setQrLoading] = useState(false);

  const fetchResults = async () => {
    setLoading(true);
    setErrorState(null);
    try {
      const res = await fetch('/api/student/results');
      if (res.status === 401) {
        const data = await res.json().catch(() => ({}));
        setErrorState({
          type: 'SESSION_EXPIRED',
          message: data.error || 'Your authenticated session has expired. Redirecting to login to preserve record confidentiality...',
        });
        return;
      }
      if (res.status === 403) {
        const data = await res.json().catch(() => ({}));
        setErrorState({
          type: 'ACCESS_DENIED',
          message: data.error || 'Access Denied: You do not have permission to view these academic records.',
        });
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorState({
          type: 'SERVER_ERROR',
          message: data.error || `Server responded with status ${res.status}.`,
        });
        return;
      }
      const data = await res.json();
      if (data.success) {
        setResults(data.results || []);
        setStudentInfo({
          studentRegNo: data.studentRegNo,
          studentName: data.studentName,
          course: data.course,
        });
      } else {
        setErrorState({
          type: 'SERVER_ERROR',
          message: data.error || 'Failed to retrieve published records.',
        });
      }
    } catch (err: any) {
      console.error(err);
      setErrorState({
        type: 'SERVER_ERROR',
        message: err.message || 'Network communication error connecting to VeriMark ledger.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, []);

  const handleOpenQrModal = async (result: StudentResult) => {
    setSelectedResult(result);
    setQrLoading(true);
    try {
      const res = await fetch(`/api/results/${result.id}/qr`);
      const data = await res.json();
      if (data.success) {
        setQrDataUrl(data.qrDataUrl);
        setVerifyUrl(data.verifyUrl);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setQrLoading(false);
    }
  };

  const filtered = results.filter((r) =>
    r.subject.toLowerCase().includes(search.toLowerCase()) ||
    r.examName.toLowerCase().includes(search.toLowerCase())
  );

  if (errorState) {
    return (
      <StudentErrorState
        type={errorState.type}
        message={errorState.message}
        onRetry={fetchResults}
        currentPath="/student/results"
      />
    );
  }

  return (
    <>
      <Header
        title="My Published Results"
        subtitle={`Official examination records for ${studentInfo?.studentName || 'Student'} (${studentInfo?.studentRegNo || ''})`}
      />

      <main className="p-4 sm:p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
        {/* Banner with student identity and summary */}
        <div className="bg-[#111c38] border border-[#1c2b50] rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="font-mono text-cyan-400 font-bold text-sm">
                {studentInfo?.studentRegNo}
              </span>
              <span className="text-slate-400 text-xs">• {studentInfo?.course}</span>
            </div>
            <p className="text-xs text-slate-400">
              {results.length} course results cryptographically sealed under central ledger checkpoints.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              href="/student/marksheet"
              className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center space-x-2 transition-all shadow-md shadow-blue-600/20"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Full Marksheet Certificate</span>
            </Link>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search subjects or examinations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#111c38] border border-[#1c2b50] text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Results List */}
        {loading ? (
          <div className="p-12 text-center text-slate-400 bg-[#111c38] border border-[#1c2b50] rounded-xl flex flex-col items-center justify-center space-y-3">
            <div className="w-8 h-8 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin" />
            <p className="text-xs font-mono text-cyan-400/90">Synchronizing verified academic records from immutable ledger...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400 bg-[#111c38] border border-[#1c2b50] rounded-xl space-y-2">
            <GraduationCap className="w-8 h-8 text-slate-500 mx-auto" />
            <p className="text-sm font-semibold text-slate-300">No examination results found.</p>
            <p className="text-xs text-slate-500">No records match your query.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filtered.map((r) => {
              const pct = (r.marksObtained / r.maxMarks) * 100;
              return (
                <div
                  key={r.id}
                  className="bg-[#111c38] border border-[#1c2b50] rounded-xl p-6 space-y-4 relative overflow-hidden"
                >
                  <div className="flex items-start justify-between border-b border-[#1c2b50]/60 pb-3">
                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase font-mono font-bold text-cyan-400">
                        {r.examName}
                      </span>
                      <h3 className="text-base font-bold text-white tracking-tight">{r.subject}</h3>
                    </div>

                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      {r.status.toUpperCase()}
                    </span>
                  </div>

                  {/* Marks Display */}
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 rounded-lg bg-[#070d1e] border border-[#1c2b50]">
                      <span className="text-[10px] text-slate-400 uppercase font-sans">Marks</span>
                      <div className="text-xl font-bold text-white font-mono mt-0.5">
                        {r.marksObtained}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-[#070d1e] border border-[#1c2b50]">
                      <span className="text-[10px] text-slate-400 uppercase font-sans">Maximum</span>
                      <div className="text-xl font-bold text-slate-300 font-mono mt-0.5">
                        {r.maxMarks}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-[#070d1e] border border-[#1c2b50]">
                      <span className="text-[10px] text-slate-400 uppercase font-sans">Score</span>
                      <div className="text-xl font-bold text-emerald-400 font-mono mt-0.5">
                        {pct.toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  {/* Cryptographic Hash Seal */}
                  <div className="p-3 rounded-lg bg-[#070d1e] border border-[#1c2b50] space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span className="uppercase font-semibold flex items-center space-x-1">
                        <Key className="w-3 h-3 text-cyan-400" />
                        <span>SHA-256 Cryptographic Seal</span>
                      </span>
                      <span className="text-emerald-400 font-mono">Leaf #{r.merkleIndex ?? 0}</span>
                    </div>
                    <div className="font-mono text-[11px] text-slate-300 break-all">
                      {r.recordHash}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-400">
                      Published: {new Date(r.publicationDate).toLocaleDateString()}
                    </span>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleOpenQrModal(r)}
                        className="px-3 py-1.5 rounded-lg bg-[#0b132b] hover:bg-[#162244] border border-[#1c2b50] text-slate-200 text-xs font-semibold flex items-center space-x-1.5 transition-all"
                      >
                        <QrCode className="w-3.5 h-3.5 text-cyan-400" />
                        <span>QR Code</span>
                      </button>

                      <Link
                        href={`/verify/${r.id}`}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-sm"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Verify Seal</span>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* QR Code Verification Modal */}
      {selectedResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#0b132b] border border-[#1c2b50] rounded-2xl max-w-sm w-full p-6 space-y-5 shadow-2xl relative">
            <button
              onClick={() => setSelectedResult(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-white">Public Verification QR</h3>
              <p className="text-xs text-slate-400">
                {selectedResult.subject} ({selectedResult.studentRegNo})
              </p>
            </div>

            <div className="flex justify-center p-3 bg-white rounded-xl shadow-inner">
              {qrLoading ? (
                <div className="w-56 h-56 flex items-center justify-center text-slate-800 text-xs">
                  Generating verified QR...
                </div>
              ) : qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`QR Code for ${selectedResult.subject}`}
                  className="w-56 h-56 object-contain"
                />
              ) : null}
            </div>

            <p className="text-[11px] text-center text-slate-400">
              Scan this code with any camera to verify canonical SHA-256 seal, Merkle inclusion proof, and signed checkpoint.
            </p>

            <Link
              href={`/verify/${selectedResult.id}`}
              className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center space-x-2 transition-all shadow-md shadow-blue-600/20"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open Public Verification Page</span>
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
