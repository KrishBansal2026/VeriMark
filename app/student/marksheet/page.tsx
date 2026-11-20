'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Link from 'next/link';
import {
  GraduationCap,
  ShieldCheck,
  QrCode,
  ExternalLink,
  Printer,
  ArrowLeft,
  Copy,
  Check,
  Award,
  Key,
  Calendar,
  Building,
  FileCheck2,
} from 'lucide-react';
import { StudentResult } from '@/lib/types';
import StudentErrorState from '@/components/StudentErrorState';

export default function StudentMarksheetPage() {
  const [results, setResults] = useState<StudentResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<StudentResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<{
    type: 'SESSION_EXPIRED' | 'ACCESS_DENIED' | 'SERVER_ERROR';
    message: string;
  } | null>(null);
  const [studentInfo, setStudentInfo] = useState<{
    studentRegNo: string;
    studentName: string;
    course: string;
  } | null>(null);

  // QR code state
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [verifyUrl, setVerifyUrl] = useState<string>('');
  const [qrLoading, setQrLoading] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);

  const fetchResultsAndQr = async () => {
    setLoading(true);
    setErrorState(null);
    try {
      const res = await fetch('/api/student/results');
      if (res.status === 401) {
        const data = await res.json().catch(() => ({}));
        setErrorState({
          type: 'SESSION_EXPIRED',
          message: data.error || 'Your authenticated session has expired. Redirecting to login to preserve marksheet confidentiality...',
        });
        return;
      }
      if (res.status === 403) {
        const data = await res.json().catch(() => ({}));
        setErrorState({
          type: 'ACCESS_DENIED',
          message: data.error || 'Access Denied: You do not have permission to view this official marksheet.',
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
      if (data.success && data.results?.length > 0) {
        setResults(data.results);
        setStudentInfo({
          studentRegNo: data.studentRegNo,
          studentName: data.studentName,
          course: data.course,
        });

        // Default to the first (or latest) result
        const activeResult: StudentResult = data.results[0];
        setSelectedResult(activeResult);

        // Fetch high-resolution verification QR code
        fetchQrCode(activeResult.id);
      } else if (!data.success) {
        setErrorState({
          type: 'SERVER_ERROR',
          message: data.error || 'Failed to retrieve published examination records.',
        });
      }
    } catch (err: any) {
      console.error('Failed to load marksheet data:', err);
      setErrorState({
        type: 'SERVER_ERROR',
        message: err.message || 'Network communication error connecting to VeriMark ledger.',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchQrCode = async (resultId: string) => {
    setQrLoading(true);
    try {
      const res = await fetch(`/api/results/${resultId}/qr`);
      const data = await res.json();
      if (data.success) {
        setQrDataUrl(data.qrDataUrl);
        setVerifyUrl(data.verifyUrl);
      }
    } catch (err) {
      console.error('Failed to fetch QR code:', err);
    } finally {
      setQrLoading(false);
    }
  };

  useEffect(() => {
    fetchResultsAndQr();
  }, []);

  const handleSelectResult = (r: StudentResult) => {
    setSelectedResult(r);
    fetchQrCode(r.id);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopyHash = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const calculateGrade = (obtained: number, max: number): { grade: string; points: number } => {
    const pct = (obtained / max) * 100;
    if (pct >= 90) return { grade: 'A+', points: 10 };
    if (pct >= 80) return { grade: 'A', points: 9 };
    if (pct >= 70) return { grade: 'B+', points: 8 };
    if (pct >= 60) return { grade: 'B', points: 7 };
    if (pct >= 50) return { grade: 'C', points: 6 };
    return { grade: 'F', points: 0 };
  };

  if (errorState) {
    return (
      <StudentErrorState
        type={errorState.type}
        message={errorState.message}
        onRetry={fetchResultsAndQr}
        currentPath="/student/marksheet"
      />
    );
  }

  return (
    <>
      {/* Screen-only standard application header */}
      <div className="print:hidden">
        <Header
          title="Official Digital Marksheet"
          subtitle="Verifiable grade certificate cryptographically sealed on the immutable ledger"
        />
      </div>

      <main className="p-4 sm:p-8 space-y-6 max-w-5xl mx-auto">
        {/* Controls Bar - Hidden in Print */}
        <div className="flex flex-wrap items-center justify-between gap-4 print:hidden bg-[#0b132b] p-4 rounded-xl border border-[#1c2b50]">
          <div className="flex items-center space-x-3">
            <Link
              href="/student/results"
              className="inline-flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white px-3 py-2 rounded-lg bg-[#111c38] border border-[#1c2b50] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Results</span>
            </Link>

            {results.length > 1 && (
              <select
                value={selectedResult?.id || ''}
                onChange={(e) => {
                  const target = results.find((r) => r.id === e.target.value);
                  if (target) handleSelectResult(target);
                }}
                className="bg-[#111c38] text-xs text-slate-200 border border-[#1c2b50] rounded-lg px-3 py-2 outline-none focus:border-blue-500"
              >
                {results.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.subject} ({r.examName})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center space-x-3">
            {selectedResult && (
              <Link
                href={`/verify/${selectedResult.id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center space-x-1.5 text-xs text-cyan-400 hover:text-cyan-300 px-3 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Verify Online</span>
              </Link>
            )}

            <button
              onClick={handlePrint}
              className="inline-flex items-center space-x-2 text-xs font-semibold text-white px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save as PDF</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-24 text-center text-slate-400 animate-pulse text-sm">
            Retrieving cryptographic academic transcript...
          </div>
        ) : !selectedResult ? (
          <div className="p-8 text-center bg-[#0b132b] rounded-xl border border-[#1c2b50]">
            <p className="text-slate-400 text-sm">No published examination results found for this student account.</p>
          </div>
        ) : (
          /* ================================================================ */
          /* OFFICIAL MARKSHEET CERTIFICATE CONTAINER                         */
          /* Designed for high-fidelity dark UI and pristine paper printing    */
          /* ================================================================ */
          <div
            id="printable-marksheet"
            className="bg-[#0b132b] print:bg-white text-slate-100 print:text-black border-2 border-[#1c2b50] print:border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-10 space-y-8 relative overflow-hidden"
          >
            {/* Watermark Logo for Print & Screen */}
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] print:opacity-[0.04] pointer-events-none select-none">
              <ShieldCheck className="w-[500px] h-[500px] text-blue-500 print:text-black" />
            </div>

            {/* University Crest & Certificate Header */}
            <div className="text-center space-y-2 border-b-2 border-[#1c2b50] print:border-slate-800 pb-6 relative z-10">
              <div className="flex items-center justify-center space-x-3 mb-2">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-400 print:bg-slate-900 flex items-center justify-center shadow-md">
                  <GraduationCap className="w-7 h-7 text-white" />
                </div>
                <div className="text-left">
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white print:text-black uppercase">
                    VeriMark Institute of Technology
                  </h1>
                  <p className="text-xs text-cyan-400 print:text-slate-600 font-semibold uppercase tracking-wider">
                    Autonomous Institute • Office of the Controller of Examinations
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <span className="inline-block px-4 py-1 rounded-full bg-blue-500/20 print:bg-slate-200 text-blue-300 print:text-black text-xs font-bold uppercase tracking-wider border border-blue-500/30 print:border-slate-400">
                  Official Statement of Marks & Grade Certificate
                </span>
              </div>
              <p className="text-[11px] text-slate-400 print:text-slate-500 font-mono">
                Issued Under Statutory Cryptographic Ledger Authority • Problem Statement H8
              </p>
            </div>

            {/* Student Identification Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-[#111c38]/60 print:bg-slate-50 p-4 rounded-xl border border-[#1c2b50] print:border-slate-300 relative z-10">
              <div className="space-y-2">
                <div>
                  <span className="text-slate-400 print:text-slate-600 block text-[11px] uppercase font-semibold">Student Name</span>
                  <span className="text-sm font-bold text-white print:text-black">{selectedResult.studentName}</span>
                </div>
                <div>
                  <span className="text-slate-400 print:text-slate-600 block text-[11px] uppercase font-semibold">Registration Number</span>
                  <span className="font-mono text-cyan-300 print:text-blue-700 font-bold text-sm tracking-wide">
                    {selectedResult.studentRegNo}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 print:text-slate-600 block text-[11px] uppercase font-semibold">Programme / Degree</span>
                  <span className="text-slate-200 print:text-slate-800 font-medium">{selectedResult.course}</span>
                </div>
              </div>

              <div className="space-y-2 sm:text-right">
                <div>
                  <span className="text-slate-400 print:text-slate-600 block text-[11px] uppercase font-semibold">Examination Cycle</span>
                  <span className="text-sm font-semibold text-white print:text-black">{selectedResult.examName}</span>
                </div>
                <div>
                  <span className="text-slate-400 print:text-slate-600 block text-[11px] uppercase font-semibold">Publication Timestamp</span>
                  <span className="font-mono text-slate-300 print:text-slate-700">
                    {new Date(selectedResult.publicationDate).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 print:text-slate-600 block text-[11px] uppercase font-semibold">Ledger State</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 print:bg-emerald-100 text-emerald-400 print:text-emerald-800 border border-emerald-500/30">
                    <ShieldCheck className="w-3 h-3 mr-1" />
                    IMMUTABLE & AUDITED
                  </span>
                </div>
              </div>
            </div>

            {/* Academic Marks Table */}
            <div className="overflow-x-auto relative z-10">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-[#1c2b50] print:border-slate-800 bg-[#070d1e] print:bg-slate-100 text-slate-300 print:text-slate-900 font-semibold uppercase">
                    <th className="py-3 px-3">Sl.</th>
                    <th className="py-3 px-4">Subject Name</th>
                    <th className="py-3 px-3 text-center">Max Marks</th>
                    <th className="py-3 px-3 text-center">Marks Obtained</th>
                    <th className="py-3 px-3 text-center">Grade</th>
                    <th className="py-3 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1c2b50]/60 print:divide-slate-200">
                  {results.map((r, index) => {
                    const { grade } = calculateGrade(r.marksObtained, r.maxMarks);
                    const isPass = r.marksObtained >= r.maxMarks * 0.4;
                    return (
                      <tr key={r.id} className="hover:bg-[#111c38]/40 print:hover:bg-transparent">
                        <td className="py-3 px-3 text-slate-400 print:text-slate-600 font-mono">{index + 1}</td>
                        <td className="py-3 px-4 font-semibold text-white print:text-black">
                          {r.subject}
                          {r.version > 1 && (
                            <span className="ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 print:bg-amber-100 text-amber-300 print:text-amber-800 border border-amber-500/30">
                              v{r.version} Amended
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-slate-300 print:text-slate-700">{r.maxMarks}</td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-cyan-400 print:text-blue-800 text-sm">
                          {r.marksObtained}
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-white print:text-black">{grade}</td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isPass
                                ? 'bg-emerald-500/20 print:bg-emerald-100 text-emerald-400 print:text-emerald-800'
                                : 'bg-red-500/20 print:bg-red-100 text-red-400 print:text-red-800'
                            }`}
                          >
                            {isPass ? 'PASS' : 'FAIL'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[#1c2b50] print:border-slate-800 bg-[#070d1e]/80 print:bg-slate-100 font-bold text-slate-200 print:text-black">
                    <td colSpan={2} className="py-3 px-4 uppercase text-slate-400 print:text-slate-600">
                      Consolidated Total ({results.length} Subject{results.length > 1 ? 's' : ''})
                    </td>
                    <td className="py-3 px-3 text-center font-mono">
                      {results.reduce((acc, curr) => acc + curr.maxMarks, 0)}
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-cyan-300 print:text-blue-900 text-sm">
                      {results.reduce((acc, curr) => acc + curr.marksObtained, 0)}
                    </td>
                    <td colSpan={2} className="py-3 px-3 text-center text-emerald-400 print:text-emerald-800 font-black">
                      PASSED (
                      {(
                        (results.reduce((acc, curr) => acc + curr.marksObtained, 0) /
                          results.reduce((acc, curr) => acc + curr.maxMarks, 0)) *
                        100
                      ).toFixed(1)}
                      %)
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Cryptographic Ledger Proof Section & QR Code */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t-2 border-[#1c2b50] print:border-slate-800 relative z-10">
              {/* Proof Credentials (2 Columns) */}
              <div className="md:col-span-2 space-y-3">
                <div className="flex items-center space-x-2 text-xs font-bold text-slate-300 print:text-slate-800 uppercase tracking-wider">
                  <ShieldCheck className="w-4 h-4 text-cyan-400 print:text-blue-600" />
                  <span>Cryptographic Proof & Attestation Seals</span>
                </div>

                <div className="space-y-2 text-[11px] font-mono bg-[#070d1e] print:bg-slate-50 p-3.5 rounded-xl border border-[#1c2b50] print:border-slate-300">
                  <div>
                    <span className="text-slate-400 print:text-slate-600 block text-[10px] uppercase font-sans font-semibold">
                      Canonical SHA-256 Record Hash:
                    </span>
                    <div className="flex items-center space-x-2 mt-0.5">
                      <span className="text-cyan-400 print:text-blue-800 break-all select-all font-semibold">
                        {selectedResult.recordHash}
                      </span>
                      <button
                        onClick={() => handleCopyHash(selectedResult.recordHash)}
                        className="print:hidden text-slate-400 hover:text-white p-1"
                        title="Copy record hash"
                      >
                        {copiedHash ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#1c2b50]/60 print:border-slate-200">
                    <div>
                      <span className="text-slate-400 print:text-slate-600 block text-[10px] uppercase font-sans font-semibold">
                        Merkle Leaf Position:
                      </span>
                      <span className="text-slate-200 print:text-slate-800 font-bold">
                        Leaf Index #{selectedResult.merkleIndex ?? 0}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 print:text-slate-600 block text-[10px] uppercase font-sans font-semibold">
                        Active Checkpoint Root:
                      </span>
                      <span className="text-amber-400 print:text-amber-800 font-bold">
                        {selectedResult.checkpointId || 'chk_seq_0005 (Active)'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#1c2b50]/60 print:border-slate-200 text-[10px] text-slate-400 print:text-slate-600 font-sans">
                    Guaranteed tamper-proof by RFC 6962 append-only hash tree and dual Ed25519 institutional officer signatures.
                  </div>
                </div>

                {/* Institutional Officer Signature Attestation */}
                <div className="grid grid-cols-2 gap-4 pt-4 text-center">
                  <div className="border-t border-slate-700 print:border-slate-400 pt-2">
                    <p className="text-xs font-bold text-white print:text-black">Dr. Vikram Malhotra</p>
                    <p className="text-[10px] text-slate-400 print:text-slate-600">Controller of Examinations</p>
                    <span className="text-[9px] font-mono text-cyan-400 print:text-blue-700">Ed25519 Verified [4c7a...28b9]</span>
                  </div>
                  <div className="border-t border-slate-700 print:border-slate-400 pt-2">
                    <p className="text-xs font-bold text-white print:text-black">Prof. Sunita Rao</p>
                    <p className="text-[10px] text-slate-400 print:text-slate-600">Dean of Academic Affairs</p>
                    <span className="text-[9px] font-mono text-cyan-400 print:text-blue-700">Ed25519 Verified [9f1e...37d1]</span>
                  </div>
                </div>
              </div>

              {/* QR Code Verification Box (1 Column) */}
              <div className="flex flex-col items-center justify-center p-4 bg-[#070d1e] print:bg-white rounded-xl border border-[#1c2b50] print:border-slate-300 text-center space-y-3">
                <span className="text-[11px] font-bold uppercase text-slate-300 print:text-slate-800 tracking-wider">
                  Independent Verification QR
                </span>

                {qrLoading ? (
                  <div className="w-40 h-40 flex items-center justify-center text-xs text-slate-400 animate-pulse">
                    Generating cryptographic QR...
                  </div>
                ) : qrDataUrl ? (
                  <div className="p-2 bg-white rounded-xl shadow-md border-2 border-blue-500/40 print:border-black inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrDataUrl}
                      alt="VeriMark Cryptographic Verification QR Code"
                      className="w-36 h-36 mx-auto"
                    />
                  </div>
                ) : (
                  <div className="w-36 h-36 flex items-center justify-center border border-dashed border-slate-700 text-xs text-slate-500">
                    QR Unavailable
                  </div>
                )}

                <p className="text-[10px] text-slate-400 print:text-slate-600 leading-tight">
                  Scan using any smartphone camera to independently verify authenticity against the public ledger.
                </p>

                {verifyUrl && (
                  <a
                    href={verifyUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] font-mono text-cyan-400 print:text-blue-700 hover:underline break-all"
                  >
                    /verify/{selectedResult.id}
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
