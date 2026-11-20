'use client';

import React from 'react';
import { StudentPassFailDistribution } from '@/lib/types';
import { CheckCircle2, XCircle, PieChart } from 'lucide-react';

interface Props {
  data: StudentPassFailDistribution;
}

export default function PassFailDonutChart({ data }: Props) {
  const { passedCount, failedCount, passRate, failRate, benchmark } = data;
  const total = passedCount + failedCount;

  // Donut geometry
  const size = 180;
  const center = size / 2;
  const radius = 64;
  const strokeWidth = 24;
  const circumference = 2 * Math.PI * radius;

  // Compute stroke dash offsets
  const passFraction = total > 0 ? passedCount / total : 1;
  const passDash = passFraction * circumference;
  const failDash = (1 - passFraction) * circumference;

  return (
    <div className="rounded-2xl border border-[#1e3557] bg-[#0b192e] p-5 space-y-4 shadow-sm flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#1e3557]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3B82F6]/15 border border-[#3B82F6]/30 text-[#22D3EE]">
            <PieChart className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Pass / Fail Assessment Distribution</h3>
            <p className="text-[11px] text-slate-400">Statutory threshold ({benchmark}% minimum score to pass)</p>
          </div>
        </div>
        <span className="text-[10px] font-mono text-[#22D3EE] bg-[#22D3EE]/10 border border-[#22D3EE]/30 px-2 py-0.5 rounded-full">
          DONUT CHART
        </span>
      </div>

      {/* Donut Chart Visual */}
      <div className="flex flex-col sm:flex-row items-center justify-around gap-6 py-2">
        {/* SVG Donut */}
        <div className="relative flex items-center justify-center">
          <svg className="w-44 h-44 transform -rotate-90" viewBox={`0 0 ${size} ${size}`}>
            {/* Background ring */}
            <circle
              cx={center}
              cy={center}
              r={radius}
              stroke="#101F35"
              strokeWidth={strokeWidth}
              fill="transparent"
            />

            {/* Pass Slice (Green) */}
            {passedCount > 0 && (
              <circle
                cx={center}
                cy={center}
                r={radius}
                stroke="#10B981"
                strokeWidth={strokeWidth}
                strokeDasharray={`${passDash} ${circumference}`}
                strokeDashoffset={0}
                fill="transparent"
                className="transition-all duration-1000 ease-out"
              />
            )}

            {/* Fail Slice (Red) */}
            {failedCount > 0 && (
              <circle
                cx={center}
                cy={center}
                r={radius}
                stroke="#EF4444"
                strokeWidth={strokeWidth}
                strokeDasharray={`${failDash} ${circumference}`}
                strokeDashoffset={-passDash}
                fill="transparent"
                className="transition-all duration-1000 ease-out"
              />
            )}
          </svg>

          {/* Center Cutout Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none">
            <span className="text-2xl font-extrabold font-mono text-white tracking-tight">
              {passRate}%
            </span>
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-emerald-400 mt-0.5">
              PASSED
            </span>
          </div>
        </div>

        {/* Legend & Breakdown */}
        <div className="space-y-3 w-full sm:w-auto">
          {/* Pass Row */}
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 min-w-[160px] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <span className="text-xs font-semibold text-white block">Passed Courses</span>
                <span className="text-[10px] text-slate-400">Score &ge; {benchmark}%</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-base font-bold font-mono text-emerald-400 block">{passedCount}</span>
              <span className="text-[10px] font-mono text-slate-400">{passRate}%</span>
            </div>
          </div>

          {/* Fail / Remediation Row */}
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 min-w-[160px] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <div>
                <span className="text-xs font-semibold text-white block">Remediation / Fail</span>
                <span className="text-[10px] text-slate-400">Score &lt; {benchmark}%</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-base font-bold font-mono text-rose-400 block">{failedCount}</span>
              <span className="text-[10px] font-mono text-slate-400">{failRate}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="pt-3 border-t border-[#1e3557] flex items-center justify-between text-[11px] text-slate-400">
        <span>Evaluated from {total} authenticated student course assessment(s)</span>
        <span className="font-mono text-emerald-400 font-semibold">100% Backlog Free</span>
      </div>
    </div>
  );
}
