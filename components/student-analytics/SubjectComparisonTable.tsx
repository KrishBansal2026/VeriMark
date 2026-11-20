'use client';

import React from 'react';
import { StudentComparisonTableRow } from '@/lib/types';
import { GitCompare, ShieldCheck, ShieldAlert, Check, X } from 'lucide-react';

interface Props {
  rows: StudentComparisonTableRow[];
}

export default function SubjectComparisonTable({ rows }: Props) {
  if (!rows || rows.length === 0) {
    return (
      <div className="rounded-2xl border border-[#1e3557] bg-[#0b192e] p-6 text-center text-slate-400 text-xs">
        No examination comparison records found for this student.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#1e3557] bg-[#0b192e] overflow-hidden shadow-sm">
      {/* Table Header */}
      <div className="p-4 border-b border-[#1e3557] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3B82F6]/15 border border-[#3B82F6]/30 text-[#22D3EE]">
            <GitCompare className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white">Subject-by-Subject Examination Comparison Table</h3>
              <span className="rounded bg-blue-500/10 border border-blue-500/30 px-1.5 py-0.5 text-[9px] font-mono text-[#60A5FA]">
                STUDENT OWNERSHIP
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Personal assessment marks, letter grades, and cryptographic verification status
            </p>
          </div>
        </div>

        <span className="text-[10px] font-mono text-[#22D3EE] bg-[#22D3EE]/10 border border-[#22D3EE]/30 px-2.5 py-1 rounded-full self-start sm:self-auto">
          {rows.length} Record{rows.length === 1 ? '' : 's'} Live
        </span>
      </div>

      {/* Table View */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-[#1e3557] bg-[#101F35]/70 text-[11px] font-semibold text-slate-400">
              <th className="py-3 pl-4">Course Title / Subject</th>
              <th className="py-3">Examination Session</th>
              <th className="py-3 text-center">Mid-Term</th>
              <th className="py-3 text-center">End-Term</th>
              <th className="py-3 text-center">Total Score</th>
              <th className="py-3 text-center">Percentage</th>
              <th className="py-3 text-center">Computed Grade</th>
              <th className="py-3 text-center">Status</th>
              <th className="py-3 pr-4 text-right">Ledger Integrity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e3557]/60">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-[#101F35]/50 transition-colors">
                <td className="py-3 pl-4 font-semibold text-white">
                  {r.subject}
                </td>
                <td className="py-3 text-slate-300">
                  {r.examName}
                </td>
                <td className="py-3 text-center font-mono">
                  {r.midTermMarks !== null ? (
                    <span className="text-[#22D3EE] font-bold">{r.midTermMarks}</span>
                  ) : (
                    <span className="text-slate-500 font-mono text-[11px]">Not recorded</span>
                  )}
                </td>
                <td className="py-3 text-center font-mono">
                  {r.endTermMarks !== null ? (
                    <span className="text-[#60A5FA] font-bold">{r.endTermMarks}</span>
                  ) : (
                    <span className="text-slate-500 font-mono text-[11px]">Not recorded</span>
                  )}
                </td>
                <td className="py-3 text-center font-mono font-bold text-white">
                  {r.totalMarks} <span className="text-[10px] text-slate-400">/ {r.maxMarks}</span>
                </td>
                <td className="py-3 text-center font-mono font-bold text-[#22D3EE]">
                  {r.percentage.toFixed(2)}%
                </td>
                <td className="py-3 text-center">
                  <span className="px-2 py-0.5 rounded bg-blue-500/15 border border-blue-500/30 text-cyan-400 font-mono font-bold text-[10px]">
                    Grade {r.grade}
                  </span>
                </td>
                <td className="py-3 text-center">
                  {r.status === 'PASS' ? (
                    <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <Check className="h-3 w-3" /> PASS
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20">
                      <X className="h-3 w-3" /> FAIL
                    </span>
                  )}
                </td>
                <td className="py-3 pr-4 text-right">
                  {r.verificationStatus === 'VERIFIED' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      <ShieldCheck className="w-3 h-3" /> Leaf #{r.merkleIndex ?? 0}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold font-mono bg-rose-500/15 text-rose-400 border border-rose-500/30">
                      <ShieldAlert className="w-3 h-3" /> UNVERIFIED
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
