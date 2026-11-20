'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import {
  UserCheck,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  FileText,
  Key,
  Clock,
  ArrowRight,
  RefreshCw,
  Lock,
} from 'lucide-react';
import { CorrectionRequest, ApproverRole } from '@/lib/types';

export default function CorrectionsPage() {
  const [requests, setRequests] = useState<CorrectionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [signingId, setSigningId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchCorrections = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/corrections');
      const data = await res.json();
      if (data.success) {
        setRequests(data.requests);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCorrections();
  }, []);

  const handleApprove = async (requestId: string, role: ApproverRole) => {
    setSigningId(`${requestId}_${role}`);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/corrections/${requestId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approverRole: role,
          comments: `Cryptographically authorized under statutory regulations as ${role}`,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit digital signature');
      }

      setActionMessage({
        type: 'success',
        text: data.message,
      });
      await fetchCorrections();
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err.message,
      });
    } finally {
      setSigningId(null);
    }
  };

  return (
    <>
      <Header
        title="Two-Person Correction Approval Management"
        subtitle="Dual Ed25519 digital signature portal for result modifications (Controller of Examinations & Academic Dean)"
      />

      <main className="p-8 space-y-6 max-w-7xl">
        {/* Status notification */}
        {actionMessage && (
          <div
            className={`p-4 rounded-xl border text-xs flex items-center space-x-3 ${
              actionMessage.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}
          >
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0" />
            )}
            <span className="font-medium">{actionMessage.text}</span>
          </div>
        )}

        {/* Informational banner */}
        <div className="bg-[#111c38] border border-[#1c2b50] rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                STATUTORY RULE H8-3
              </span>
              <span className="text-xs text-slate-300 font-semibold">Dual Authorization Mandate</span>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl">
              Published examination results are immutable to single-user edits. Any alteration requires independent digital review and Ed25519 signing from both the Controller of Examinations and the Dean of Academic Affairs.
            </p>
          </div>

          <button
            onClick={fetchCorrections}
            className="p-2 rounded-lg border border-[#1c2b50] bg-[#0b132b] text-slate-400 hover:text-white shrink-0 self-start md:self-auto"
            title="Refresh requests"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Requests List */}
        <div className="space-y-6">
          {loading ? (
            <div className="p-12 text-center text-slate-400 bg-[#111c38] border border-[#1c2b50] rounded-xl">
              Loading correction workflows...
            </div>
          ) : requests.length === 0 ? (
            <div className="p-12 text-center text-slate-400 bg-[#111c38] border border-[#1c2b50] rounded-xl space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto opacity-60" />
              <div className="text-sm font-semibold text-white">No Pending Correction Requests</div>
              <p className="text-xs text-slate-500">
                All examination records are in pristine sealed status. Requests can be initiated from the Results page.
              </p>
            </div>
          ) : (
            requests.map((req) => {
              const hasExamController = req.approvals.some((a) => a.approverRole === 'EXAM_CONTROLLER');
              const hasAcademicDean = req.approvals.some((a) => a.approverRole === 'ACADEMIC_DEAN');

              return (
                <div
                  key={req.id}
                  className="bg-[#111c38] border border-[#1c2b50] rounded-xl p-6 space-y-5 relative overflow-hidden"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1c2b50]/60 pb-4">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-cyan-400 font-bold text-sm">
                          {req.studentRegNo}
                        </span>
                        <span className="text-slate-400 text-xs">• {req.subject}</span>
                      </div>
                      <p className="text-xs text-slate-400">
                        Requested by <span className="text-slate-300 font-medium">{req.requesterName}</span> on{' '}
                        {new Date(req.createdAt).toLocaleString()}
                      </p>
                    </div>

                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold border ${
                        req.status === 'approved_applied'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : req.status === 'partially_approved'
                          ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      }`}
                    >
                      {req.status === 'approved_applied'
                        ? 'DUAL-APPROVED & COMMITTED'
                        : req.status === 'partially_approved'
                        ? '1/2 SIGNATURES VERIFIED'
                        : 'AWAITING APPROVALS'}
                    </span>
                  </div>

                  {/* Marks Diff & Justification */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="bg-[#0b132b] p-4 rounded-lg border border-[#1c2b50] space-y-2">
                      <div className="text-slate-400 font-semibold uppercase text-[10px]">
                        Marks Amendment Diff
                      </div>
                      <div className="flex items-center space-x-4">
                        <div>
                          <div className="text-[11px] text-slate-500">Original Marks</div>
                          <div className="text-lg font-bold text-red-400 font-mono">
                            {req.originalMarks.toFixed(1)}
                          </div>
                        </div>
                        <ArrowRight className="w-5 h-5 text-slate-500" />
                        <div>
                          <div className="text-[11px] text-slate-500">Proposed Corrected</div>
                          <div className="text-lg font-bold text-emerald-400 font-mono">
                            {req.proposedMarks.toFixed(1)}
                          </div>
                        </div>
                      </div>
                      <div className="pt-1 text-[11px] text-slate-400 font-mono break-all">
                        <span className="text-slate-500">Proposed SHA-256:</span> {req.proposedHash.substring(0, 24)}...
                      </div>
                    </div>

                    <div className="bg-[#0b132b] p-4 rounded-lg border border-[#1c2b50] space-y-2">
                      <div className="text-slate-400 font-semibold uppercase text-[10px]">
                        Administrative Justification
                      </div>
                      <p className="text-slate-200 leading-relaxed italic">
                        "{req.reason}"
                      </p>
                    </div>
                  </div>

                  {/* Dual Signer Action Cards */}
                  <div className="space-y-3 pt-2">
                    <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider text-[10px]">
                      Required Independent Signatories (2 of 2)
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Signer 1: Controller of Examinations */}
                      <div className="p-4 rounded-lg bg-[#070d1e] border border-[#1c2b50] flex flex-col justify-between space-y-3">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white">
                              Dr. Robert Vance
                            </span>
                            {hasExamController ? (
                              <span className="inline-flex items-center space-x-1 text-[10px] text-emerald-400 font-semibold">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Signed</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 text-[10px] text-amber-400 font-semibold">
                                <Clock className="w-3.5 h-3.5" />
                                <span>Pending</span>
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400">Controller of Examinations</p>
                        </div>

                        {hasExamController ? (
                          <div className="text-[10px] font-mono text-slate-500 bg-[#0b132b] p-2 rounded border border-[#1c2b50]/60">
                            Sig: {req.approvals.find((a) => a.approverRole === 'EXAM_CONTROLLER')?.signature.substring(0, 32)}...
                          </div>
                        ) : (
                          <button
                            onClick={() => handleApprove(req.id, 'EXAM_CONTROLLER')}
                            disabled={signingId !== null}
                            className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center space-x-2 transition-all shadow-md shadow-blue-600/20 disabled:opacity-50"
                          >
                            <Key className="w-3.5 h-3.5" />
                            <span>
                              {signingId === `${req.id}_EXAM_CONTROLLER`
                                ? 'Signing with Ed25519...'
                                : 'Sign as Exam Controller'}
                            </span>
                          </button>
                        )}
                      </div>

                      {/* Signer 2: Academic Dean */}
                      <div className="p-4 rounded-lg bg-[#070d1e] border border-[#1c2b50] flex flex-col justify-between space-y-3">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white">
                              Prof. Margaret Hamilton
                            </span>
                            {hasAcademicDean ? (
                              <span className="inline-flex items-center space-x-1 text-[10px] text-emerald-400 font-semibold">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Signed</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 text-[10px] text-amber-400 font-semibold">
                                <Clock className="w-3.5 h-3.5" />
                                <span>Pending</span>
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400">Dean of Academic Affairs</p>
                        </div>

                        {hasAcademicDean ? (
                          <div className="text-[10px] font-mono text-slate-500 bg-[#0b132b] p-2 rounded border border-[#1c2b50]/60">
                            Sig: {req.approvals.find((a) => a.approverRole === 'ACADEMIC_DEAN')?.signature.substring(0, 32)}...
                          </div>
                        ) : (
                          <button
                            onClick={() => handleApprove(req.id, 'ACADEMIC_DEAN')}
                            disabled={signingId !== null}
                            className="w-full py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center justify-center space-x-2 transition-all shadow-md shadow-purple-600/20 disabled:opacity-50"
                          >
                            <Key className="w-3.5 h-3.5" />
                            <span>
                              {signingId === `${req.id}_ACADEMIC_DEAN`
                                ? 'Signing with Ed25519...'
                                : 'Sign as Academic Dean'}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>
    </>
  );
}
