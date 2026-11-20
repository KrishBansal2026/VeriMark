'use client';

import React from 'react';
import { StudentTrendPoint } from '@/lib/types';
import { TrendingUp, Info } from 'lucide-react';

interface Props {
  trends: StudentTrendPoint[];
}

export default function ExamPerformanceTrendsChart({ trends }: Props) {
  if (!trends || trends.length === 0) {
    return (
      <div className="rounded-2xl border border-[#1e3557] bg-[#0b192e] p-6 text-center text-slate-400 text-xs">
        No examination trend records available.
      </div>
    );
  }

  const chartHeight = 160;
  const chartWidth = 540;
  const chartTop = 30;
  const chartBottom = chartTop + chartHeight;
  const chartLeft = 50;
  const chartRight = chartWidth - 30;
  const usableWidth = chartRight - chartLeft;

  const yTicks = [0, 25, 50, 75, 100];
  const isSingle = trends.length === 1;

  // Calculate coordinates for points
  const points = trends.map((t, idx) => {
    const x = isSingle
      ? chartLeft + usableWidth / 2
      : chartLeft + (idx / (trends.length - 1)) * usableWidth;
    const y = chartBottom - (t.percentage / 100) * chartHeight;
    return { ...t, x, y };
  });

  // Build SVG path
  let pathD = '';
  if (points.length > 1) {
    pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      pathD += ` L ${points[i].x} ${points[i].y}`;
    }
  }

  return (
    <div className="rounded-2xl border border-[#1e3557] bg-[#0b192e] p-5 space-y-4 shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1e3557]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3B82F6]/15 border border-[#3B82F6]/30 text-[#22D3EE]">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white">Examination Performance Trends</h3>
              <span className="rounded bg-blue-500/10 border border-blue-500/30 px-1.5 py-0.5 text-[9px] font-mono text-[#60A5FA]">
                LINE CHART
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Chronological academic achievement trajectory across examination cycles
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {isSingle ? 'Active Baseline' : `${trends.length} Sessions Tracked`}
          </span>
        </div>
      </div>

      {/* SVG Chart */}
      <div className="w-full overflow-x-auto">
        <div className="min-w-[480px]">
          <svg className="w-full h-64" viewBox={`0 0 ${chartWidth} 230`}>
            {/* Defs for gradients & filters */}
            <defs>
              <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3B82F6" />
                <stop offset="100%" stopColor="#22D3EE" />
              </linearGradient>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Horizontal Gridlines */}
            {yTicks.map((val) => {
              const y = chartBottom - (val / 100) * chartHeight;
              return (
                <g key={val}>
                  <line
                    x1={chartLeft}
                    y1={y}
                    x2={chartRight}
                    y2={y}
                    stroke="#1e3557"
                    strokeDasharray="3,3"
                    strokeWidth="1"
                  />
                  <text
                    x={chartLeft - 8}
                    y={y + 4}
                    fill="#64748b"
                    fontSize="10"
                    fontFamily="monospace"
                    textAnchor="end"
                  >
                    {val}%
                  </text>
                </g>
              );
            })}

            {/* Single exam baseline indicator line */}
            {isSingle && (
              <line
                x1={chartLeft}
                y1={points[0].y}
                x2={chartRight}
                y2={points[0].y}
                stroke="#22D3EE"
                strokeDasharray="4,4"
                strokeWidth="1"
                opacity="0.4"
              />
            )}

            {/* Trajectory Line (if multiple points) */}
            {pathD && (
              <path
                d={pathD}
                fill="none"
                stroke="url(#lineGrad)"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#glow)"
              />
            )}

            {/* Data Nodes */}
            {points.map((pt, idx) => (
              <g key={idx}>
                {/* Outer halo */}
                <circle cx={pt.x} cy={pt.y} r="8" fill="#22D3EE" opacity="0.25" />
                {/* Core node */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="5"
                  fill="#081426"
                  stroke="#22D3EE"
                  strokeWidth="2.5"
                  className="cursor-pointer hover:r-6 transition-all"
                />

                {/* Percentage Label */}
                <rect
                  x={pt.x - 24}
                  y={pt.y - 28}
                  width="48"
                  height="18"
                  rx="4"
                  fill="#101F35"
                  stroke="#22D3EE"
                  strokeWidth="1"
                />
                <text
                  x={pt.x}
                  y={pt.y - 15}
                  fill="#22D3EE"
                  fontSize="10"
                  fontWeight="bold"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  {pt.percentage}%
                </text>

                {/* Exam Name Label on X-Axis */}
                <text
                  x={pt.x}
                  y={chartBottom + 16}
                  fill="#cbd5e1"
                  fontSize="11"
                  fontWeight="500"
                  textAnchor="middle"
                >
                  {pt.examName.length > 25 ? `${pt.examName.slice(0, 22)}...` : pt.examName}
                </text>
                <text
                  x={pt.x}
                  y={chartBottom + 28}
                  fill="#64748b"
                  fontSize="9"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  {pt.publicationDate.split('T')[0]}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>

      {/* Honest Data Integrity Note */}
      {isSingle && (
        <div className="rounded-xl border border-dashed border-[#1e3557] bg-[#101F35]/50 p-3 flex items-start gap-2.5 text-xs text-slate-400">
          <Info className="h-4 w-4 text-[#22D3EE] shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong className="text-slate-200">Baseline Trajectory Established:</strong> 1 examination session recorded in the ledger ({trends[0].examName}). Longitudinal GPA trajectory and multi-session trending will automatically extend when subsequent semester examination results are committed.
          </p>
        </div>
      )}
    </div>
  );
}
