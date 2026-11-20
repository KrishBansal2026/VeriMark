'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Link from 'next/link';
import {
  GraduationCap,
  Plus,
  Search,
  Filter,
  ShieldCheck,
  QrCode,
  Edit3,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  X,
  AlertCircle,
} from 'lucide-react';
import { StudentResult } from '@/lib/types';

export default function ResultsPage() {
  const [results, setResults] = useState<StudentResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);

  const [activeResult, setActiveResult] = useState<StudentResult | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [verifyUrl, setVerifyUrl] = useState<string>('');

  // Form states
  const [newResultForm, setNewResultForm] = useState({
    studentRegNo: '',
    studentName: '',
    course: 'B.Tech Computer Science',
    subject: '',
    examName: 'End Semester Examination 2026',
    marksObtained: '',
    maxMarks: '100',
    publishImmediately: true,
  });

  const [correctionForm, setCorrectionForm] = useState({
    proposedMarks: '',
    reason: '',
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchResults = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/results');
      const data = await res.json();
      if (data.success) {
        setResults(data.results);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, []);

  const handleOpenQrModal = async (result: StudentResult) => {
    setActiveResult(result);
    setIsQrModalOpen(true);
    try {
      const res = await fetch(`/api/results/${result.id}/qr`);
      const data = await res.json();
      if (data.success) {
        setQrDataUrl(data.qrDataUrl);
        setVerifyUrl(data.verifyUrl);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenCorrectionModal = (result: StudentResult) => {
    setActiveResult(result);
    setCorrectionForm({
      proposedMarks: result.marksObtained.toString(),
      reason: '',
    });
    setFormError(null);
    setFormSuccess(null);
    setIsCorrectionModalOpen(true);
  };

  const handleCreateResult = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch('/api/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newResultForm),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create student result');
      }

      setIsAddModalOpen(false);
      setNewResultForm({
        studentRegNo: '',
        studentName: '',
        course: 'B.Tech Computer Science',
        subject: '',
        examName: 'End Semester Examination 2026',
        marksObtained: '',
        maxMarks: '100',
        publishImmediately: true,
      });
      await fetchResults();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublishResult = async (resultId: string) => {
    try {
      const res = await fetch(`/api/results/${resultId}/publish`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        await fetchResults();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmitCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeResult) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch('/api/corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resultId: activeResult.id,
          proposedMarks: Number(correctionForm.proposedMarks),
          reason: correctionForm.reason,
          requesterName: 'Exam Office Administrator',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit correction request');
      }

      setFormSuccess('Correction request registered! Awaiting dual Ed25519 approvals.');
      setTimeout(() => {
        setIsCorrectionModalOpen(false);
      }, 1500);
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredResults = results.filter((r) => {
    const matchesSearch =
      r.studentName.toLowerCase().includes(search.toLowerCase()) ||
      r.studentRegNo.toLowerCase().includes(search.toLowerCase()) ||
      r.subject.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      filterStatus === 'ALL' || r.status.toUpperCase() === filterStatus;

    return matchesSearch && matchesStatus;
  });

  return (
    <>
      <Header
        title="Student Examination Results"
        subtitle="Manage marks, publish to append-only ledger, and generate QR verification codes"
      />

      <main className="p-8 space-y-6 max-w-7xl">
        {/* Controls bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by student name, reg no, or subject..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#111c38] border border-[#1c2b50] rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-[#111c38] border border-[#1c2b50] rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="PUBLISHED">Published</option>
              <option value="CORRECTED">Corrected</option>
              <option value="DRAFT">Draft</option>
            </select>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={fetchResults}
              className="p-2 rounded-lg border border-[#1c2b50] bg-[#111c38] text-slate-400 hover:text-white"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => {
                setFormError(null);
                setIsAddModalOpen(true);
              }}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center space-x-2 transition-all shadow-md shadow-blue-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>Add Student Result</span>
            </button>
          </div>
        </div>

        {/* Results Table */}
        <div className="bg-[#111c38] border border-[#1c2b50] rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0b132b]/90 border-b border-[#1c2b50] text-slate-400 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4 font-semibold">Student ID</th>
                  <th className="py-3 px-4 font-semibold">Name</th>
                  <th className="py-3 px-4 font-semibold">Subject & Examination</th>
                  <th className="py-3 px-4 font-semibold">Marks</th>
                  <th className="py-3 px-4 font-semibold">Cryptographic Hash</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1c2b50]/60">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      Loading student result registry...
                    </td>
                  </tr>
                ) : filteredResults.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No matching student results found.
                    </td>
                  </tr>
                ) : (
                  filteredResults.map((r) => (
                    <tr key={r.id} className="hover:bg-[#162244] transition-colors">
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-200">
                        {r.studentRegNo}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-white">{r.studentName}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-200">{r.subject}</div>
                        <div className="text-[11px] text-slate-500">{r.examName}</div>
                      </td>
                      <td className="py-3.5 px-4 font-semibold">
                        <span className="text-cyan-400 font-mono text-sm">
                          {r.marksObtained.toFixed(1)}
                        </span>
                        <span className="text-slate-500 font-normal"> / {r.maxMarks.toFixed(1)}</span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">
                        <span className="bg-[#070d1e] px-2 py-1 rounded border border-[#1c2b50]">
                          {r.recordHash.substring(0, 16)}...
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
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
                      <td className="py-3.5 px-4 text-right space-x-2">
                        {r.status === 'draft' ? (
                          <button
                            onClick={() => handlePublishResult(r.id)}
                            className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold transition-all"
                          >
                            Publish & Seal
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => handleOpenQrModal(r)}
                              className="inline-flex items-center space-x-1 px-2 py-1 rounded bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-[11px] font-medium"
                              title="Show Verification QR Code"
                            >
                              <QrCode className="w-3 h-3" />
                              <span>QR</span>
                            </button>
                            <button
                              onClick={() => handleOpenCorrectionModal(r)}
                              className="inline-flex items-center space-x-1 px-2 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[11px] font-medium"
                              title="Request Dual-Signer Correction"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Correction</span>
                            </button>
                            <Link
                              href={`/verify/${r.id}`}
                              className="inline-flex items-center p-1 rounded hover:bg-[#1f2e54] text-slate-400 hover:text-white"
                              title="Open Public Marksheet Verification"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Link>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add Student Result Modal */}
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#0b132b] border border-[#1c2b50] rounded-xl max-w-lg w-full p-6 shadow-2xl relative">
              <div className="flex items-center justify-between pb-4 border-b border-[#1c2b50]">
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <GraduationCap className="w-5 h-5 text-blue-400" />
                  <span>Add Student Examination Result</span>
                </h3>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {formError && (
                <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleCreateResult} className="mt-4 space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Student Reg No</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. CF2026-CSE-109"
                      value={newResultForm.studentRegNo}
                      onChange={(e) =>
                        setNewResultForm({ ...newResultForm, studentRegNo: e.target.value })
                      }
                      className="w-full bg-[#111c38] border border-[#1c2b50] rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Student Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Priyanshu Sen"
                      value={newResultForm.studentName}
                      onChange={(e) =>
                        setNewResultForm({ ...newResultForm, studentName: e.target.value })
                      }
                      className="w-full bg-[#111c38] border border-[#1c2b50] rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Course</label>
                    <input
                      type="text"
                      required
                      value={newResultForm.course}
                      onChange={(e) =>
                        setNewResultForm({ ...newResultForm, course: e.target.value })
                      }
                      className="w-full bg-[#111c38] border border-[#1c2b50] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Subject</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Information Security"
                      value={newResultForm.subject}
                      onChange={(e) =>
                        setNewResultForm({ ...newResultForm, subject: e.target.value })
                      }
                      className="w-full bg-[#111c38] border border-[#1c2b50] rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Examination Name</label>
                  <input
                    type="text"
                    required
                    value={newResultForm.examName}
                    onChange={(e) =>
                      setNewResultForm({ ...newResultForm, examName: e.target.value })
                    }
                    className="w-full bg-[#111c38] border border-[#1c2b50] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Marks Obtained</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      min="0"
                      max={newResultForm.maxMarks}
                      placeholder="e.g. 87.5"
                      value={newResultForm.marksObtained}
                      onChange={(e) =>
                        setNewResultForm({ ...newResultForm, marksObtained: e.target.value })
                      }
                      className="w-full bg-[#111c38] border border-[#1c2b50] rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Maximum Marks</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={newResultForm.maxMarks}
                      onChange={(e) =>
                        setNewResultForm({ ...newResultForm, maxMarks: e.target.value })
                      }
                      className="w-full bg-[#111c38] border border-[#1c2b50] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <label className="flex items-center space-x-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newResultForm.publishImmediately}
                      onChange={(e) =>
                        setNewResultForm({
                          ...newResultForm,
                          publishImmediately: e.target.checked,
                        })
                      }
                      className="rounded bg-[#111c38] border-[#1c2b50] text-blue-600 focus:ring-0"
                    />
                    <span>Publish and seal immediately into append-only Merkle ledger</span>
                  </label>
                </div>

                <div className="pt-4 flex items-center justify-end space-x-3 border-t border-[#1c2b50]">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center space-x-1 disabled:opacity-50"
                  >
                    {submitting ? 'Generating Proof...' : 'Commit Record'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* QR Code Modal */}
        {isQrModalOpen && activeResult && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#0b132b] border border-[#1c2b50] rounded-xl max-w-sm w-full p-6 shadow-2xl relative text-center">
              <button
                onClick={() => setIsQrModalOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto mb-3">
                <QrCode className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">{activeResult.studentName}</h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">{activeResult.studentRegNo}</p>

              <div className="my-5 p-4 bg-white rounded-xl inline-block shadow-md">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="QR Code" className="w-48 h-48 mx-auto" />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center text-slate-500 text-xs">
                    Generating QR code...
                  </div>
                )}
              </div>

              <div className="bg-[#111c38] p-3 rounded-lg border border-[#1c2b50] text-left text-xs space-y-1 mb-4">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">
                  SHA-256 Record Hash
                </div>
                <div className="font-mono text-[11px] text-cyan-400 break-all">
                  {activeResult.recordHash}
                </div>
              </div>

              <Link
                href={`/verify/${activeResult.id}`}
                target="_blank"
                className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center space-x-2 transition-all shadow-md shadow-blue-600/20"
              >
                <span>Open Public Verification Page</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}

        {/* Request Correction Modal */}
        {isCorrectionModalOpen && activeResult && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#0b132b] border border-[#1c2b50] rounded-xl max-w-md w-full p-6 shadow-2xl relative">
              <div className="flex items-center justify-between pb-4 border-b border-[#1c2b50]">
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <Edit3 className="w-5 h-5 text-amber-400" />
                  <span>Request Mark Correction</span>
                </h3>
                <button
                  onClick={() => setIsCorrectionModalOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-3 p-3 rounded-lg bg-[#111c38] border border-[#1c2b50] text-xs space-y-1">
                <div className="text-slate-300">
                  <span className="text-slate-500 font-medium">Student:</span>{' '}
                  <span className="font-semibold text-white">{activeResult.studentName}</span> (
                  {activeResult.studentRegNo})
                </div>
                <div className="text-slate-300">
                  <span className="text-slate-500 font-medium">Subject:</span> {activeResult.subject}
                </div>
                <div className="text-slate-300">
                  <span className="text-slate-500 font-medium">Current Marks:</span>{' '}
                  <span className="font-bold text-cyan-400 font-mono">
                    {activeResult.marksObtained.toFixed(1)}
                  </span>
                </div>
              </div>

              {formError && (
                <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                  {formError}
                </div>
              )}

              {formSuccess && (
                <div className="mt-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{formSuccess}</span>
                </div>
              )}

              <form onSubmit={handleSubmitCorrection} className="mt-4 space-y-4 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Proposed Correct Marks</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    min="0"
                    max={activeResult.maxMarks}
                    value={correctionForm.proposedMarks}
                    onChange={(e) =>
                      setCorrectionForm({ ...correctionForm, proposedMarks: e.target.value })
                    }
                    className="w-full bg-[#111c38] border border-[#1c2b50] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">
                    Mandatory Justification / Reason
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Provide detailed administrative justification (e.g. Scrutiny committee re-evaluation found totaling discrepancy in Part B)..."
                    value={correctionForm.reason}
                    onChange={(e) =>
                      setCorrectionForm({ ...correctionForm, reason: e.target.value })
                    }
                    className="w-full bg-[#111c38] border border-[#1c2b50] rounded-lg p-3 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Requires 2 independent Ed25519 signatures (Exam Controller & Academic Dean).
                  </p>
                </div>

                <div className="pt-3 flex items-center justify-end space-x-3 border-t border-[#1c2b50]">
                  <button
                    type="button"
                    onClick={() => setIsCorrectionModalOpen(false)}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold flex items-center space-x-1 disabled:opacity-50"
                  >
                    {submitting ? 'Submitting...' : 'Register Request'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
