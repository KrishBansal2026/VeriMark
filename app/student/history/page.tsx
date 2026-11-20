'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Link from 'next/link';
import {
  Clock,
  GraduationCap,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  ExternalLink,
  Layers,
} from 'lucide-react';
import { StudentResult } from '@/lib/types';
import StudentErrorState from '@/components/StudentErrorState';

export default function StudentSemesterHistoryPage() {
  const [results, setResults] = useState<StudentResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<{
    type: 'SESSION_EXPIRED' | 'ACCESS_DENIED' | 'SERVER_ERROR';
    message: string;
  } | null>(null);
  const [studentInfo, setStudentInfo] = useState<{ studentRegNo: string; studentName: string; course: string } | null>(null);

  const fetchHistory = async () => {
    setLoading(true);
    setErrorState(null);
    try {
      const res = await fetch('/api/student/results');
      if (res.status === 401) {
        const data = await res.json().catch(() => ({}));
        setErrorState({
          type: 'SESSION_EXPIRED',
          message: data.error || 'Your authenticated session has expired. Redirecting to login to preserve academic history confidentiality...',
        });
        return;
      }
      if (res.status === 403) {
        const data = await res.json().catch(() => ({}));
        setErrorState({
          type: 'ACCESS_DENIED',
          message: data.error || 'Access Denied: You do not have permission to view this semester history.',
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
          message: data.error || 'Failed to retrieve academic history.',
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
    fetchHistory();
  }, []);

  // Group results strictly by Examination Session
  const groupedByExam = results.reduce((acc, result) => {
    const key = result.examName || 'Standard Examinations';
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(result);
    return acc;
  }, {} as Record<string, StudentResult[]>);

  if (errorState) {
    return (
      <StudentErrorState
        type={errorState.type}
        message={errorState.message}
        onRetry={fetchHistory}
        currentPath="/student/history"
      />
    );
  }

  return (
    <>
      <Header
        title="Semester & Examination History"
        subtitle={`Chronological academic record for ${studentInfo?.studentName || 'Student'} (${studentInfo?.studentRegNo || ''})`}
      />

      <main className="p-4 sm:p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
        {/* Top Info Banner */}
        <div className="bg-[#111c38] border border-[#1c2b50] rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-white flex items-center space-x-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>Official Academic Record Timeline</span>
            </h2>
            <p className="text-xs text-slate-400">
              Historical marks records retrieved directly from verified immutable ledger entries.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-1 rounded text-xs font-mono font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {results.length} Published Subjects
            </span>
          </div>
        </div>

        {/* Examination Timeline */}
        {loading ? (
          <div className="p-12 text-center text-slate-400 bg-[#111c38] border border-[#1c2b50] rounded-xl flex flex-col items-center justify-center space-y-3">
            <div className="w-8 h-8 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin" />
            <p className="text-xs font-mono text-cyan-400/90">Loading semester examination history from ledger...</p>
          </div>
        ) : Object.keys(groupedByExam).length === 0 ? (
          <div className="p-12 text-center text-slate-400 bg-[#111c38] border border-[#1c2b50] rounded-xl space-y-2">
            <Clock className="w-8 h-8 text-slate-500 mx-auto" />
            <p className="text-sm font-semibold text-slate-300">No examination sessions recorded.</p>
            <p className="text-xs text-slate-500">Historical records will appear here as terms are finalized.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedByExam).map(([examName, examResults], idx) => {
              const totalMarks = examResults.reduce((s, r) => s + r.marksObtained, 0);
              const totalMax = examResults.reduce((s, r) => s + r.maxMarks, 0);
              const percentage = totalMax > 0 ? (totalMarks / totalMax) * 100 : 0;

              return (
                <div
                  key={idx}
                  className="bg-[#111c38] border border-[#1c2b50] rounded-2xl overflow-hidden shadow-sm"
                >
                  {/* Session Header */}
                  <div className="p-6 bg-[#0b132b]/80 border-b border-[#1c2b50] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-cyan-400" />
                        <h3 className="text-base font-bold text-white tracking-tight">{examName}</h3>
                      </div>
                      <p className="text-xs text-slate-400">
                        {studentInfo?.course || 'Degree Programme'} • Session Term 2026
                      </p>
                    </div>

                    <div className="flex items-center space-x-4 text-right">
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Session Total</div>
                        <div className="text-sm font-bold text-white font-mono">
                          {totalMarks} / {totalMax}
                        </div>
                      </div>
                      <div className="pl-4 border-l border-[#1c2b50]">
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Average</div>
                        <div className="text-sm font-bold text-emerald-400 font-mono">
                          {percentage.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Course Records Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#070d1e] text-slate-400 uppercase text-[10px] tracking-wider border-b border-[#1c2b50]">
                        <tr>
                          <th className="py-3 px-6 font-semibold">Subject / Course Module</th>
                          <th className="py-3 px-4 font-semibold">Marks Obtained</th>
                          <th className="py-3 px-4 font-semibold">Maximum</th>
                          <th className="py-3 px-4 font-semibold">Score</th>
                          <th className="py-3 px-4 font-semibold">Publication Date</th>
                          <th className="py-3 px-4 font-semibold text-right">Verification</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1c2b50]/60 font-mono">
                        {examResults.map((r) => (
                          <tr key={r.id} className="hover:bg-[#162244] transition-colors">
                            <td className="py-4 px-6 font-sans">
                              <div className="font-semibold text-slate-200">{r.subject}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{r.recordHash.substring(0, 20)}...</div>
                            </td>
                            <td className="py-4 px-4 text-white font-bold">{r.marksObtained}</td>
                            <td className="py-4 px-4 text-slate-400">{r.maxMarks}</td>
                            <td className="py-4 px-4 text-emerald-400 font-bold">
                              {((r.marksObtained / r.maxMarks) * 100).toFixed(1)}%
                            </td>
                            <td className="py-4 px-4 font-sans text-slate-300">
                              {new Date(r.publicationDate).toLocaleDateString()}
                            </td>
                            <td className="py-4 px-4 text-right">
                              <Link
                                href={`/verify/${r.id}`}
                                className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-blue-500/10 text-cyan-400 hover:text-cyan-300 text-[11px] font-sans font-semibold border border-blue-500/20"
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>Verify</span>
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
