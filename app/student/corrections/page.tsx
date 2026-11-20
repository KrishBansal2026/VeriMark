'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Link from 'next/link';
import {
  ShieldCheck,
  ShieldAlert,
  Clock,
  ArrowRight,
  UserCheck,
  Key,
  Info,
  CheckCircle2,
  AlertTriangle,
  History,
  FileText,
} from 'lucide-react';
import { CorrectionRequest } from '@/lib/types';

export default function StudentCorrectionsPage() {
  const [corrections, setCorrections] = useState<CorrectionRequest[]>([]);
  const [studentRegNo, setStudentRegNo] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const fetchCorrections = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/student/corrections');
      const data = await res.json();
      if (data.success) {
        setCorrections(data.corrections || []);
        setStudentRegNo(data.studentRegNo || '');
      }
    } catch (err) {
      console.error('Failed to load correction history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCorrections();
  }, []);

  return (
    <>
      <Header
        title="Statutory Correction History"
        subtitle="Transparent cryptographic audit trail of all mark amendment requests and dual-officer approvals"
      />

      <main className="p-4 sm:p-8 space-y-6 max-w-5xl mx-auto">
        {/* Statutory Regulatory Notice */}
        <div className="p-4 rounded-xl bg-blue-950/40 border border-blue-500/30 flex items-start space-x-3.5">
          <Info className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs text-slate-300">
            <h4 className="font-bold text-white text-sm">Two-Person Rule (M-of-N) Statutory Governance</h4>
            <p className="leading-relaxed text-slate-300">
              Under university examination ordinances and Problem Statement H8 security architecture, no single officer or administrator can alter published marks. Any correction requires independent cryptographic authorization with Ed25519 digital signatures from both the <strong>Controller of Examinations</strong> and the <strong>Dean of Academic Affairs</strong>. Every amendment produces an immutable append-only ledger transaction with full cryptographic proof.
            </p>
            <p className="text-[11px] text-slate-400 font-medium">
              Student accounts have read-only access to verify all historical amendments and cryptographic signatures.
            </p>
          </div>
        </div>

        {/* Audit Trail List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <History className="w-4 h-4 text-cyan-400" />
              <span>Historical Amendments for {studentRegNo || 'Authenticated Profile'}</span>
            </h3>
            <span className="text-xs font-mono text-slate-400">
              {corrections.length} recorded event{corrections.length !== 1 ? 's' : ''}
            </span>
          </div>

          {loading ? (
            <div className="py-20 text-center text-slate-400 animate-pulse text-sm">
              Loading cryptographic amendment records...
            </div>
          ) : corrections.length === 0 ? (
            <div className="p-10 text-center bg-[#0b132b] rounded-xl border border-[#1c2b50] space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <h4 className="text-sm font-bold text-white">No Mark Amendments Recorded</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                No correction requests or post-publication amendments exist for your registration number. All your academic marks remain sealed under their original publication checkpoint without alteration.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {corrections.map((corr) => {
                const isApproved = corr.status === 'approved_applied';
                const isPending = corr.status === 'pending_approvals' || corr.status === 'partially_approved';

                return (
                  <div
                    key={corr.id}
                    className="p-5 rounded-xl bg-[#0b132b] border border-[#1c2b50] shadow-xl space-y-4 hover:border-slate-700 transition-all"
                  >
                    {/* Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1c2b50] pb-3">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-white text-base">{corr.subject}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              isApproved
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : isPending
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'bg-red-500/20 text-red-400 border border-red-500/30'
                            }`}
                          >
                            {corr.status.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 font-mono mt-0.5">
                          Request ID: {corr.id} • Initiated by {corr.requesterName}
                        </p>
                      </div>

                      <div className="text-right text-xs text-slate-400 font-mono">
                        <div>Filed: {new Date(corr.createdAt).toLocaleString()}</div>
                        {corr.resolvedAt && (
                          <div className="text-emerald-400">
                            Applied: {new Date(corr.resolvedAt).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Marks Comparison Card */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#111c38]/70 p-3.5 rounded-lg border border-[#1c2b50]/70 text-xs">
                      <div>
                        <span className="text-[11px] text-slate-400 block font-semibold">Original Published Marks</span>
                        <span className="text-base font-bold text-slate-300 font-mono">{corr.originalMarks} / 100</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <ArrowRight className="w-4 h-4 text-cyan-400" />
                        <div>
                          <span className="text-[11px] text-slate-400 block font-semibold">Amended Marks</span>
                          <span className="text-base font-bold text-cyan-400 font-mono">{corr.proposedMarks} / 100</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400 block font-semibold">Statutory Justification</span>
                        <span className="text-xs text-slate-200 italic">&ldquo;{corr.reason}&rdquo;</span>
                      </div>
                    </div>

                    {/* Approvers Status */}
                    <div className="space-y-2 pt-1">
                      <span className="text-xs font-bold text-slate-300 flex items-center space-x-1.5 uppercase tracking-wider">
                        <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Dual Institutional Officer Attestation</span>
                      </span>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Approver 1: Exam Controller */}
                        {(() => {
                          const ecApproval = corr.approvals.find((a) => a.approverRole === 'EXAM_CONTROLLER');
                          return (
                            <div className="p-3 rounded-lg bg-[#070d1e] border border-[#1c2b50] space-y-1 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-slate-200">Controller of Examinations</span>
                                {ecApproval ? (
                                  <span className="text-[10px] text-emerald-400 font-bold flex items-center space-x-1">
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>SIGNED</span>
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-amber-400 font-bold">AWAITING SIGNATURE</span>
                                )}
                              </div>
                              {ecApproval && (
                                <div className="space-y-0.5 text-[11px] text-slate-400 font-mono">
                                  <p className="text-slate-300">{ecApproval.approverName}</p>
                                  <p className="text-[10px] text-cyan-400 truncate">
                                    Sig: {ecApproval.signature.slice(0, 32)}...
                                  </p>
                                  <p className="text-[10px] text-slate-500">
                                    {new Date(ecApproval.approvedAt).toLocaleString()}
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Approver 2: Academic Dean */}
                        {(() => {
                          const deanApproval = corr.approvals.find((a) => a.approverRole === 'ACADEMIC_DEAN');
                          return (
                            <div className="p-3 rounded-lg bg-[#070d1e] border border-[#1c2b50] space-y-1 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-slate-200">Dean of Academic Affairs</span>
                                {deanApproval ? (
                                  <span className="text-[10px] text-emerald-400 font-bold flex items-center space-x-1">
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>SIGNED</span>
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-amber-400 font-bold">AWAITING SIGNATURE</span>
                                )}
                              </div>
                              {deanApproval && (
                                <div className="space-y-0.5 text-[11px] text-slate-400 font-mono">
                                  <p className="text-slate-300">{deanApproval.approverName}</p>
                                  <p className="text-[10px] text-cyan-400 truncate">
                                    Sig: {deanApproval.signature.slice(0, 32)}...
                                  </p>
                                  <p className="text-[10px] text-slate-500">
                                    {new Date(deanApproval.approvedAt).toLocaleString()}
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Hash Transition */}
                    <div className="pt-2 border-t border-[#1c2b50] text-[11px] font-mono text-slate-400 space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-slate-500">Prior SHA-256:</span>
                        <span className="text-slate-300 truncate">{corr.originalHash}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-slate-500">Amended SHA-256:</span>
                        <span className="text-cyan-400 truncate">{corr.proposedHash}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
