'use client';

import React from 'react';
import { StudentDiagnosticAlert } from '@/lib/types';
import { AlertTriangle, CheckCircle2, ShieldCheck, ArrowRight, SlidersVertical } from 'lucide-react';

interface Props {
  alerts: StudentDiagnosticAlert[];
  allClear: boolean;
  benchmark: number;
  message: string;
  onBenchmarkChange?: (newVal: number) => void;
}

export default function PerformanceDiagnosticAlertPanel({
  alerts,
  allClear,
  benchmark,
  message,
  onBenchmarkChange,
}: Props) {
  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm transition-all duration-300 ${
        allClear
          ? 'border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-[#0b192e] to-[#081426]'
          : 'border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-[#0b192e] to-[#081426]'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#1e3557]/80">
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
              allClear
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
            }`}
          >
            {allClear ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-white">Performance Diagnostic Alert Engine</h3>
              <span
                className={`rounded px-2 py-0.5 text-[10px] font-mono font-semibold uppercase border ${
                  allClear
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-400 border-amber-500/40'
                }`}
              >
                {allClear ? 'ALL CRITERIA SATISFIED' : `${alerts.length} DEFICIENCY ALERT(S)`}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Automated institutional course diagnostic against active academic benchmark ({benchmark}%)
            </p>
          </div>
        </div>

        {/* Benchmark selector */}
        {onBenchmarkChange && (
          <div className="flex items-center gap-2 rounded-xl bg-[#081426] border border-[#1e3557] px-3 py-1.5 text-xs shrink-0 self-end sm:self-auto">
            <SlidersVertical className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-slate-400">Diagnostic Benchmark:</span>
            <select
              value={benchmark}
              onChange={(e) => onBenchmarkChange(Number(e.target.value))}
              className="bg-transparent font-mono font-bold text-amber-400 focus:outline-none cursor-pointer"
            >
              <option value={35} className="bg-[#101F35] text-white">35% (Pass Line)</option>
              <option value={40} className="bg-[#101F35] text-white">40% (Statutory Cutoff)</option>
              <option value={50} className="bg-[#101F35] text-white">50% (Second Class)</option>
              <option value={75} className="bg-[#101F35] text-white">75% (Distinction Standard)</option>
              <option value={85} className="bg-[#101F35] text-white">85% (Dean's Honors)</option>
            </select>
          </div>
        )}
      </div>

      {/* Main Body */}
      <div className="mt-4">
        {allClear ? (
          <div className="rounded-xl border border-emerald-500/20 bg-[#081426]/60 p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              <p className="text-xs text-slate-300 leading-relaxed">
                {message}
              </p>
            </div>
            <span className="font-mono text-xs font-bold text-emerald-400 shrink-0">
              Zero Remediation Flags
            </span>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-slate-300 leading-relaxed">
              {message}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {alerts.map((alert) => (
                <div
                  key={alert.subject}
                  className="rounded-xl border border-amber-500/30 bg-[#101F35] p-3.5 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <span className="font-bold text-white block">{alert.subject}</span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      Current: <strong className="text-amber-400">{alert.percentage}%</strong> ({alert.marksObtained}/{alert.maxMarks})
                    </span>
                    <p className="text-[10px] text-amber-300/90">
                      Deficit: -{alert.deficit}% below {benchmark}% benchmark
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="px-2 py-1 rounded bg-amber-500/15 border border-amber-500/30 text-amber-400 font-mono font-bold text-[10px] block">
                      REMEDIATION
                    </span>
                    <span className="text-[10px] text-slate-500 mt-1 block">Advisory Flagged</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
