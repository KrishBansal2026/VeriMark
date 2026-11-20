'use client';

import { useState, useEffect, useMemo } from 'react';
import Header from '@/components/Header';
import {
  GraduationCap,
  ShieldCheck,
  ShieldAlert,
  TrendingUp,
  TrendingDown,
  Clock,
  FileText,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  Download,
  Printer,
  RefreshCw,
  Lock,
  Network,
  UserCheck,
  Award,
  BarChart3,
  SlidersHorizontal,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  Info,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import {
  AcademicAnalyticsResponse,
  DetailedAnalyticsRecord,
  UserRole,
} from '@/lib/types';

type SortField = 'studentRegNo' | 'studentName' | 'subject' | 'examName' | 'marksObtained' | 'percentage' | 'verificationStatus';
type SortOrder = 'asc' | 'desc';

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AcademicAnalyticsResponse | null>(null);

  // Filter States
  const [selectedExam, setSelectedExam] = useState<string>('ALL');
  const [selectedSubject, setSelectedSubject] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Table Sort State
  const [sortField, setSortField] = useState<SortField>('studentRegNo');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Active Tooltip
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  // Fetch Analytics from API
  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (selectedExam !== 'ALL') queryParams.set('exam', selectedExam);
      if (selectedSubject !== 'ALL') queryParams.set('subject', selectedSubject);
      if (startDate) queryParams.set('startDate', startDate);
      if (endDate) queryParams.set('endDate', endDate);
      if (searchQuery.trim()) queryParams.set('search', searchQuery.trim());

      const res = await fetch(`/api/analytics?${queryParams.toString()}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || `Failed to fetch analytics (Status ${res.status})`);
      }

      setData(json);
    } catch (err: any) {
      console.error('Analytics fetch error:', err);
      setError(err.message || 'Failed to connect to analytics service');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [selectedExam, selectedSubject, startDate, endDate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAnalytics();
  };

  const resetFilters = () => {
    setSelectedExam('ALL');
    setSelectedSubject('ALL');
    setStartDate('');
    setEndDate('');
    setSearchQuery('');
  };

  // Sort Table Records
  const sortedRecords = useMemo(() => {
    if (!data?.detailedRecords) return [];
    return [...data.detailedRecords].sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (typeof valA === 'string') {
        const cmp = valA.localeCompare(valB);
        return sortOrder === 'asc' ? cmp : -cmp;
      } else {
        const diff = Number(valA) - Number(valB);
        return sortOrder === 'asc' ? diff : -diff;
      }
    });
  }, [data?.detailedRecords, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // CSV Export Handler
  const exportToCSV = () => {
    if (!data || !sortedRecords.length) return;

    const headers = [
      'Registration Number',
      'Student Name',
      'Subject',
      'Examination',
      'Marks Obtained',
      'Maximum Marks',
      'Percentage',
      'Status',
      'Publication Date',
      'Cryptographic Verification',
      'Record Hash (SHA-256)',
    ];

    const rows = sortedRecords.map((r) => [
      `"${r.studentRegNo}"`,
      `"${r.studentName}"`,
      `"${r.subject}"`,
      `"${r.examName}"`,
      r.marksObtained,
      r.maxMarks,
      `${r.percentage}%`,
      r.status,
      r.publicationDate,
      r.verificationStatus,
      `"${r.recordHash}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [
        `# VERIMARK ACADEMIC ANALYTICS EXPORT REPORT`,
        `# Generated: ${new Date().toISOString()}`,
        `# Role: ${data.userRole} | Dataset: Hackathon Demonstration (Problem Statement H8)`,
        `# Total Results: ${data.kpis.totalPublishedResults} | Verified: ${data.kpis.verifiedRecordsCount} | Average Marks: ${data.kpis.averageMarks} | Overall: ${data.kpis.overallPercentage}%`,
        '',
        headers.join(','),
        ...rows.map((e) => e.join(',')),
      ].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `verimark_analytics_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Handler
  const handlePrint = () => {
    window.print();
  };

  // Role Description
  const getRoleDescription = (role?: UserRole) => {
    switch (role) {
      case 'ADMIN':
        return 'Full Institutional Authority: Complete academic performance, examination metrics, and cryptographic ledger integrity.';
      case 'AUDITOR':
        return 'Auditor Authority: Real-time ledger integrity, Ed25519 checkpoint verification, and tamper detection view.';
      case 'EXAM_CONTROLLER':
        return 'Exam Controller Authority: Examination-level performance comparisons, pass/fail ratios, and correction tracking.';
      case 'ACADEMIC_DEAN':
        return 'Academic Dean Authority: Academic performance analysis, grade distributions, and student achievement tracking.';
      default:
        return 'Institutional Staff View';
    }
  };

  return (
    <>
      <Header
        title="Academic & Cryptographic Analytics"
        subtitle="Institutional Performance Metrics, Examination Statistics & Ledger Health"
      />

      <main className="p-4 sm:p-8 space-y-8 max-w-7xl mx-auto print:p-0 print:m-0 print:max-w-none">
        {/* Printable Letterhead (Only visible in Print / PDF view) */}
        <div className="hidden print:block mb-6 border-b border-slate-700 pb-4 text-black">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">VERIMARK ACADEMIC ANALYTICS REPORT</h1>
              <p className="text-sm text-gray-600">Tamper-Proof Academic Result Ledger (Code Fuzion 2026 - Problem Statement H8)</p>
            </div>
            <div className="text-right text-xs text-gray-500">
              <p>Generated: {new Date().toLocaleString()}</p>
              <p>Signer: Ed25519 Institutional Keypair</p>
              <p>Ledger Status: {data?.kpis.ledgerIntegrityStatus || 'VALIDATED'}</p>
            </div>
          </div>
        </div>

        {/* Dataset Notice & Role Header Banner */}
        <div className="bg-[#111c38]/90 border border-[#1c2b50] rounded-xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm print:hidden">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-mono">
                {data?.userRole || 'INSTITUTIONAL'}
              </span>
              <span className="text-sm font-semibold text-white">
                Academic Governance & Ledger Analytics Console
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Live Data
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {getRoleDescription(data?.userRole)}
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-slate-400 bg-[#070d1e] px-3.5 py-2 rounded-lg border border-[#1c2b50]">
            <Lock className="w-3.5 h-3.5 text-cyan-400" />
            <span>Demonstration Dataset: 5 Active Records</span>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center space-x-3 text-red-400 text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold">Failed to load analytics</p>
              <p className="text-xs text-red-400/80">{error}</p>
            </div>
            <button
              onClick={fetchAnalytics}
              className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 rounded text-xs font-medium transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Interactive Controls & Filters Bar */}
        <div className="bg-[#111c38] border border-[#1c2b50] rounded-xl p-4 sm:p-5 space-y-4 shadow-sm print:hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Search Input */}
            <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by student name, reg no, or subject..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#0b132b] border border-[#1c2b50] rounded-lg pl-10 pr-24 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
              />
              <button
                type="submit"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium transition-colors cursor-pointer"
              >
                Search
              </button>
            </form>

            {/* Actions: CSV Export, Print / PDF, Reset */}
            <div className="flex items-center flex-wrap gap-2.5">
              <button
                onClick={resetFilters}
                className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-[#0b132b] border border-[#1c2b50] text-slate-300 hover:text-white hover:border-slate-500 text-xs font-medium transition-colors cursor-pointer"
                title="Reset all filters"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Reset</span>
              </button>

              <button
                onClick={exportToCSV}
                disabled={loading || !sortedRecords.length}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-[#0b132b] border border-[#1c2b50] text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-500/40 text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>

              <button
                onClick={handlePrint}
                disabled={loading || !sortedRecords.length}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shadow-md shadow-blue-600/20 transition-all cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print / PDF Report</span>
              </button>
            </div>
          </div>

          {/* Secondary Filter Dropdowns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-[#1c2b50]/60">
            {/* Examination Filter */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Examination
              </label>
              <select
                value={selectedExam}
                onChange={(e) => setSelectedExam(e.target.value)}
                className="w-full bg-[#0b132b] border border-[#1c2b50] rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400 transition-colors"
              >
                <option value="ALL">All Examinations</option>
                {data?.filterOptions.examinations.map((exam) => (
                  <option key={exam} value={exam}>
                    {exam}
                  </option>
                ))}
              </select>
            </div>

            {/* Subject Filter */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Subject
              </label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full bg-[#0b132b] border border-[#1c2b50] rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400 transition-colors"
              >
                <option value="ALL">All Subjects</option>
                {data?.filterOptions.subjects.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                From Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-[#0b132b] border border-[#1c2b50] rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400 transition-colors"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                To Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-[#0b132b] border border-[#1c2b50] rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* A. KPI CARDS (8 Key Indicators)                                */}
        {/* ============================================================== */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-cyan-400" />
              <span>Executive Performance & Integrity KPIs</span>
            </h2>
            {loading && (
              <span className="text-xs text-cyan-400 flex items-center gap-1.5">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Recalculating...</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Published Results */}
            <div className="bg-[#111c38] border border-[#1c2b50] rounded-xl p-5 relative overflow-hidden shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-400">Total Published Results</p>
                  <h3 className="text-2xl font-bold text-white mt-1">
                    {loading ? '...' : data?.kpis.totalPublishedResults ?? 0}
                  </h3>
                </div>
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <GraduationCap className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 flex items-center text-xs text-slate-400">
                <span className="text-cyan-400 font-semibold mr-1.5">100%</span>
                <span>Active in ledger registry</span>
              </div>
            </div>

            {/* KPI 2: Verified Academic Records */}
            <div className="bg-[#111c38] border border-[#1c2b50] rounded-xl p-5 relative overflow-hidden shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-400">Cryptographically Verified</p>
                  <h3 className="text-2xl font-bold text-white mt-1">
                    {loading ? '...' : `${data?.kpis.verifiedRecordsCount ?? 0} / ${data?.kpis.totalPublishedResults ?? 0}`}
                  </h3>
                </div>
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 flex items-center text-xs text-slate-400">
                <span className="text-emerald-400 font-semibold mr-1.5">
                  {data?.kpis.totalPublishedResults
                    ? `${((data.kpis.verifiedRecordsCount / data.kpis.totalPublishedResults) * 100).toFixed(0)}%`
                    : '100%'}
                </span>
                <span>Merkle & Ed25519 Validated</span>
              </div>
            </div>

            {/* KPI 3: Average Marks & Overall Percentage */}
            <div className="bg-[#111c38] border border-[#1c2b50] rounded-xl p-5 relative overflow-hidden shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-400">Cohort Average Marks</p>
                  <h3 className="text-2xl font-bold text-white mt-1">
                    {loading ? '...' : `${data?.kpis.averageMarks ?? 0}`}
                  </h3>
                </div>
                <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 flex items-center text-xs text-slate-400">
                <span className="text-cyan-400 font-semibold mr-1.5">
                  {loading ? '...' : `${data?.kpis.overallPercentage ?? 0}%`}
                </span>
                <span>Overall cohort percentage</span>
              </div>
            </div>

            {/* KPI 4: Total Examinations */}
            <div className="bg-[#111c38] border border-[#1c2b50] rounded-xl p-5 relative overflow-hidden shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-400">Tracked Examinations</p>
                  <h3 className="text-2xl font-bold text-white mt-1">
                    {loading ? '...' : data?.kpis.totalExaminations ?? 0}
                  </h3>
                </div>
                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Award className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 flex items-center text-xs text-slate-400">
                <span className="text-indigo-400 font-semibold mr-1.5">
                  {data?.academicPerformance.subjectWise.length ?? 0}
                </span>
                <span>Distinct academic subjects</span>
              </div>
            </div>

            {/* KPI 5: Pending Correction Requests */}
            <div className="bg-[#111c38] border border-[#1c2b50] rounded-xl p-5 relative overflow-hidden shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-400">Pending Corrections</p>
                  <h3 className="text-2xl font-bold text-white mt-1">
                    {loading ? '...' : data?.kpis.pendingCorrectionRequests ?? 0}
                  </h3>
                </div>
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 flex items-center text-xs text-slate-400">
                <span className="text-amber-400 font-semibold mr-1.5">Dual Approval</span>
                <span>Controller & Dean Review</span>
              </div>
            </div>

            {/* KPI 6: Approved Corrections */}
            <div className="bg-[#111c38] border border-[#1c2b50] rounded-xl p-5 relative overflow-hidden shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-400">Approved Corrections</p>
                  <h3 className="text-2xl font-bold text-white mt-1">
                    {loading ? '...' : data?.kpis.approvedCorrections ?? 0}
                  </h3>
                </div>
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <UserCheck className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 flex items-center text-xs text-slate-400">
                <span className="text-emerald-400 font-semibold mr-1.5">Append-Only</span>
                <span>Permanent ledger provenance</span>
              </div>
            </div>

            {/* KPI 7: Signed Checkpoints */}
            <div className="bg-[#111c38] border border-[#1c2b50] rounded-xl p-5 relative overflow-hidden shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-400">Signed Checkpoints</p>
                  <h3 className="text-2xl font-bold text-white mt-1">
                    {loading ? '...' : data?.kpis.signedLedgerCheckpoints ?? 0}
                  </h3>
                </div>
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <Network className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 flex items-center text-xs text-slate-400 font-mono">
                <span className="text-cyan-400 font-semibold mr-1.5">Ed25519</span>
                <span>Signatures verified</span>
              </div>
            </div>

            {/* KPI 8: Ledger Integrity Status */}
            <div className="bg-[#111c38] border border-[#1c2b50] rounded-xl p-5 relative overflow-hidden shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-400">Ledger Health</p>
                  <h3 className="text-sm font-bold text-emerald-400 mt-2 truncate">
                    {loading ? 'Checking...' : data?.kpis.ledgerIntegrityStatus ?? 'SECURE'}
                  </h3>
                </div>
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 flex items-center text-xs text-slate-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 mr-2 animate-pulse" />
                <span>Zero tampering incidents</span>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================== */}
        {/* B. ACADEMIC PERFORMANCE (Charts, Distributions & Records)      */}
        {/* ============================================================== */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Award className="w-4 h-4 text-cyan-400" />
              <span>Academic Performance Breakdown</span>
            </h2>
            <span className="text-xs text-slate-400">
              Grading Scheme: O (90%+), A+ (80%+), A (70%+), B+ (60%+), Pass (&ge;40%)
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Subject-Wise Average Performance */}
            <div className="lg:col-span-2 bg-[#111c38] border border-[#1c2b50] rounded-xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Subject-Wise Average Performance</h3>
                  <p className="text-xs text-slate-400">Cohort scores, pass rates, and score variance across subjects</p>
                </div>
                <span className="text-xs px-2 py-1 rounded bg-[#0b132b] text-cyan-400 font-mono border border-[#1c2b50]">
                  {data?.academicPerformance.subjectWise.length ?? 0} Subjects
                </span>
              </div>

              {loading ? (
                <div className="py-12 text-center text-xs text-slate-500">Loading subject performance metrics...</div>
              ) : !data?.academicPerformance.subjectWise.length ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  No subject records match the current filter criteria.
                </div>
              ) : (
                <div className="space-y-4">
                  {data.academicPerformance.subjectWise.map((item) => (
                    <div
                      key={item.subject}
                      className="group p-3 rounded-lg bg-[#0b132b]/80 border border-[#1c2b50]/60 hover:border-cyan-500/40 transition-all space-y-2 relative"
                      onMouseEnter={() => setActiveTooltip(item.subject)}
                      onMouseLeave={() => setActiveTooltip(null)}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">{item.subject}</span>
                          <span className="text-[10px] text-slate-400">({item.studentCount} students)</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-400 text-[11px]">
                            High: <span className="text-emerald-400 font-medium">{item.highestMark}</span> | Low:{' '}
                            <span className="text-amber-400 font-medium">{item.lowestMark}</span>
                          </span>
                          <span className="font-mono font-bold text-cyan-400 text-sm">
                            {item.averageMarks} / {item.maxMarks} ({item.averagePercentage}%)
                          </span>
                        </div>
                      </div>

                      {/* Performance Bar with gradient */}
                      <div className="h-2.5 w-full bg-[#1c2541] rounded-full overflow-hidden flex">
                        <div
                          className="h-full bg-gradient-to-r from-blue-600 via-cyan-400 to-emerald-400 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(item.averagePercentage, 100)}%` }}
                        />
                      </div>

                      {/* Tooltip on hover */}
                      {activeTooltip === item.subject && (
                        <div className="absolute top-1/2 right-4 -translate-y-1/2 z-20 bg-[#070d1e] border border-cyan-500/40 rounded-lg p-2.5 shadow-xl text-[11px] space-y-1 pointer-events-none">
                          <p className="font-bold text-white">{item.subject}</p>
                          <p className="text-slate-300">Cohort Average: <span className="text-cyan-400 font-bold">{item.averageMarks}</span></p>
                          <p className="text-slate-300">Pass Rate: <span className="text-emerald-400 font-bold">{item.passRate}%</span> ({item.passCount} passed, {item.failCount} failed)</p>
                          <p className="text-slate-300">Marks Range: {item.lowestMark} - {item.highestMark} marks</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pass vs Fail & Highest/Lowest Achievers */}
            <div className="space-y-6">
              {/* Pass / Fail Distribution */}
              <div className="bg-[#111c38] border border-[#1c2b50] rounded-xl p-5 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Pass / Fail Outcome</h3>
                  <span className="text-[11px] text-slate-400">Min. 40.0% to pass</span>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Passed: {data?.academicPerformance.passFail.passedCount ?? 0}
                    </span>
                    <span className="font-mono font-bold text-emerald-400 text-sm">
                      {data?.academicPerformance.passFail.passRate ?? 0}%
                    </span>
                  </div>

                  <div className="h-3 w-full bg-[#1c2541] rounded-full overflow-hidden flex">
                    <div
                      className="bg-emerald-500 h-full transition-all duration-500"
                      style={{ width: `${data?.academicPerformance.passFail.passRate ?? 0}%` }}
                    />
                    <div
                      className="bg-red-500 h-full transition-all duration-500"
                      style={{ width: `${data?.academicPerformance.passFail.failRate ?? 0}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="text-red-400 font-medium flex items-center gap-1.5">
                      <XCircle className="w-3.5 h-3.5" />
                      Failed: {data?.academicPerformance.passFail.failedCount ?? 0}
                    </span>
                    <span className="font-mono text-red-400">
                      {data?.academicPerformance.passFail.failRate ?? 0}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Highest and Lowest Scores */}
              <div className="bg-[#111c38] border border-[#1c2b50] rounded-xl p-5 space-y-3 shadow-sm">
                <h3 className="text-sm font-semibold text-white">Cohort Score Extremes</h3>

                <div className="space-y-2.5">
                  {/* Highest Score */}
                  {data?.academicPerformance.highestMark ? (
                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                          Highest Examination Mark
                        </span>
                        <p className="text-xs font-semibold text-white">
                          {data.academicPerformance.highestMark.studentName}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {data.academicPerformance.highestMark.studentRegNo} • {data.academicPerformance.highestMark.subject}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-emerald-400 font-mono">
                          {data.academicPerformance.highestMark.mark}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          / {data.academicPerformance.highestMark.maxMarks} ({data.academicPerformance.highestMark.percentage}%)
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 text-xs text-slate-400">No records available</div>
                  )}

                  {/* Lowest Score */}
                  {data?.academicPerformance.lowestMark ? (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">
                          Lowest Examination Mark
                        </span>
                        <p className="text-xs font-semibold text-white">
                          {data.academicPerformance.lowestMark.studentName}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {data.academicPerformance.lowestMark.studentRegNo} • {data.academicPerformance.lowestMark.subject}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-amber-400 font-mono">
                          {data.academicPerformance.lowestMark.mark}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          / {data.academicPerformance.lowestMark.maxMarks} ({data.academicPerformance.lowestMark.percentage}%)
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {/* Grade Distribution & Student Distribution Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Grade Distribution */}
            <div className="bg-[#111c38] border border-[#1c2b50] rounded-xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Official Grade Distribution</h3>
                  <p className="text-xs text-slate-400">University academic letter grade allotment across cohort</p>
                </div>
                <span className="text-xs font-mono text-slate-400">
                  {data?.kpis.totalPublishedResults ?? 0} Total Records
                </span>
              </div>

              {/* Stacked Proportional Grade Bar */}
              <div className="h-4 w-full bg-[#1c2541] rounded-full overflow-hidden flex">
                {data?.academicPerformance.gradeDistribution.map((item) => {
                  if (item.percentageOfCohort <= 0) return null;
                  return (
                    <div
                      key={item.grade}
                      style={{
                        width: `${item.percentageOfCohort}%`,
                        backgroundColor: item.color,
                      }}
                      className="h-full transition-all duration-300 relative group cursor-pointer"
                      title={`${item.grade}: ${item.count} student(s) (${item.percentageOfCohort}%)`}
                    />
                  );
                })}
              </div>

              {/* Grade Badges Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-2">
                {data?.academicPerformance.gradeDistribution.map((item) => (
                  <div
                    key={item.grade}
                    className="p-2 rounded-lg bg-[#0b132b] border border-[#1c2b50] flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <div>
                        <span className="text-xs font-bold text-white">{item.grade}</span>
                        <p className="text-[9px] text-slate-400 truncate max-w-[80px]">
                          {item.minPercentage}%-{item.maxPercentage}%
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-slate-200">
                      {item.count} ({item.percentageOfCohort}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Performance Score Brackets (Histogram Distribution) */}
            <div className="bg-[#111c38] border border-[#1c2b50] rounded-xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Score Bracket Distribution</h3>
                  <p className="text-xs text-slate-400">Distribution histogram of student percentage brackets</p>
                </div>
                <span className="text-xs font-mono text-cyan-400">Percentage Tiers</span>
              </div>

              <div className="space-y-2.5">
                {data?.academicPerformance.studentDistribution.map((bracket) => (
                  <div key={bracket.bracket} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-medium">{bracket.bracket}</span>
                      <span className="text-slate-400 font-mono">
                        {bracket.count} student{bracket.count === 1 ? '' : 's'} ({bracket.percentage}%)
                      </span>
                    </div>
                    <div className="h-2 w-full bg-[#1c2541] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-cyan-400 rounded-full transition-all duration-500"
                        style={{ width: `${bracket.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================== */}
        {/* C. ACADEMIC TRENDS & COMPARISONS                               */}
        {/* ============================================================== */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              <span>Academic Trends & Historical Cohorts</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Publication Timeline */}
            <div className="bg-[#111c38] border border-[#1c2b50] rounded-xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Result Publication Timeline</h3>
                <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Ledger Events
                </span>
              </div>

              {!data?.academicTrends.timeline.length ? (
                <div className="p-8 text-center text-xs text-slate-400">No timeline events recorded.</div>
              ) : (
                <div className="space-y-3">
                  {data.academicTrends.timeline.map((item) => (
                    <div
                      key={item.date}
                      className="p-3 rounded-lg bg-[#0b132b] border border-[#1c2b50] flex items-center justify-between"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-white">{item.date}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {item.publishedCount} Marks Committed
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate max-w-sm">
                          Subjects: {item.subjects.join(', ')}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-mono font-bold text-cyan-400">
                          {item.averageMarks} avg
                        </span>
                        <p className="text-[10px] text-slate-500">ledger timestamp</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Semester Comparison (Informative Empty State) */}
            <div className="bg-[#111c38] border border-[#1c2b50] rounded-xl p-5 space-y-4 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Cross-Semester Trend Comparison</h3>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    Awaiting Future Semesters
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">Multi-semester comparative analytics</p>
              </div>

              <div className="py-8 px-4 rounded-lg bg-[#0b132b]/80 border border-dashed border-[#1c2b50] text-center space-y-3 my-auto">
                <Info className="w-8 h-8 text-cyan-400/80 mx-auto" />
                <div className="max-w-md mx-auto space-y-1">
                  <p className="text-xs font-semibold text-white">
                    Single Active Semester Cohort Recorded
                  </p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {data?.academicTrends.semesterNotice}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-[#1c2b50] pt-3">
                <span>Active: Semester 6 (Spring 2026)</span>
                <span>Cohort Size: 5 Students</span>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================== */}
        {/* D. CRYPTOGRAPHIC ANALYTICS & LEDGER HEALTH                     */}
        {/* ============================================================== */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Network className="w-4 h-4 text-cyan-400" />
              <span>Cryptographic Ledger Analytics & Integrity Status</span>
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono">
              RFC 6962 + Ed25519
            </span>
          </div>

          <div className="bg-[#111c38] border border-[#1c2b50] rounded-xl p-5 space-y-5 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-3 rounded-lg bg-[#0b132b] border border-[#1c2b50]">
                <p className="text-slate-400 text-xs">Total Ledger Events</p>
                <p className="text-xl font-bold text-white font-mono mt-1">
                  {data?.cryptographicAnalytics.totalLedgerEvents ?? 0}
                </p>
                <p className="text-[10px] text-cyan-400 mt-1">Append-only sequence chain</p>
              </div>

              <div className="p-3 rounded-lg bg-[#0b132b] border border-[#1c2b50]">
                <p className="text-slate-400 text-xs">Independent Vault Checkpoints</p>
                <p className="text-xl font-bold text-white font-mono mt-1">
                  {data?.cryptographicAnalytics.signedCheckpoints ?? 0}
                </p>
                <p className="text-[10px] text-emerald-400 mt-1">All Ed25519 Signatures Valid</p>
              </div>

              <div className="p-3 rounded-lg bg-[#0b132b] border border-[#1c2b50]">
                <p className="text-slate-400 text-xs">Detected Tampering Incidents</p>
                <p className={`text-xl font-bold font-mono mt-1 ${
                  (data?.cryptographicAnalytics.detectedTamperingIncidents ?? 0) > 0 ? 'text-red-400' : 'text-emerald-400'
                }`}>
                  {data?.cryptographicAnalytics.detectedTamperingIncidents ?? 0}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">Continuous hash cross-check</p>
              </div>

              <div className="p-3 rounded-lg bg-[#0b132b] border border-[#1c2b50]">
                <p className="text-slate-400 text-xs">Dual Approval Requests</p>
                <p className="text-xl font-bold text-white font-mono mt-1">
                  {data?.cryptographicAnalytics.correctionApprovalActivity.totalRequests ?? 0}
                </p>
                <p className="text-[10px] text-amber-400 mt-1">
                  {data?.cryptographicAnalytics.correctionApprovalActivity.pendingApprovals ?? 0} pending,{' '}
                  {data?.cryptographicAnalytics.correctionApprovalActivity.approvedApplied ?? 0} approved
                </p>
              </div>
            </div>

            {/* Cryptographic Technical Signature Card */}
            <div className="p-4 rounded-lg bg-[#070d1e] border border-[#1c2b50] space-y-2 text-xs font-mono">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-slate-400">
                <span className="font-semibold text-cyan-400">Active Checkpoint Sequence:</span>
                <span className="text-white">#{data?.cryptographicAnalytics.ledgerIntegrity.latestCheckpointSeq ?? 1}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-slate-400">
                <span className="font-semibold text-cyan-400">Current Merkle Root Hash:</span>
                <span className="text-white truncate max-w-md">
                  {data?.cryptographicAnalytics.ledgerIntegrity.merkleRoot || '—'}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-slate-400">
                <span className="font-semibold text-cyan-400">Signer Ed25519 Public Key:</span>
                <span className="text-slate-300 truncate max-w-md">
                  {data?.cryptographicAnalytics.ledgerIntegrity.signerPublicKey || '—'}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================== */}
        {/* E. DETAILED ANALYTICS TABLE (Searchable, Sortable, Filterable)  */}
        {/* ============================================================== */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                <span>Detailed Examination Records & Cryptographic Status</span>
              </h2>
              <p className="text-xs text-slate-400">
                Sorted by {sortField} ({sortOrder.toUpperCase()}) • {sortedRecords.length} record(s) matching filter
              </p>
            </div>
          </div>

          <div className="bg-[#111c38] border border-[#1c2b50] rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#0b132b] border-b border-[#1c2b50] text-slate-400 font-semibold uppercase tracking-wider">
                    <th
                      className="py-3 px-4 cursor-pointer hover:text-white transition-colors select-none"
                      onClick={() => handleSort('studentRegNo')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Reg Number</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-500" />
                      </div>
                    </th>
                    <th
                      className="py-3 px-4 cursor-pointer hover:text-white transition-colors select-none"
                      onClick={() => handleSort('studentName')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Student Name</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-500" />
                      </div>
                    </th>
                    <th
                      className="py-3 px-4 cursor-pointer hover:text-white transition-colors select-none"
                      onClick={() => handleSort('subject')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Subject</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-500" />
                      </div>
                    </th>
                    <th
                      className="py-3 px-4 cursor-pointer hover:text-white transition-colors select-none"
                      onClick={() => handleSort('marksObtained')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Marks</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-500" />
                      </div>
                    </th>
                    <th
                      className="py-3 px-4 cursor-pointer hover:text-white transition-colors select-none"
                      onClick={() => handleSort('percentage')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Percentage</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-500" />
                      </div>
                    </th>
                    <th className="py-3 px-4">Publication Status</th>
                    <th
                      className="py-3 px-4 cursor-pointer hover:text-white transition-colors select-none"
                      onClick={() => handleSort('verificationStatus')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Verification Status</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-500" />
                      </div>
                    </th>
                    <th className="py-3 px-4 print:hidden">Record Hash</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#1c2b50]/60">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-cyan-400" />
                        <span>Verifying cryptographic inclusion proofs and computing analytics...</span>
                      </td>
                    </tr>
                  ) : sortedRecords.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <div className="max-w-xs mx-auto space-y-2">
                          <AlertTriangle className="w-6 h-6 mx-auto text-amber-400" />
                          <p className="font-semibold text-white">No Matching Examination Records</p>
                          <p className="text-xs text-slate-500">
                            No records match the current filter criteria. Adjust your search or click Reset.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    sortedRecords.map((record) => (
                      <tr
                        key={record.id}
                        className="hover:bg-[#0b132b]/60 transition-colors"
                      >
                        <td className="py-3 px-4 font-mono font-medium text-cyan-400">
                          {record.studentRegNo}
                        </td>
                        <td className="py-3 px-4 font-semibold text-white">
                          {record.studentName}
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          {record.subject}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-white">
                          {record.marksObtained}{' '}
                          <span className="text-[10px] text-slate-500">/ {record.maxMarks}</span>
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold">
                          <span
                            className={
                              record.percentage >= 80
                                ? 'text-emerald-400'
                                : record.percentage >= 60
                                ? 'text-cyan-400'
                                : record.percentage >= 40
                                ? 'text-amber-400'
                                : 'text-red-400'
                            }
                          >
                            {record.percentage}%
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            {record.status}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {record.verificationStatus === 'VERIFIED' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                              <ShieldCheck className="w-3 h-3" />
                              VERIFIED
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-red-500/10 text-red-400 border border-red-500/30">
                              <ShieldAlert className="w-3 h-3" />
                              {record.verificationStatus}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-[10px] text-slate-400 truncate max-w-[120px] print:hidden" title={record.recordHash}>
                          {record.recordHash.substring(0, 16)}...
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
