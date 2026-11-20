'use client';

import React from 'react';
import { StudentSubjectAverage } from '@/lib/types';
import { Award, BookOpen } from 'lucide-react';

interface Props {
  data: StudentSubjectAverage[];
}

export default function CourseAverageMarksComparisonChart({ data }: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="rounded-2xl border border-[#1e3557] bg-[#0b192e] p-6 text-center text-slate-400 text-xs">
        No registered courses available for mark comparison.
      </div>
    );
  }

  const chartHeight = 160;
  const chartWidth = 540;
  const chartTop = 30;
  const chartBottom = chartTop + chartHeight;
  const chartLeft = 50;
  const chartRight = chartWidth - 20;
  const usableWidth = chartRight - chartLeft;

  const yTicks = [0, 25, 50, 75, 100];
  const barWidth = Math.min(48, Math.max(28, usableWidth / (data.length * 2)));
  const groupSpacing = usableWidth / data.length;

  return (
    <div className="rounded-2xl border border-[#1e3557] bg-[#0b192e] p-5 space-y-4 shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1e3557]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3B82F6]/15 border border-[#3B82F6]/30 text-[#22D3EE]">
            <BookOpen className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white">Course / Subject Marks Assessment</h3>
              <span className="rounded bg-blue-500/10 border border-blue-500/30 px-1.5 py-0.5 text-[9px] font-mono text-[#60A5FA]">
                COMPARISON BAR CHART
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Departmental score distribution relative to 100 maximum marks scale
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-mono">
          <span className="text-slate-400">Scale:</span>
          <span className="text-[#22D3EE] font-bold">100 Capacity Max</span>
        </div>
      </div>

      {/* SVG Chart */}
      <div className="w-full overflow-x-auto">
        <div className="min-w-[480px]">
          <svg className="w-full h-64" viewBox={`0 0 ${chartWidth} 230`}>
            <defs>
              <linearGradient id="barGradientPrimary" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#22D3EE" />
                <stop offset="100%" stopColor="#3B82F6" />
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

            {/* Bars */}
            {data.map((item, idx) => {
              const centerX = chartLeft + (idx + 0.5) * groupSpacing;
              const barX = centerX - barWidth / 2;
              const barH = (item.marksObtained / item.maxMarks) * chartHeight;
              const barY = chartBottom - barH;

              return (
                <g key={item.subject}>
                  <rect
                    x={barX}
                    y={barY}
                    width={barWidth}
                    height={barH}
                    rx="6"
                    fill="url(#barGradientPrimary)"
                    className="cursor-pointer hover:opacity-90 transition-opacity"
                  />
                  {/* Mark Value Label */}
                  <text
                    x={centerX}
                    y={barY - 7}
                    fill="#ffffff"
                    fontSize="11"
                    fontWeight="bold"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {item.marksObtained}
                  </text>

                  {/* Subject Name on X-Axis */}
                  <text
                    x={centerX}
                    y={chartBottom + 16}
                    fill="#cbd5e1"
                    fontSize="11"
                    fontWeight="500"
                    textAnchor="middle"
                  >
                    {item.subject.length > 22 ? `${item.subject.slice(0, 20)}...` : item.subject}
                  </text>
                  <text
                    x={centerX}
                    y={chartBottom + 28}
                    fill="#22D3EE"
                    fontSize="9"
                    fontFamily="monospace"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    Grade {item.grade} ({item.percentage}%)
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}
