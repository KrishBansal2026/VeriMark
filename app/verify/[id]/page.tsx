'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  HelpCircle,
  CheckCircle2,
  XCircle,
  FileText,
  Key,
  Network,
  Lock,
  ArrowLeft,
  Copy,
  ExternalLink,
  GraduationCap,
} from 'lucide-react';
import { VerificationResult } from '@/lib/types';

export default function PublicVerifyPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    verification: VerificationResult;
    publicKeys: any;
  } | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  useEffect(() => {
    const runVerification = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/verify/${id}`);
        const json = await res.json();
        if (json.success) {
          setData(json);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      runVerification();
    }
  }, [id]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070d1e] text-slate-100 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm font-semibold text-slate-300">
            Executing live cryptographic verification...
          </p>
          <p className="text-xs text-slate-500">
            Checking SHA-256 seal, Merkle inclusion proof, and Ed25519 digital signature
          </p>
        </div>
      </div>
    );
  }

  const v = data?.verification;
  const result = v?.result;
  const isVerified = v?.status === 'VERIFIED';
  const isTampered = v?.status === 'TAMPERED';
  const isInvalid = v?.status === 'INVALID';

  return (
    <div className="min-h-screen bg-[#070d1e] text-slate-100 p-4 md:p-8 flex flex-col items-center justify-center">
      <div className="max-w-3xl w-full space-y-6">
        {/* Navigation & Brand */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to VeriMark Dashboard</span>
          </Link>

          <div className="flex items-center space-x-1 text-xs text-slate-400">
            <span>Powered by</span>
            <span className="font-bold text-white">Veri<span className="text-cyan-400">Mark</span></span>
          </div>
        </div>

        {/* Verification Status Banner */}
        <div
          className={`border rounded-2xl p-6 shadow-xl transition-all ${
            isVerified
              ? 'bg-gradient-to-r from-[#0b1b36] via-[#0d2745] to-[#0b1b36] border-emerald-500/40 text-emerald-400'
              : isTampered
              ? 'bg-gradient-to-r from-[#2a0e14] via-[#3d131d] to-[#2a0e14] border-red-500/50 text-red-400'
              : isInvalid
              ? 'bg-[#291e0d] border-amber-500/40 text-amber-400'
              : 'bg-[#111c38] border-[#1c2b50] text-slate-400'
          }`}
        >
          <div className="flex items-start space-x-4">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
                isVerified
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                  : isTampered
                  ? 'bg-red-500/10 border border-red-500/30 text-red-400 animate-pulse'
                  : 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
              }`}
            >
              {isVerified ? (
                <ShieldCheck className="w-8 h-8" />
              ) : isTampered ? (
                <ShieldAlert className="w-8 h-8" />
              ) : (
                <AlertTriangle className="w-8 h-8" />
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-black/40 border border-current">
                  STATUS: {v?.status}
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  {v?.timestamp ? new Date(v.timestamp).toLocaleString() : ''}
                </span>
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                {isVerified
                  ? 'Officially Authenticated Examination Marksheet'
                  : isTampered
                  ? 'SECURITY ALERT: TAMPERED MARKSHEET RECORD'
                  : 'INVALID OR UNCOMMITTED RECORD'}
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">{v?.message}</p>
            </div>
          </div>
        </div>

        {/* Marksheet Details Card */}
        {result && (
          <div className="bg-[#0b132b] border border-[#1c2b50] rounded-2xl overflow-hidden shadow-2xl">
            {/* Academic Certificate Header */}
            <div className="p-6 bg-[#111c38]/80 border-b border-[#1c2b50] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">
                    Official Student Statement of Marks
                  </h3>
                  <p className="text-xs text-slate-400">{result.examName}</p>
                </div>
              </div>

              <div className="text-right">
                <div className="text-[10px] uppercase font-semibold text-slate-400">
                  Published Date
                </div>
                <div className="text-xs font-medium text-slate-200">
                  {new Date(result.publicationDate).toLocaleDateString()}
                </div>
              </div>
            </div>

            {/* Student & Examination Details */}
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div className="p-3 rounded-lg bg-[#070d1e] border border-[#1c2b50] space-y-1">
                  <span className="text-slate-500 text-[10px] uppercase font-semibold">
                    Registration No
                  </span>
                  <div className="font-mono font-bold text-white text-sm">
                    {result.studentRegNo}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#070d1e] border border-[#1c2b50] space-y-1">
                  <span className="text-slate-500 text-[10px] uppercase font-semibold">
                    Student Name
                  </span>
                  <div className="font-bold text-white text-sm truncate">
                    {result.studentName}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#070d1e] border border-[#1c2b50] space-y-1">
                  <span className="text-slate-500 text-[10px] uppercase font-semibold">
                    Course Program
                  </span>
                  <div className="font-medium text-slate-200 truncate">{result.course}</div>
                </div>

                <div className="p-3 rounded-lg bg-[#070d1e] border border-[#1c2b50] space-y-1">
                  <span className="text-slate-500 text-[10px] uppercase font-semibold">
                    Subject Name
                  </span>
                  <div className="font-medium text-slate-200 truncate">{result.subject}</div>
                </div>
              </div>

              {/* Marks Highlight Box */}
              <div className="p-5 rounded-xl bg-gradient-to-r from-[#111c38] to-[#0b132b] border border-[#1c2b50] flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                    Secured Examination Score
                  </span>
                  <div className="flex items-baseline space-x-2 mt-1">
                    <span className="text-3xl font-extrabold text-white font-mono">
                      {result.marksObtained.toFixed(1)}
                    </span>
                    <span className="text-sm font-medium text-slate-400">
                      / {result.maxMarks.toFixed(1)} Marks
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs text-slate-400">Performance Status</span>
                  <div className="mt-1">
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/30">
                      QUALIFIED ({( (result.marksObtained / result.maxMarks) * 100 ).toFixed(1)}%)
                    </span>
                  </div>
                </div>
              </div>

              {/* Cryptographic Proof Verification Steps */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-2">
                  <Key className="w-3.5 h-3.5 text-blue-400" />
                  <span>Multi-Layer Cryptographic Verification Chain</span>
                </h4>

                <div className="space-y-2.5 text-xs">
                  {/* Step 1: SHA-256 Record Hash */}
                  <div className="p-3.5 rounded-lg bg-[#070d1e] border border-[#1c2b50] flex items-start justify-between gap-3">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-slate-200">
                          1. Canonical SHA-256 Record Seal
                        </span>
                        {v?.isHashValid ? (
                          <span className="text-[10px] text-emerald-400 font-semibold flex items-center space-x-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Valid</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-red-400 font-semibold flex items-center space-x-1">
                            <XCircle className="w-3 h-3" />
                            <span>Tampered</span>
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-[11px] text-slate-400 break-all">
                        Expected: {v?.expectedHash}
                      </div>
                      {!v?.isHashValid && (
                        <div className="font-mono text-[11px] text-red-400 break-all">
                          Recalculated: {v?.recalculatedHash}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Step 2: Merkle Inclusion Proof */}
                  <div className="p-3.5 rounded-lg bg-[#070d1e] border border-[#1c2b50] flex items-start justify-between gap-3">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-slate-200">
                          2. RFC 6962 Merkle Inclusion Proof
                        </span>
                        {v?.isMerkleProofValid ? (
                          <span className="text-[10px] text-emerald-400 font-semibold flex items-center space-x-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Inclusion Proven</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-red-400 font-semibold flex items-center space-x-1">
                            <XCircle className="w-3 h-3" />
                            <span>Proof Failed</span>
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono break-all">
                        Leaf Index #{v?.merkleProof?.leafIndex ?? 0} • Proof steps:{' '}
                        {v?.merkleProof?.proof.length ?? 0}
                      </div>
                    </div>
                  </div>

                  {/* Step 3: Ed25519 Checkpoint Signature */}
                  <div className="p-3.5 rounded-lg bg-[#070d1e] border border-[#1c2b50] flex items-start justify-between gap-3">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-slate-200">
                          3. Ed25519 Authority Digital Signature
                        </span>
                        {v?.isCheckpointSignatureValid ? (
                          <span className="text-[10px] text-emerald-400 font-semibold flex items-center space-x-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Authentic Signature</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-red-400 font-semibold flex items-center space-x-1">
                            <XCircle className="w-3 h-3" />
                            <span>Unverified</span>
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono break-all">
                        Signed Checkpoint #{v?.checkpoint?.sequenceNumber ?? 0} • Root:{' '}
                        {v?.checkpoint?.merkleRoot?.substring(0, 16)}...
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Correction History if applicable */}
              {v?.correctionHistory && v.correctionHistory.length > 0 && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-2">
                  <div className="font-bold text-amber-400 flex items-center space-x-2">
                    <FileText className="w-4 h-4" />
                    <span>Statutory Correction History</span>
                  </div>
                  {v.correctionHistory.map((ch, idx) => (
                    <div key={idx} className="space-y-1 text-slate-300">
                      <p>
                        Marks corrected from{' '}
                        <span className="font-mono text-red-400">{ch.originalMarks.toFixed(1)}</span> to{' '}
                        <span className="font-mono text-emerald-400">{ch.proposedMarks.toFixed(1)}</span>{' '}
                        on {ch.resolvedAt ? new Date(ch.resolvedAt).toLocaleString() : ''}.
                      </p>
                      <p className="italic text-slate-400">"{ch.reason}"</p>
                      <div className="flex items-center space-x-2 pt-1 text-[11px] text-amber-300">
                        {ch.approvals.map((appr, aIdx) => (
                          <span key={aIdx} className="bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/40">
                            Signed by {appr.role} ({appr.name})
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
