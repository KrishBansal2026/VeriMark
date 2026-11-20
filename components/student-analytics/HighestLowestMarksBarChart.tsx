'use client';

import React from 'react';
import { StudentExtremes } from '@/lib/types';
import { Award, ArrowUpDown, Info } from 'lucide-react';

interface Props {
  extremes: StudentExtremes;
}

export default function HighestLowestMarksBarChart({ extremes }: Props) {
  const { highest, lowest, variance, isSingleSubject } = extremes;

  if (!highest || !lowest) {
    return (
      <div className="rounded-2xl border border-[#1e3557] bg-[#0b192e] p-6 text-center text-slate-400 text-xs">
        No score extreme data available.
      </div>
    );
  }

  const chartHeight = 150;
  const chartWidth = 380;
  const chartTop = 30;
  const chartBottom = chartTop + chartHeight;
  const chartLeft = 50;
  const chartRight = chartWidth - 20;

  const yTicks = [0, 25, 50, 75, 100];
  const barWidth = 44;

  const highH = (highest.marksObtained / highest.maxMarks) * chartHeight;
  const lowH = (lowest.marksObtained / lowest.maxMarks) * chartHeight;

  const highY = chartBottom - highH;
  const lowY = chartBottom - lowH;

  const highX = chartLeft + 60;
  const lowX = chartRight - 60 - barWidth;

  return (
    <div className="rounded-2xl border border-[#1e3557] bg-[#0b192e] p-5 space-y-4 shadow-sm flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#1e3557]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3B82F6]/15 border border-[#3B82F6]/30 text-[#22D3EE]">
            <Award className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Highest vs Lowest Marks</h3>
            <p className="text-[11px] text-slate-400">Score boundaries and variance across student courses</p>
          </div>
        </div>
        <span className="text-[10px] font-mono text-[#22D3EE] bg-[#22D3EE]/10 border border-[#22D3EE]/30 px-2 py-0.5 rounded-full">
          GROUPED BAR
        </span>
      </div>

      {/* SVG Chart */}
      <div className="w-full flex justify-center py-1">
        <svg className="w-full max-w-[420px] h-60" viewBox={`0 0 ${chartWidth} 220`}>
          <defs>
            <linearGradient id="highBarGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
            <linearGradient id="lowBarGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#D97706" />
            </linearGradient>
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
                  {val}
                </text>
              </g>
            );
          })}

          {/* Highest Bar */}
          <g>
            <rect
              x={highX}
              y={highY}
              width={barWidth}
              height={highH}
              rx="6"
              fill="url(#highBarGrad)"
              className="cursor-pointer hover:opacity-90 transition-opacity"
            />
            <text
              x={highX + barWidth / 2}
              y={highY - 6}
              fill="#10B981"
              fontSize="11"
              fontWeight="bold"
              fontFamily="monospace"
              textAnchor="middle"
            >
              {highest.marksObtained}
            </text>
            <text
              x={highX + barWidth / 2}
              y={chartBottom + 16}
              fill="#10B981"
              fontSize="11"
              fontWeight="bold"
              textAnchor="middle"
            >
              Highest
            </text>
            <text
              x={highX + barWidth / 2}
              y={chartBottom + 28}
              fill="#64748b"
              fontSize="9"
              fontFamily="monospace"
              textAnchor="middle"
            >
              {highest.percentage}%
            </text>
          </g>

          {/* Lowest Bar */}
          <g>
            <rect
              x={lowX}
              y={lowY}
              width={barWidth}
              height={lowH}
              rx="6"
              fill="url(#lowBarGrad)"
              className="cursor-pointer hover:opacity-90 transition-opacity"
            />
            <text
              x={lowX + barWidth / 2}
              y={lowY - 6}
              fill="#F59E0B"
              fontSize="11"
              fontWeight="bold"
              fontFamily="monospace"
              textAnchor="middle"
            >
              {lowest.marksObtained}
            </text>
            <text
              x={lowX + barWidth / 2}
              y={chartBottom + 16}
              fill="#F59E0B"
              fontSize="11"
              fontWeight="bold"
              textAnchor="middle"
            >
              Lowest
            </text>
            <text
              x={lowX + barWidth / 2}
              y={chartBottom + 28}
              fill="#64748b"
              fontSize="9"
              fontFamily="monospace"
              textAnchor="middle"
            >
              {lowest.percentage}%
            </text>
          </g>
        </svg>
      </div>

      {/* Details Box */}
      {isSingleSubject ? (
        <div className="rounded-xl border border-dashed border-[#1e3557] bg-[#101F35]/50 p-2.5 flex items-start gap-2 text-xs text-slate-400">
          <Info className="h-4 w-4 text-[#22D3EE] shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong className="text-slate-200">Single Course Scope:</strong> 1 course assessment is recorded for this student ({highest.subject}). Peak and floor benchmarks are both set at {highest.marksObtained} marks (0 variance).
          </p>
        </div>
      ) : (
        <div className="pt-3 border-t border-[#1e3557] flex items-center justify-between text-xs font-mono">
          <span className="text-slate-400">Score Variance:</span>
          <span className="text-[#22D3EE] font-bold">&plusmn;{variance} marks spread</span>
        </div>
      )}
    </div>
  );
}
