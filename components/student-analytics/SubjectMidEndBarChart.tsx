'use client';

import React from 'react';
import { StudentMidEndTermComparison } from '@/lib/types';
import { BarChart3, Info } from 'lucide-react';

interface Props {
  data: StudentMidEndTermComparison[];
}

export default function SubjectMidEndBarChart({ data }: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="rounded-2xl border border-[#1e3557] bg-[#0b192e] p-6 text-center text-slate-400 text-xs">
        No subject marks recorded for examination comparison.
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
  const barWidth = 32;
  const groupSpacing = usableWidth / data.length;

  const hasAnyMidTerm = data.some((d) => d.hasMidTerm);

  return (
    <div className="rounded-2xl border border-[#1e3557] bg-[#0b192e] p-5 space-y-4 shadow-sm">
      {/* Header & Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1e3557]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3B82F6]/15 border border-[#3B82F6]/30 text-[#22D3EE]">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white">Subject-Wise Mid-Term vs End-Term Comparison</h3>
              <span className="rounded bg-blue-500/10 border border-blue-500/30 px-1.5 py-0.5 text-[9px] font-mono text-[#60A5FA]">
                GROUPED BAR CHART
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Evaluative examination performance divergence across examination milestones
            </p>
          </div>
        </div>

        {/* Compact Legend */}
        <div className="flex items-center gap-3 text-[11px] font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#22D3EE] inline-block shadow-sm" />
            <span className="text-slate-300">Mid-Term</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#3B82F6] inline-block shadow-sm" />
            <span className="text-slate-300">End-Term</span>
          </div>
        </div>
      </div>

      {/* SVG Chart */}
      <div className="w-full overflow-x-auto">
        <div className="min-w-[480px]">
          <svg className="w-full h-64" viewBox={`0 0 ${chartWidth} 230`}>
            {/* Horizontal Gridlines & Y-Axis labels */}
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

            {/* Render Bars per Subject */}
            {data.map((item, idx) => {
              const groupCenterX = chartLeft + (idx + 0.5) * groupSpacing;
              const midX = groupCenterX - barWidth - 3;
              const endX = groupCenterX + 3;

              const midH = item.midTermMarks !== null ? (item.midTermMarks / item.maxMarks) * chartHeight : 0;
              const endH = item.endTermMarks !== null ? (item.endTermMarks / item.maxMarks) * chartHeight : 0;

              const midY = chartBottom - midH;
              const endY = chartBottom - endH;

              return (
                <g key={item.subject}>
                  {/* Mid-Term Bar */}
                  {item.hasMidTerm && item.midTermMarks !== null ? (
                    <g>
                      <rect
                        x={midX}
                        y={midY}
                        width={barWidth}
                        height={midH}
                        rx="4"
                        fill="#22D3EE"
                        className="transition-all hover:opacity-90 cursor-pointer"
                      />
                      <text
                        x={midX + barWidth / 2}
                        y={midY - 6}
                        fill="#22D3EE"
                        fontSize="10"
                        fontWeight="bold"
                        fontFamily="monospace"
                        textAnchor="middle"
                      >
                        {item.midTermMarks}
                      </text>
                    </g>
                  ) : (
                    <g>
                      <rect
                        x={midX}
                        y={chartBottom - 18}
                        width={barWidth}
                        height="18"
                        rx="4"
                        fill="#101F35"
                        stroke="#1e3557"
                        strokeDasharray="2,2"
                      />
                      <text
                        x={midX + barWidth / 2}
                        y={chartBottom - 6}
                        fill="#475569"
                        fontSize="9"
                        fontFamily="monospace"
                        textAnchor="middle"
                      >
                        N/A
                      </text>
                    </g>
                  )}

                  {/* End-Term Bar */}
                  {item.hasEndTerm && item.endTermMarks !== null ? (
                    <g>
                      <rect
                        x={endX}
                        y={endY}
                        width={barWidth}
                        height={endH}
                        rx="4"
                        fill="#3B82F6"
                        className="transition-all hover:opacity-90 cursor-pointer"
                      />
                      <text
                        x={endX + barWidth / 2}
                        y={endY - 6}
                        fill="#60A5FA"
                        fontSize="10"
                        fontWeight="bold"
                        fontFamily="monospace"
                        textAnchor="middle"
                      >
                        {item.endTermMarks}
                      </text>
                    </g>
                  ) : null}

                  {/* Subject Name on X-Axis */}
                  <text
                    x={groupCenterX}
                    y={chartBottom + 16}
                    fill="#cbd5e1"
                    fontSize="11"
                    fontWeight="500"
                    textAnchor="middle"
                  >
                    {item.subject.length > 22 ? `${item.subject.slice(0, 20)}...` : item.subject}
                  </text>
                  <text
                    x={groupCenterX}
                    y={chartBottom + 28}
                    fill="#64748b"
                    fontSize="9"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    (100 Max Scale)
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Honest Data Integrity State Notice if Mid-Term not recorded */}
      {!hasAnyMidTerm && (
        <div className="rounded-xl border border-dashed border-[#1e3557] bg-[#101F35]/50 p-3 flex items-start gap-2.5 text-xs text-slate-400">
          <Info className="h-4 w-4 text-[#22D3EE] shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong className="text-slate-200">Single Examination Cycle Active:</strong> Mid-Term Examination data has not yet been committed to the ledger for this academic cycle. Verified End-Term scores are plotted above. Longitudinal dual-bar comparison will automatically display upon publication of Mid-Term marks.
          </p>
        </div>
      )}
    </div>
  );
}
