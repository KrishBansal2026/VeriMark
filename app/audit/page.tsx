'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  RotateCcw,
  Zap,
  CheckCircle2,
  XCircle,
  Database,
  ArrowRight,
  Terminal,
  Lock,
} from 'lucide-react';
import { SystemAuditReport } from '@/lib/types';

export default function SecurityAuditPage() {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<SystemAuditReport | null>(null);
  const [auditError, setAuditError] = useState<{
    status: number;
    title: string;
    message: string;
    suggestion: string;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const runAudit = async () => {
    setLoading(true);
    setActionMessage(null);
    setAuditError(null);
    try {
      const res = await fetch('/api/audit');
      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        setReport(null);
        setAuditError({
          status: 401,
          title: 'Authentication Required (HTTP 401)',
          message: data.error || 'You must be authenticated to execute the cryptographic security audit.',
          suggestion: 'Please sign in with an Administrator (ADMIN) or Auditor (AUDITOR) account.',
        });
        return;
      }

      if (res.status === 403) {
        setReport(null);
        setAuditError({
          status: 403,
          title: 'Insufficient Permissions (HTTP 403)',
          message: data.error || 'Your current authenticated role lacks authorization to run the security audit.',
          suggestion: 'Only authorized ADMIN or AUDITOR accounts may inspect deep ledger integrity. Please sign in with an authorized institutional account.',
        });
        return;
      }

      if (!res.ok || !data.success) {
        setReport(null);
        setAuditError({
          status: res.status || 500,
          title: `Audit Service Error (HTTP ${res.status || 500})`,
          message: data.error || 'The audit engine encountered an error while verifying cryptographic ledger state.',
          suggestion: 'Check server logs or retry the audit operation.',
        });
        return;
      }

      setReport(data.report);
      setAuditError(null);
    } catch (err: any) {
      setReport(null);
      setAuditError({
        status: 500,
        title: 'Connection Failure',
        message: err.message || 'Unable to connect to the audit API endpoint.',
        suggestion: 'Verify network connection and retry.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runAudit();
  }, []);

  const handleSimulateTamper = async () => {
    setActionLoading('tamper');
    setActionMessage(null);
    try {
      const res = await fetch('/api/audit/simulate-tamper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newMarks: 99.5 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to simulate tampering');
      }
      setActionMessage(data.message);
      await runAudit();
    } catch (err: any) {
      setActionMessage(`Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRollback = async () => {
    setActionLoading('rollback');
    setActionMessage(null);
    try {
      const res = await fetch('/api/audit/rollback', {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to execute rollback');
      }
      setActionMessage(data.message);
      await runAudit();
    } catch (err: any) {
      setActionMessage(`Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const isSecure = report?.overallStatus === 'SECURE';

  return (
    <>
      <Header
        title="Security & Tampering Audit Engine"
        subtitle="Independent verification of database records against Merkle roots and signed checkpoints"
      />

      <main className="p-8 space-y-8 max-w-7xl">
        {/* Action message notification */}
        {actionMessage && (
          <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs flex items-center space-x-2">
            <Terminal className="w-4 h-4 shrink-0 text-cyan-400" />
            <span>{actionMessage}</span>
          </div>
        )}

        {/* Master Integrity Status Banner or Authorization Warning Banner */}
        {auditError ? (
          <div className="border border-amber-500/40 rounded-2xl p-6 bg-gradient-to-r from-[#1c150c] via-[#241b10] to-[#1c150c] shadow-lg transition-all">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-start space-x-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  <Lock className="w-8 h-8" />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      ACCESS RESTRICTED: HTTP {auditError.status}
                    </span>
                  </div>

                  <h2 className="text-xl font-bold text-white tracking-tight">
                    {auditError.title}
                  </h2>

                  <p className="text-xs text-amber-200/90 max-w-2xl">
                    {auditError.message}
                  </p>
                  <p className="text-xs text-slate-400 max-w-2xl pt-1">
                    {auditError.suggestion}
                  </p>
                </div>
              </div>

              <button
                onClick={runAudit}
                disabled={loading}
                className="px-4 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-semibold flex items-center space-x-2 self-start md:self-auto shrink-0 transition-all"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>Retry Audit</span>
              </button>
            </div>
          </div>
        ) : (
          <div
            className={`border rounded-2xl p-6 relative overflow-hidden transition-all ${
              isSecure
                ? 'bg-gradient-to-r from-[#0b132b] via-[#0d2238] to-[#0b132b] border-emerald-500/30'
                : 'bg-gradient-to-r from-[#1f0d14] via-[#2d111b] to-[#1f0d14] border-red-500/50'
            }`}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-start space-x-4">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
                    isSecure
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : 'bg-red-500/10 text-red-400 border border-red-500/30 animate-pulse'
                  }`}
                >
                  {isSecure ? (
                    <ShieldCheck className="w-8 h-8" />
                  ) : (
                    <ShieldAlert className="w-8 h-8" />
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wider ${
                        isSecure
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-red-500/20 text-red-400 border border-red-500/40'
                      }`}
                    >
                      SYSTEM STATUS: {report?.overallStatus || 'SCANNING...'}
                    </span>
                    <span className="text-xs text-slate-400">
                      Last audited: {report ? new Date(report.auditedAt).toLocaleTimeString() : '...'}
                    </span>
                  </div>

                  <h2 className="text-xl font-bold text-white tracking-tight">
                    {isSecure
                      ? '100% Cryptographic Ledger Integrity Confirmed'
                      : 'CRITICAL ALERT: Unauthorized Database Alteration Detected!'}
                  </h2>

                  <p className="text-xs text-slate-400 max-w-2xl">
                    {isSecure
                      ? 'All database result records match their canonical SHA-256 seals, RFC 6962 Merkle tree inclusion proofs, and independently vault-protected Ed25519 signed checkpoints.'
                      : 'One or more examination marks in the database have been modified directly, bypassing application APIs, dual-signer approvals, and ledger checkpoints.'}
                  </p>
                </div>
              </div>

              <button
                onClick={runAudit}
                disabled={loading}
                className="px-4 py-2.5 rounded-xl bg-[#111c38] hover:bg-[#162244] border border-[#1c2b50] text-slate-200 text-xs font-semibold flex items-center space-x-2 self-start md:self-auto shrink-0 transition-all"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>Re-Run Deep Audit</span>
              </button>
            </div>
          </div>
        )}

        {/* Hackathon Judge Demonstration Console */}
        <div className="bg-[#111c38] border border-[#1c2b50] rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Zap className="w-4 h-4 text-cyan-400" />
                <span>Hackathon Evaluation & Stress-Test Console</span>
              </h3>
              <p className="text-xs text-slate-400">
                Test VeriMark's tamper-proof architecture live. Simulate rogue insider attacks or direct SQL updates.
              </p>
            </div>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              Interactive Test Mode
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Attack Button */}
            <div className="p-4 rounded-xl bg-[#0b132b] border border-red-500/30 flex flex-col justify-between space-y-3">
              <div>
                <span className="text-xs font-bold text-red-400 flex items-center space-x-1.5">
                  <Database className="w-3.5 h-3.5" />
                  <span>1. Simulate Direct Database Tampering</span>
                </span>
                <p className="text-[11px] text-slate-400 mt-1">
                  Directly alters a student's marks in the database from e.g. 76.0 to 99.5 without going through the two-approver ledger.
                </p>
              </div>

              <button
                onClick={handleSimulateTamper}
                disabled={actionLoading !== null}
                className="w-full py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold flex items-center justify-center space-x-2 transition-all shadow-md shadow-red-600/20 disabled:opacity-50"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>
                  {actionLoading === 'tamper' ? 'Mutating Database...' : 'Execute Direct DB Mutation'}
                </span>
              </button>
            </div>

            {/* Defense & Rollback Button */}
            <div className="p-4 rounded-xl bg-[#0b132b] border border-emerald-500/30 flex flex-col justify-between space-y-3">
              <div>
                <span className="text-xs font-bold text-emerald-400 flex items-center space-x-1.5">
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>2. Restore to Signed Checkpoint</span>
                </span>
                <p className="text-[11px] text-slate-400 mt-1">
                  Reconstructs authentic state using the independently protected vault and rolls back unauthorized modifications.
                </p>
              </div>

              <button
                onClick={handleRollback}
                disabled={actionLoading !== null}
                className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center space-x-2 transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>
                  {actionLoading === 'rollback' ? 'Restoring State...' : 'Rollback & Restore from Vault'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Audit Findings & Comparison Table */}
        <div className="space-y-4">
          <h3 className="text-base font-bold text-white tracking-tight flex items-center space-x-2">
            <span>Cryptographic Verification Checklist</span>
            {report ? (
              <span className="text-xs text-slate-400 font-normal">
                ({report.publishedCount} published records verified)
              </span>
            ) : null}
          </h3>

          {loading ? (
            <div className="p-8 text-center text-slate-400 bg-[#111c38] border border-[#1c2b50] rounded-xl space-y-2">
              <RefreshCw className="w-8 h-8 text-blue-400 mx-auto animate-spin" />
              <div className="text-sm font-semibold text-white">Verifying Cryptographic Ledger Records...</div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Comparing database rows with canonical SHA-256 seals, Merkle inclusion proofs, and signed checkpoints.
              </p>
            </div>
          ) : auditError ? (
            <div className="p-8 text-center text-slate-400 bg-[#111c38] border border-amber-500/30 rounded-xl space-y-3">
              <ShieldAlert className="w-8 h-8 text-amber-400 mx-auto" />
              <div className="text-sm font-semibold text-white">Audit Execution Suspended</div>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Records cannot be audited without valid authentication. Please log in with an Administrator or Auditor profile using the top header to run this verification.
              </p>
              <button
                onClick={runAudit}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all shadow-md shadow-blue-600/20 inline-flex items-center space-x-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Audit</span>
              </button>
            </div>
          ) : report && report.findings.length > 0 ? (
            <div className="space-y-4">
              {report.findings.map((f, idx) => (
                <div
                  key={idx}
                  className="bg-[#1f0d14] border border-red-500/40 rounded-xl p-5 space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-red-500/20 pb-3">
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 font-mono text-xs font-bold">
                        MISMATCH #{idx + 1}
                      </span>
                      <span className="text-xs font-semibold text-white">
                        Student: {f.studentName} ({f.studentRegNo}) - {f.subject}
                      </span>
                    </div>
                    <span className="text-[11px] text-red-400 font-semibold uppercase">
                      CRITICAL INTEGRITY BREACH
                    </span>
                  </div>

                  <p className="text-xs text-red-200">{f.details}</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                    <div className="p-3 rounded-lg bg-[#070d1e] border border-red-500/30 space-y-1">
                      <span className="text-[10px] text-slate-400 uppercase font-sans font-semibold">
                        Expected Hash (Cryptographic Seal)
                      </span>
                      <div className="text-emerald-400 break-all text-[11px]">
                        {f.expectedHash}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-[#070d1e] border border-red-500/30 space-y-1">
                      <span className="text-[10px] text-slate-400 uppercase font-sans font-semibold">
                        Actual Recalculated Hash (From DB Values)
                      </span>
                      <div className="text-red-400 break-all text-[11px]">
                        {f.actualCalculatedHash}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : report ? (
            <div className="p-8 text-center text-slate-400 bg-[#111c38] border border-[#1c2b50] rounded-xl space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <div className="text-sm font-semibold text-white">All Records Clean &amp; Verified</div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No discrepancies found. Every single marksheet record matches its canonical SHA-256 hash and Merkle root.
              </p>
            </div>
          ) : null}
        </div>
      </main>
    </>
  );
}
