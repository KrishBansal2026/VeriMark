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
  User,
} from 'lucide-react';
import { CorrectionRequest, ApproverRole, AuthUser } from '@/lib/types';

export default function CorrectionsPage() {
  const [requests, setRequests] = useState<CorrectionRequest[]>([]);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingId, setSigningId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchSessionAndData = async () => {
    setLoading(true);
    try {
      const [corrRes, authRes] = await Promise.all([
        fetch('/api/corrections'),
        fetch('/api/auth/me'),
      ]);
      const corrData = await corrRes.json();
      const authData = await authRes.json();

      if (corrData.success) {
        setRequests(corrData.requests);
      }
      if (authData.success) {
        setCurrentUser(authData.user);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessionAndData();
  }, []);

  const handleApprove = async (requestId: string, roleToSign: ApproverRole) => {
    setSigningId(`${requestId}_${roleToSign}`);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/corrections/${requestId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comments: `Cryptographically authorized under statutory regulations by ${currentUser?.name || 'Authorized Signatory'}`,
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
      await fetchSessionAndData();
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
        subtitle="Dual Ed25519 digital signature portal with verified distinct-user session enforcement"
      />

      <main className="p-4 sm:p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
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
                STRICT FOUR-EYES PRINCIPLE
              </span>
              <span className="text-xs text-slate-300 font-semibold">Dual Identity Mandate</span>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl">
              Published results require two distinct authenticated individuals with roles <span className="text-cyan-300 font-mono">EXAM_CONTROLLER</span> and <span className="text-purple-300 font-mono">ACADEMIC_DEAN</span>. The correction requester is barred from approving.
            </p>
          </div>

          <div className="flex items-center space-x-2 self-start md:self-auto shrink-0">
            <button
              onClick={fetchSessionAndData}
              className="p-2 rounded-lg border border-[#1c2b50] bg-[#0b132b] text-slate-400 hover:text-white"
              title="Refresh requests"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
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
              const controllerApproval = req.approvals.find((a) => a.approverRole === 'EXAM_CONTROLLER');
              const deanApproval = req.approvals.find((a) => a.approverRole === 'ACADEMIC_DEAN');

              const isCurrentUserRequester = Boolean(currentUser && req.requesterUserId === currentUser.id);

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
                        Requested by <span className="text-slate-200 font-semibold">{req.requesterName}</span> on{' '}
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
                      {isCurrentUserRequester && (
                        <p className="text-[11px] text-amber-400 font-semibold pt-1">
                          ⚠️ You requested this correction. As per institutional rules, you cannot approve your own request.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Dual Signer Action Cards */}
                  <div className="space-y-3 pt-2">
                    <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider text-[10px]">
                      Required Distinct Signatories (2 of 2)
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Signer 1: Controller of Examinations */}
                      <div className="p-4 rounded-lg bg-[#070d1e] border border-[#1c2b50] flex flex-col justify-between space-y-3">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white">
                              Dr. Robert Vance
                            </span>
                            {controllerApproval ? (
                              <span className="inline-flex items-center space-x-1 text-[10px] text-emerald-400 font-semibold">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Signed (User: {controllerApproval.approverUserId})</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 text-[10px] text-amber-400 font-semibold">
                                <Clock className="w-3.5 h-3.5" />
                                <span>Pending Approval</span>
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400">Controller of Examinations (EXAM_CONTROLLER)</p>
                        </div>

                        {controllerApproval ? (
                          <div className="text-[10px] font-mono text-slate-400 bg-[#0b132b] p-2 rounded border border-[#1c2b50]/60 space-y-1">
                            <div>Signer: {controllerApproval.approverName}</div>
                            <div className="text-[9px] text-slate-500 break-all">
                              Sig: {controllerApproval.signature.substring(0, 32)}...
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleApprove(req.id, 'EXAM_CONTROLLER')}
                            disabled={
                              signingId !== null ||
                              currentUser?.role !== 'EXAM_CONTROLLER' ||
                              isCurrentUserRequester
                            }
                            className={`w-full py-2 rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 transition-all shadow-md ${
                              currentUser?.role === 'EXAM_CONTROLLER' && !isCurrentUserRequester
                                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20'
                                : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                            }`}
                          >
                            <Key className="w-3.5 h-3.5" />
                            <span>
                              {signingId === `${req.id}_EXAM_CONTROLLER`
                                ? 'Signing with Ed25519...'
                                : currentUser?.role === 'EXAM_CONTROLLER'
                                ? 'Sign as Exam Controller'
                                : 'Switch to Dr. Vance to Sign'}
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
                            {deanApproval ? (
                              <span className="inline-flex items-center space-x-1 text-[10px] text-emerald-400 font-semibold">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Signed (User: {deanApproval.approverUserId})</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 text-[10px] text-amber-400 font-semibold">
                                <Clock className="w-3.5 h-3.5" />
                                <span>Pending Approval</span>
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400">Dean of Academic Affairs (ACADEMIC_DEAN)</p>
                        </div>

                        {deanApproval ? (
                          <div className="text-[10px] font-mono text-slate-400 bg-[#0b132b] p-2 rounded border border-[#1c2b50]/60 space-y-1">
                            <div>Signer: {deanApproval.approverName}</div>
                            <div className="text-[9px] text-slate-500 break-all">
                              Sig: {deanApproval.signature.substring(0, 32)}...
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleApprove(req.id, 'ACADEMIC_DEAN')}
                            disabled={
                              signingId !== null ||
                              currentUser?.role !== 'ACADEMIC_DEAN' ||
                              isCurrentUserRequester
                            }
                            className={`w-full py-2 rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 transition-all shadow-md ${
                              currentUser?.role === 'ACADEMIC_DEAN' && !isCurrentUserRequester
                                ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/20'
                                : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                            }`}
                          >
                            <Key className="w-3.5 h-3.5" />
                            <span>
                              {signingId === `${req.id}_ACADEMIC_DEAN`
                                ? 'Signing with Ed25519...'
                                : currentUser?.role === 'ACADEMIC_DEAN'
                                ? 'Sign as Academic Dean'
                                : 'Switch to Prof. Hamilton to Sign'}
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
