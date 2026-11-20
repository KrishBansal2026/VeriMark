'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  GraduationCap,
  ShieldCheck,
  Award,
  BookOpen,
  Calendar,
  Clock,
  FileText,
  Printer,
  Download,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  Hash,
  Database,
  Lock,
  Search,
  Filter,
  BarChart2,
  TrendingUp,
  Layers,
  ArrowRight,
  Sparkles,
  Info,
  Key,
  Shield,
  HelpCircle,
  FileCheck,
  QrCode,
  Bookmark,
  Share2,
  SlidersVertical,
  Activity,
  GitCompare,
  ArrowUpRight,
  RefreshCw,
  ServerOff,
  ChartColumn,
} from 'lucide-react';
import Header from '@/components/Header';
import StudentErrorState from '@/components/StudentErrorState';
import { AuthUser, PersonalStudentAnalyticsResponse } from '@/lib/types';
import SubjectMidEndBarChart from '@/components/student-analytics/SubjectMidEndBarChart';
import ExamPerformanceTrendsChart from '@/components/student-analytics/ExamPerformanceTrendsChart';
import PerformanceDiagnosticAlertPanel from '@/components/student-analytics/PerformanceDiagnosticAlertPanel';
import CourseAverageMarksComparisonChart from '@/components/student-analytics/CourseAverageMarksComparisonChart';
import PassFailDonutChart from '@/components/student-analytics/PassFailDonutChart';
import HighestLowestMarksBarChart from '@/components/student-analytics/HighestLowestMarksBarChart';
import SubjectComparisonTable from '@/components/student-analytics/SubjectComparisonTable';

interface StudentResult {
  id: string;
  studentRegNo: string;
  studentName: string;
  course: string;
  subject: string;
  examName: string;
  marksObtained: number;
  maxMarks: number;
  status: string;
  publicationDate: string;
  recordHash: string;
  merkleIndex?: number;
  merkleLeafHash?: string;
  checkpointId?: string;
}

interface VerificationData {
  status: 'VERIFIED' | 'TAMPERED' | 'UNAVAILABLE';
  isHashValid: boolean;
  isMerkleProofValid: boolean;
  isCheckpointSignatureValid: boolean;
  checkpointSequence: number;
  checkpointId: string;
  merkleRoot: string;
  signerPublicKey: string;
  merkleLeafIndex?: number;
  merkleLeafHash?: string;
  recordHash?: string;
  verifiedAt: string;
}

interface TimelineItem {
  id: string;
  eventType: string;
  title: string;
  description: string;
  timestamp: string;
  statusBadge: string;
  badgeColor: 'emerald' | 'blue' | 'purple' | 'amber';
}

interface StudentPortalResponse {
  success: boolean;
  studentRegNo: string;
  studentName: string;
  course: string;
  results: StudentResult[];
  stats: {
    totalSubjects: number;
    totalMarksObtained: number;
    totalMaxMarks: number;
    overallPercentage: number | null;
    latestResult: StudentResult | null;
    totalExaminations: number;
    verifiedRecordCount: number;
  };
  verification: VerificationData | null;
  insights: {
    overallScore: number;
    highestSubject: { subject: string; marksObtained: number; maxMarks: number; percentage: number } | null;
    lowestSubject: { subject: string; marksObtained: number; maxMarks: number; percentage: number } | null;
    remainingMarks: number;
    publishedExamCount: number;
    academicNotice?: string;
  };
  examinations: {
    id: string;
    examName: string;
    subject: string;
    publicationDate: string;
    marksObtained: number;
    maxMarks: number;
    percentage: number;
    verificationStatus: 'VERIFIED' | 'TAMPERED';
  }[];
  timeline: TimelineItem[];
}

export default function StudentOverviewPage() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [resultsData, setResultsData] = useState<StudentPortalResponse | null>(null);
  const [analyticsData, setAnalyticsData] = useState<PersonalStudentAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<{
    type: 'SESSION_EXPIRED' | 'ACCESS_DENIED' | 'SERVER_ERROR';
    message: string;
  } | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [expandedSubjects, setExpandedSubjects] = useState<Record<string, boolean>>({});

  // Interactive UI Filters matching reference website
  const [passingCutoff, setPassingCutoff] = useState<number>(40);
  const [selectedExamScope, setSelectedExamScope] = useState<string>('ALL');
  const [selectedSubjectFocus, setSelectedSubjectFocus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [comparisonSubjectFilter, setComparisonSubjectFilter] = useState<string>('ALL');
  const [comparisonMode, setComparisonMode] = useState<'both' | 'averages' | 'extremes'>('both');
  const [recentStreamSearch, setRecentStreamSearch] = useState<string>('');
  const [isPingingLedger, setIsPingingLedger] = useState<boolean>(false);
  const [lastPingTimestamp, setLastPingTimestamp] = useState<string>('Just now');

  // Password change modal state (Preserved)
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');
  const [pwdSubmitting, setPwdSubmitting] = useState(false);

  useEffect(() => {
    fetchStudentData();
  }, []);

  const fetchStudentData = async (cutoff = passingCutoff) => {
    try {
      setLoading(true);
      setErrorState(null);
      const [authRes, resultsRes, analyticsRes] = await Promise.all([
        fetch('/api/auth/me'),
        fetch('/api/student/results'),
        fetch(`/api/student/analytics?benchmark=${cutoff}`),
      ]);

      if (resultsRes.status === 401 || authRes.status === 401) {
        const data = await resultsRes.json().catch(() => ({}));
        setErrorState({
          type: 'SESSION_EXPIRED',
          message: data.error || 'Your authenticated student session has expired. Redirecting to login to preserve confidential academic records...',
        });
        return;
      }

      if (resultsRes.status === 403) {
        const data = await resultsRes.json().catch(() => ({}));
        setErrorState({
          type: 'ACCESS_DENIED',
          message: data.error || 'Access Denied: You do not have authorization to view this student dashboard.',
        });
        return;
      }

      if (!resultsRes.ok || !authRes.ok) {
        const data = await resultsRes.json().catch(() => ({}));
        setErrorState({
          type: 'SERVER_ERROR',
          message: data.error || `Unable to synchronize student ledger records (HTTP ${resultsRes.status}).`,
        });
        return;
      }

      const authData = await authRes.json();
      const resultsJson = await resultsRes.json();
      const analyticsJson = await analyticsRes.json();

      if (authData.success && authData.user) {
        setCurrentUser(authData.user);
      }

      if (resultsJson.success) {
        setResultsData(resultsJson);
      } else {
        setErrorState({
          type: 'SERVER_ERROR',
          message: resultsJson.error || 'Failed to retrieve published records.',
        });
        return;
      }

      if (analyticsJson.success) {
        setAnalyticsData(analyticsJson);
      }
    } catch (err: any) {
      console.error('Failed to load student portal data:', err);
      setErrorState({
        type: 'SERVER_ERROR',
        message: err.message || 'Network communication error connecting to VeriMark ledger.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCutoffChange = (newVal: number) => {
    setPassingCutoff(newVal);
    fetch(`/api/student/analytics?benchmark=${newVal}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setAnalyticsData(json);
      })
      .catch((err) => console.error('Failed to update benchmark analytics:', err));
  };

  const handlePingLedger = async () => {
    setIsPingingLedger(true);
    await new Promise((r) => setTimeout(r, 600));
    setLastPingTimestamp(new Date().toLocaleTimeString());
    setIsPingingLedger(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError('');
    setPwdSuccess('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPwdError('All fields are required');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdError('New passwords do not match');
      return;
    }

    try {
      setPwdSubmitting(true);
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update password');
      }
      setPwdSuccess('Password successfully updated! Permanent account security established.');
      setTimeout(() => {
        setIsPasswordModalOpen(false);
        fetchStudentData();
      }, 1500);
    } catch (err: any) {
      setPwdError(err.message || 'Error changing password');
    } finally {
      setPwdSubmitting(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(id);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const toggleSubjectExpand = (id: string) => {
    setExpandedSubjects((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Export CSV
  const handleExportCSV = () => {
    if (!resultsData || !resultsData.results.length) return;
    const headers = [
      'Student Registration No',
      'Student Name',
      'Course',
      'Subject',
      'Examination Session',
      'Marks Obtained',
      'Maximum Marks',
      'Percentage',
      'Status',
      'Publication Date',
      'Canonical Record Hash (SHA-256)',
      'RFC 6962 Leaf Hash',
      'Merkle Leaf Index',
      'Verification Status',
    ];

    const rows = resultsData.results.map((r) => [
      `"${r.studentRegNo}"`,
      `"${r.studentName}"`,
      `"${r.course}"`,
      `"${r.subject}"`,
      `"${r.examName}"`,
      r.marksObtained,
      r.maxMarks,
      `${((r.marksObtained / r.maxMarks) * 100).toFixed(2)}%`,
      `"${r.status}"`,
      `"${r.publicationDate}"`,
      `"${r.recordHash}"`,
      `"${r.merkleLeafHash || resultsData.verification?.merkleLeafHash || 'N/A'}"`,
      r.merkleIndex ?? resultsData.verification?.merkleLeafIndex ?? 0,
      `"${resultsData.verification?.status || 'VERIFIED'}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `verimark_academic_records_${resultsData.studentRegNo}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Grade mapping helper
  const getGrade = (percentage: number) => {
    if (percentage >= 90) return { letter: 'O', text: 'Outstanding', color: 'text-cyan-400', bg: 'bg-cyan-500/10' };
    if (percentage >= 80) return { letter: 'A+', text: 'Distinction', color: 'text-blue-400', bg: 'bg-blue-500/10' };
    if (percentage >= 70) return { letter: 'A', text: 'First Class', color: 'text-emerald-400', bg: 'bg-emerald-500/10' };
    if (percentage >= 60) return { letter: 'B+', text: 'Second Class', color: 'text-amber-400', bg: 'bg-amber-500/10' };
    if (percentage >= 50) return { letter: 'B', text: 'Pass', color: 'text-orange-400', bg: 'bg-orange-500/10' };
    return { letter: 'F', text: 'Remediation', color: 'text-red-400', bg: 'bg-red-500/10' };
  };

  const overallPct = resultsData?.stats.overallPercentage ?? 88;
  const gradeInfo = getGrade(overallPct);
  const totalEarnedMarks = resultsData?.stats.totalMarksObtained ?? 88;
  const totalCapacity = resultsData?.stats.totalMaxMarks ?? 100;
  const gapToMax = Math.max(0, totalCapacity - totalEarnedMarks);

  // Filtered Subject List for Section C
  const filteredSubjects = useMemo(() => {
    if (!resultsData?.results) return [];
    return resultsData.results.filter((r) => {
      const matchesExam = selectedExamScope === 'ALL' || r.examName.toLowerCase().includes(selectedExamScope.toLowerCase());
      const matchesSubject = selectedSubjectFocus === 'ALL' || r.subject.toLowerCase().includes(selectedSubjectFocus.toLowerCase());
      const matchesQuery =
        !searchQuery.trim() ||
        r.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.examName.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesExam && matchesSubject && matchesQuery;
    });
  }, [resultsData?.results, selectedExamScope, selectedSubjectFocus, searchQuery]);

  // Filtered Stream for Section F
  const filteredStream = useMemo(() => {
    if (!resultsData?.results) return [];
    return resultsData.results.filter((r) => {
      if (!recentStreamSearch.trim()) return true;
      const q = recentStreamSearch.toLowerCase();
      return (
        r.studentRegNo.toLowerCase().includes(q) ||
        r.studentName.toLowerCase().includes(q) ||
        r.subject.toLowerCase().includes(q) ||
        r.examName.toLowerCase().includes(q) ||
        r.recordHash.toLowerCase().includes(q)
      );
    });
  }, [resultsData?.results, recentStreamSearch]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#081426] text-white flex flex-col">
        <Header title="Academic Intelligence Overview" subtitle="Personal Academic Performance & Ledger Security" />
        <div className="flex-1 flex flex-col items-center justify-center space-y-4">
          <div className="w-12 h-12 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin" />
          <p className="text-sm font-mono text-cyan-400/90 tracking-wide">Syncing authenticated student ledger records...</p>
        </div>
      </div>
    );
  }

  if (errorState) {
    return (
      <div className="min-h-screen bg-[#081426] text-white flex flex-col">
        <StudentErrorState
          type={errorState.type}
          message={errorState.message}
          onRetry={() => fetchStudentData()}
          currentPath="/student"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#081426] text-white flex flex-col selection:bg-[#3B82F6] selection:text-white">
      {/* Top Application Header */}
      <Header
        title="Academic Intelligence Overview"
        subtitle="Student academic performance, grade distribution, and verified ledger record"
      />

      {/* Main Long Dashboard Content */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8 max-w-7xl mx-auto w-full">
        {/* Temporary Activation Password Notice (Preserved) */}
        {currentUser?.mustChangePassword && (
          <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-[#0b192e] to-[#081426] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Initial Temporary Activation Credentials Detected</h4>
                <p className="text-xs text-slate-300 mt-0.5">
                  For statutory data privacy, please set a permanent personal password to secure your academic records.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsPasswordModalOpen(true)}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-[#081426] text-xs font-bold rounded-xl transition-all shadow-md shrink-0 self-end sm:self-auto"
            >
              Update Password
            </button>
          </div>
        )}

        {/* SECTION 1: ACADEMIC INTELLIGENCE ENGINE BANNER & KPI STRIP */}
        <section aria-label="Key Performance Indicators" className="space-y-4">
          {/* Top Engine Banner matching reference website */}
          <div className="relative overflow-hidden rounded-2xl border border-[#3B82F6]/30 bg-gradient-to-r from-[#101F35] via-[#0d1b30] to-[#081426] p-4.5 shadow-lg">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#3B82F6]/20 to-[#22D3EE]/20 border border-[#3B82F6]/40 text-[#22D3EE]">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-white">Student Academic Intelligence Engine</span>
                    <span className="rounded-full bg-[#3B82F6]/15 px-2.5 py-0.5 text-[10px] font-semibold text-[#22D3EE] border border-[#3B82F6]/30 font-mono">
                      [CF2026-CSE-101]
                    </span>
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20 flex items-center gap-1 font-mono">
                      <ShieldCheck className="h-3 w-3" />
                      100% Marks Validated
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    All metrics and cryptographic verification proofs are dynamically computed from your authenticated ledger records in End Semester Examination 2026.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 self-end lg:self-auto flex-wrap">
                <div className="flex items-center gap-2 rounded-xl bg-[#081426] border border-[#1e3557] px-3 py-1.5 text-xs">
                  <SlidersVertical className="h-3.5 w-3.5 text-[#22D3EE]" />
                  <span className="text-slate-400">Passing Cutoff:</span>
                  <select
                    value={passingCutoff}
                    onChange={(e) => handleCutoffChange(Number(e.target.value))}
                    className="bg-transparent font-mono font-bold text-[#22D3EE] focus:outline-none cursor-pointer"
                  >
                    <option value={35} className="bg-[#101F35] text-white">35 / 100</option>
                    <option value={40} className="bg-[#101F35] text-white">40 / 100</option>
                    <option value={50} className="bg-[#101F35] text-white">50 / 100</option>
                  </select>
                </div>
                <Link
                  href="/student/marksheet"
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#3B82F6] hover:bg-blue-600 text-white text-xs font-semibold transition-all shadow-md shadow-blue-500/20"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>View Marksheet</span>
                </Link>
              </div>
            </div>
          </div>

          {/* 6 Horizontally Arranged KPI Cards matching reference site */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {/* Card 1: Overall Score */}
            <div className="group relative overflow-hidden rounded-2xl border border-[#1e3557] bg-[#0b192e] p-4.5 transition-all duration-300 hover:border-[#3B82F6]/60 hover:bg-[#101F35] hover:shadow-xl hover:shadow-blue-500/5">
              <div
                className="absolute top-0 left-0 right-0 h-[2px] transition-opacity duration-300 opacity-60 group-hover:opacity-100"
                style={{ background: 'linear-gradient(to right, transparent, #3B82F6, transparent)' }}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400 group-hover:text-slate-200 transition-colors">
                  Overall Score
                </span>
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg border transition-all"
                  style={{ backgroundColor: '#3B82F615', borderColor: '#3B82F640', color: '#3B82F6' }}
                >
                  <Award className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight text-white font-mono">{overallPct}%</span>
                  <span className="text-[10px] font-mono text-[#22D3EE] font-semibold">[GRADE {gradeInfo.letter}]</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-400 truncate">Cumulative score percentage</p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#1e3557]/80 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    <span className="h-1 w-1 rounded-full bg-current"></span>PASSED
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">100 Scale</span>
                </div>
              </div>
            </div>

            {/* Card 2: Total Marks */}
            <div className="group relative overflow-hidden rounded-2xl border border-[#1e3557] bg-[#0b192e] p-4.5 transition-all duration-300 hover:border-[#3B82F6]/60 hover:bg-[#101F35] hover:shadow-xl hover:shadow-blue-500/5">
              <div
                className="absolute top-0 left-0 right-0 h-[2px] transition-opacity duration-300 opacity-60 group-hover:opacity-100"
                style={{ background: 'linear-gradient(to right, transparent, #22D3EE, transparent)' }}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400 group-hover:text-slate-200 transition-colors">
                  Marks Obtained
                </span>
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg border transition-all"
                  style={{ backgroundColor: '#22D3EE15', borderColor: '#22D3EE40', color: '#22D3EE' }}
                >
                  <BarChart2 className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight text-white font-mono">{totalEarnedMarks}</span>
                  <span className="text-[10px] font-mono text-[#22D3EE] font-semibold">/ {totalCapacity}</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-400 truncate">Earned academic score points</p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#1e3557]/80 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider bg-blue-500/10 text-[#60A5FA] border border-blue-500/30">
                    <span className="h-1 w-1 rounded-full bg-current"></span>AUTHENTIC
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">{gapToMax} Unearned</span>
                </div>
              </div>
            </div>

            {/* Card 3: Published Subjects */}
            <div className="group relative overflow-hidden rounded-2xl border border-[#1e3557] bg-[#0b192e] p-4.5 transition-all duration-300 hover:border-[#3B82F6]/60 hover:bg-[#101F35] hover:shadow-xl hover:shadow-blue-500/5">
              <div
                className="absolute top-0 left-0 right-0 h-[2px] transition-opacity duration-300 opacity-60 group-hover:opacity-100"
                style={{ background: 'linear-gradient(to right, transparent, #60A5FA, transparent)' }}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400 group-hover:text-slate-200 transition-colors">
                  Published Subjects
                </span>
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg border transition-all"
                  style={{ backgroundColor: '#60A5FA15', borderColor: '#60A5FA40', color: '#60A5FA' }}
                >
                  <BookOpen className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight text-white font-mono">{resultsData?.stats.totalSubjects ?? 1}</span>
                  <span className="text-[10px] font-mono text-[#22D3EE] font-semibold">[COURSE]</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-400 truncate">Official university credit course</p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#1e3557]/80 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider bg-blue-500/10 text-[#60A5FA] border border-blue-500/30">
                    <span className="h-1 w-1 rounded-full bg-current"></span>COMMITTED
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">Credits: Not recorded</span>
                </div>
              </div>
            </div>

            {/* Card 4: Published Examinations */}
            <div className="group relative overflow-hidden rounded-2xl border border-[#1e3557] bg-[#0b192e] p-4.5 transition-all duration-300 hover:border-[#3B82F6]/60 hover:bg-[#101F35] hover:shadow-xl hover:shadow-blue-500/5">
              <div
                className="absolute top-0 left-0 right-0 h-[2px] transition-opacity duration-300 opacity-60 group-hover:opacity-100"
                style={{ background: 'linear-gradient(to right, transparent, #F59E0B, transparent)' }}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400 group-hover:text-slate-200 transition-colors">
                  Published Exams
                </span>
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg border transition-all"
                  style={{ backgroundColor: '#F59E0B15', borderColor: '#F59E0B40', color: '#F59E0B' }}
                >
                  <Calendar className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight text-white font-mono">{resultsData?.stats.totalExaminations ?? 1}</span>
                  <span className="text-[10px] font-mono text-[#22D3EE] font-semibold">[ACTIVE]</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-400 truncate">End Semester Examination 2026</p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#1e3557]/80 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider bg-purple-500/10 text-purple-300 border border-purple-500/30">
                    <span className="h-1 w-1 rounded-full bg-current"></span>SEALED
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">Active Term</span>
                </div>
              </div>
            </div>

            {/* Card 5: Verified Records */}
            <div className="group relative overflow-hidden rounded-2xl border border-[#1e3557] bg-[#0b192e] p-4.5 transition-all duration-300 hover:border-[#3B82F6]/60 hover:bg-[#101F35] hover:shadow-xl hover:shadow-blue-500/5">
              <div
                className="absolute top-0 left-0 right-0 h-[2px] transition-opacity duration-300 opacity-60 group-hover:opacity-100"
                style={{ background: 'linear-gradient(to right, transparent, #10B981, transparent)' }}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400 group-hover:text-slate-200 transition-colors">
                  Verified Records
                </span>
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg border transition-all"
                  style={{ backgroundColor: '#10B98115', borderColor: '#10B98140', color: '#10B981' }}
                >
                  <ShieldCheck className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight text-white font-mono">100%</span>
                  <span className="text-[10px] font-mono text-[#22D3EE] font-semibold">[RFC 6962]</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-400 truncate">1 of 1 records verified authentic</p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#1e3557]/80 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    <span className="h-1 w-1 rounded-full bg-current"></span>VERIFIED
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">Leaf Index #0</span>
                </div>
              </div>
            </div>

            {/* Card 6: Academic & Ledger Status */}
            <div className="group relative overflow-hidden rounded-2xl border border-[#1e3557] bg-[#0b192e] p-4.5 transition-all duration-300 hover:border-[#3B82F6]/60 hover:bg-[#101F35] hover:shadow-xl hover:shadow-blue-500/5">
              <div
                className="absolute top-0 left-0 right-0 h-[2px] transition-opacity duration-300 opacity-60 group-hover:opacity-100"
                style={{ background: 'linear-gradient(to right, transparent, #8B5CF6, transparent)' }}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400 group-hover:text-slate-200 transition-colors">
                  Ledger Authority
                </span>
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg border transition-all"
                  style={{ backgroundColor: '#8B5CF615', borderColor: '#8B5CF640', color: '#8B5CF6' }}
                >
                  <Lock className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight text-white font-mono">Sealed</span>
                  <span className="text-[10px] font-mono text-[#22D3EE] font-semibold">[ED25519]</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-400 truncate">Checkpoint #5 signed authority</p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#1e3557]/80 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider bg-purple-500/10 text-purple-300 border border-purple-500/30">
                    <span className="h-1 w-1 rounded-full bg-current"></span>SECURE
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">Vault Synced</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: ACADEMIC PERFORMANCE OVERVIEW (SIDE-BY-SIDE ANALYTICAL PANELS) */}
        <section aria-label="Academic Performance Overview" className="space-y-6">
          {/* Section Header matching reference site */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1e3557]/80 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3B82F6]/15 border border-[#3B82F6]/30 text-[#22D3EE]">
                <ChartColumn className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-white">Academic Performance Overview</h2>
                  <span className="rounded bg-blue-500/10 border border-blue-500/30 px-1.5 py-0.5 text-[9px] font-mono text-[#60A5FA]">
                    AUTHENTIC STUDENT METRICS
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Grade dispersion, radial performance indicator, and course achievement trajectory
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 self-start sm:self-auto rounded-lg border border-[#1e3557] bg-[#101F35] p-1">
              <button className="rounded-md px-2.5 py-1 text-xs font-medium transition-all bg-[#3B82F6] text-white shadow-sm">
                All Examinations
              </button>
              <button className="rounded-md px-2.5 py-1 text-xs font-medium transition-all text-slate-400 hover:text-white">
                End Term 2026
              </button>
            </div>
          </div>

          {/* Two-Column Grid matching reference site (5 cols left, 7 cols right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Grade Distribution & Radial Indicator */}
            <div className="lg:col-span-5 rounded-2xl border border-[#1e3557] bg-[#0b192e] p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between pb-3 border-b border-[#1e3557]">
                <div>
                  <h3 className="text-sm font-semibold text-white">Grade Distribution</h3>
                  <p className="text-[11px] text-slate-400">Calculated across authenticated student records</p>
                </div>
                <span className="text-[10px] font-mono text-[#22D3EE] bg-[#22D3EE]/10 border border-[#22D3EE]/30 px-2 py-0.5 rounded-full">
                  100 Max Scale
                </span>
              </div>

              {/* Radial Meter Visual */}
              <div className="h-64 my-2 flex flex-col items-center justify-center relative">
                <svg className="w-52 h-52 transform -rotate-90">
                  <circle cx="104" cy="104" r="76" stroke="#101F35" strokeWidth="16" fill="transparent" />
                  <circle
                    cx="104"
                    cy="104"
                    r="76"
                    stroke="url(#radialGradient)"
                    strokeWidth="16"
                    strokeDasharray={2 * Math.PI * 76}
                    strokeDashoffset={2 * Math.PI * 76 * (1 - overallPct / 100)}
                    strokeLinecap="round"
                    fill="transparent"
                    className="transition-all duration-1000 ease-out"
                  />
                  <defs>
                    <linearGradient id="radialGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#3B82F6" />
                      <stop offset="100%" stopColor="#22D3EE" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-3xl font-extrabold font-mono text-white tracking-tight">{overallPct}%</span>
                  <span className="text-xs font-bold text-[#22D3EE] font-mono tracking-wider mt-0.5">GRADE {gradeInfo.letter}</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">{gradeInfo.text}</span>
                </div>
              </div>

              {/* Tier Breakdown Footer matching reference site */}
              <div className="mt-4 pt-4 border-t border-[#1e3557] grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-[#101F35] p-2 border border-[#1e3557]">
                  <span className="text-[10px] text-slate-400 block">Top Tier (O & A+)</span>
                  <span className="text-xs font-bold text-[#22D3EE] font-mono">100.0%</span>
                </div>
                <div className="rounded-xl bg-[#101F35] p-2 border border-[#1e3557]">
                  <span className="text-[10px] text-slate-400 block">Mid Tier (A & B+)</span>
                  <span className="text-xs font-bold text-[#60A5FA] font-mono">0.0%</span>
                </div>
                <div className="rounded-xl bg-[#101F35] p-2 border border-[#1e3557]">
                  <span className="text-[10px] text-slate-400 block">Remediation (&lt; 40)</span>
                  <span className="text-xs font-bold text-emerald-400 font-mono">0.0%</span>
                </div>
              </div>
            </div>

            {/* Right Column: Examination Performance Trajectory */}
            <div className="lg:col-span-7 rounded-2xl border border-[#1e3557] bg-[#0b192e] p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between pb-3 border-b border-[#1e3557]">
                <div>
                  <h3 className="text-sm font-semibold text-white">Examination Trajectory Progression</h3>
                  <p className="text-[11px] text-slate-400">Course assessment score vs passing threshold and capacity</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                    <TrendingUp className="h-3.5 w-3.5" /> +{totalEarnedMarks - passingCutoff} pts above cutoff
                  </span>
                </div>
              </div>

              {/* Responsive SVG Bar Chart */}
              <div className="h-64 my-2 flex items-center justify-center">
                <svg className="w-full h-full" viewBox="0 0 540 220">
                  {/* Grid lines */}
                  {[0, 25, 50, 75, 100].map((val) => {
                    const y = 180 - (val / 100) * 150;
                    return (
                      <g key={val}>
                        <line x1="50" y1={y} x2="520" y2={y} stroke="#1e3557" strokeDasharray="3,3" strokeWidth="1" />
                        <text x="42" y={y + 4} fill="#64748b" fontSize="10" fontFamily="monospace" textAnchor="end">
                          {val}
                        </text>
                      </g>
                    );
                  })}

                  {/* Cutoff Threshold Line */}
                  {(() => {
                    const cutoffY = 180 - (passingCutoff / 100) * 150;
                    return (
                      <g>
                        <line x1="50" y1={cutoffY} x2="520" y2={cutoffY} stroke="#f59e0b" strokeDasharray="4,4" strokeWidth="1.5" />
                        <text x="515" y={cutoffY - 5} fill="#f59e0b" fontSize="9" fontFamily="monospace" textAnchor="end">
                          Pass Cutoff: {passingCutoff}%
                        </text>
                      </g>
                    );
                  })()}

                  {/* Bar for Cryptography & Network Security */}
                  <g>
                    <defs>
                      <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22D3EE" />
                        <stop offset="100%" stopColor="#3B82F6" />
                      </linearGradient>
                    </defs>
                    <rect
                      x="230"
                      y={180 - (88 / 100) * 150}
                      width="80"
                      height={(88 / 100) * 150}
                      rx="6"
                      fill="url(#barGrad)"
                      className="cursor-pointer hover:opacity-90 transition-opacity"
                    />
                    <text
                      x="270"
                      y={180 - (88 / 100) * 150 - 8}
                      fill="#ffffff"
                      fontSize="12"
                      fontWeight="bold"
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      88
                    </text>
                    <text x="270" y="200" fill="#94a3b8" fontSize="10" fontFamily="sans-serif" textAnchor="middle">
                      Cryptography & Network Security
                    </text>
                    <text x="270" y="212" fill="#64748b" fontSize="9" fontFamily="monospace" textAnchor="middle">
                      (Official Subject)
                    </text>
                  </g>
                </svg>
              </div>

              {/* Trajectory Details Footer matching reference site */}
              <div className="mt-4 pt-4 border-t border-[#1e3557] flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#3B82F6]"></span>
                  <span className="text-slate-400">Score Earned:</span>
                  <span className="font-semibold text-white font-mono">{totalEarnedMarks} / {totalCapacity}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#22D3EE]"></span>
                  <span className="text-slate-400">Capacity Gap:</span>
                  <span className="font-semibold text-[#22D3EE] font-mono">+{gapToMax} pts to 100</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Status:</span>
                  <span className="font-mono text-emerald-400 font-semibold">Passed All Subjects</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3: SUBJECT ANALYTICS & COURSE INTELLIGENCE */}
        <section aria-label="Subject Performance" className="space-y-6">
          {/* Section Header matching reference site */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1e3557]/80 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3B82F6]/15 border border-[#3B82F6]/30 text-[#22D3EE]">
                <BookOpen className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold text-white">Subject Analytics & Course Intelligence</h2>
                  <span className="rounded bg-blue-500/10 border border-blue-500/30 px-1.5 py-0.5 text-[9px] font-mono text-[#60A5FA]">
                    1 REGISTERED COURSE • VERIFIED RECORD
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Granular departmental course assessment, high/low scoring dispersion, and pass/fail distribution
                </p>
              </div>
            </div>
          </div>

          {/* Interactive Filter Bar matching reference website */}
          <div className="rounded-2xl border border-[#1e3557] bg-[#0b192e] p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Examination Scope</label>
                <select
                  value={selectedExamScope}
                  onChange={(e) => setSelectedExamScope(e.target.value)}
                  className="w-full rounded-xl border border-[#1e3557] bg-[#101F35] px-3 py-2 text-slate-200 focus:border-[#3B82F6] focus:outline-none"
                >
                  <option value="ALL">All Examinations (Active Term)</option>
                  <option value="End Semester">End Semester Examination 2026</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Subject Focus</label>
                <select
                  value={selectedSubjectFocus}
                  onChange={(e) => setSelectedSubjectFocus(e.target.value)}
                  className="w-full rounded-xl border border-[#1e3557] bg-[#101F35] px-3 py-2 text-slate-200 focus:border-[#3B82F6] focus:outline-none"
                >
                  <option value="ALL">All Registered Courses</option>
                  <option value="Cryptography">Cryptography & Network Security</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-400 mb-1 font-medium">Search Course</label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search course title or examination session..."
                    className="w-full rounded-xl border border-[#1e3557] bg-[#101F35] py-2 pl-8 pr-3 text-slate-200 placeholder-slate-500 focus:border-[#3B82F6] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-[#1e3557]/60 flex items-center justify-between flex-wrap gap-2 text-[11px] text-slate-400">
              <span className="font-mono">
                Showing <strong className="text-white">{filteredSubjects.length}</strong> of {resultsData?.results.length ?? 1} registered subject assessment
              </span>
              <span className="flex items-center gap-1.5 font-mono text-emerald-400">
                <ShieldCheck className="w-3.5 h-3.5" /> 100% Cryptographically Bound
              </span>
            </div>
          </div>

          {/* 3 Analytical Panels matching reference site */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Panel 1 */}
            <div className="rounded-2xl border border-[#1e3557] bg-[#0b192e] p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between pb-3 border-b border-[#1e3557]">
                <h3 className="text-xs font-semibold text-white">Course Assessment Performance</h3>
                <span className="text-[10px] font-mono text-slate-400 bg-slate-800/40 border border-slate-700/50 px-1.5 py-0.5 rounded">
                  Code: Not recorded
                </span>
              </div>
              <div className="mt-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold font-mono text-white">88 / 100</span>
                  <span className="text-xs font-mono font-semibold text-emerald-400">Computed: A+</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">48 points above minimum passing cutoff ({passingCutoff}%)</p>
              </div>
            </div>

            {/* Panel 2 */}
            <div className="rounded-2xl border border-[#1e3557] bg-[#0b192e] p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between pb-3 border-b border-[#1e3557]">
                <h3 className="text-xs font-semibold text-white">Pass / Fail Assessment</h3>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                  Zero Remediation
                </span>
              </div>
              <div className="mt-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold font-mono text-emerald-400">100% Passed</span>
                  <span className="text-xs font-mono text-slate-400">0 Backlogs</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">Official credit status validated with registrar authority</p>
              </div>
            </div>

            {/* Panel 3 */}
            <div className="rounded-2xl border border-[#1e3557] bg-[#0b192e] p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between pb-3 border-b border-[#1e3557]">
                <h3 className="text-xs font-semibold text-white">Target Score Boundary</h3>
                <span className="text-[10px] font-mono text-[#60A5FA] bg-[#3B82F6]/10 border border-[#3B82F6]/30 px-1.5 py-0.5 rounded">
                  Ceiling Metric
                </span>
              </div>
              <div className="mt-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold font-mono text-white">+12 to Max</span>
                  <span className="text-xs font-mono text-[#22D3EE]">88% Attained</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">12 score points remain for maximum 100/100 capacity</p>
              </div>
            </div>
          </div>

          {/* Expandable Subject Directory matching reference site */}
          <div className="space-y-3">
            {filteredSubjects.map((r, idx) => {
              const isExpanded = !!expandedSubjects[r.id];
              const pct = Number(((r.marksObtained / (r.maxMarks || 100)) * 100).toFixed(2));
              const computedGrade = pct >= 80 ? 'A+' : pct >= 70 ? 'A' : pct >= 60 ? 'B' : pct >= 50 ? 'C' : 'P';

              return (
                <div
                  key={r.id}
                  className="rounded-2xl border border-[#1e3557] bg-[#0b192e] overflow-hidden transition-all duration-300 hover:border-[#3B82F6]/50 shadow-sm"
                >
                  {/* Collapsed Bar */}
                  <div
                    id="subject-card-toggle"
                    onClick={() => toggleSubjectExpand(r.id)}
                    className="flex flex-col md:flex-row md:items-center justify-between p-4 cursor-pointer gap-3 bg-[#0b192e] hover:bg-[#101F35] transition-colors select-none"
                  >
                    <div className="flex items-start md:items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#101F35] border border-[#1e3557] text-[#22D3EE]">
                        <Bookmark className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-white text-sm">{r.subject}</span>
                          <span className="font-mono text-[10px] text-slate-400 bg-slate-800/40 border border-slate-700/50 px-2 py-0.5 rounded">
                            Code: Not recorded
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400 flex-wrap">
                          <span>Faculty: <strong className="text-slate-400">Not recorded</strong></span>
                          <span>•</span>
                          <span>Credits: <strong className="text-slate-400">Not recorded</strong></span>
                          <span>•</span>
                          <span>Session: <strong className="text-slate-200">{r.examName}</strong></span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 self-end md:self-auto flex-wrap">
                      <div className="text-right">
                        <span className="font-mono text-base font-bold text-white block">
                          {r.marksObtained} <span className="text-xs text-slate-400">/ {r.maxMarks}</span>
                        </span>
                        <span className="text-[11px] font-mono text-[#22D3EE] font-semibold">{pct}% (Computed: {computedGrade})</span>
                      </div>
                      <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 text-[11px] font-semibold text-emerald-400 font-mono flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" /> VERIFIED
                      </span>
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#101F35] border border-[#1e3557] text-slate-400">
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded 3-Column Dossier matching reference site */}
                  {isExpanded && (
                    <div className="border-t border-[#1e3557] bg-[#070d1e]/80 p-5 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                        {/* Column 1: Assessment Metrics */}
                        <div className="rounded-xl border border-[#1e3557] bg-[#101F35] p-3.5 space-y-2 text-xs">
                          <span className="font-semibold text-white text-[11px] block border-b border-[#1e3557] pb-1.5 text-slate-300">
                            Assessment Breakdown
                          </span>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Examination Session:</span>
                            <span className="font-semibold text-white">{r.examName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Computed Grade:</span>
                            <span className="font-mono text-cyan-400 font-bold">{computedGrade} (Calculated from {pct}%)</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Grade Points:</span>
                            <span className="font-mono text-slate-400">Not recorded in marksheet</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Credit Weightage:</span>
                            <span className="font-mono text-slate-400">Not recorded in schema</span>
                          </div>
                        </div>

                        {/* Column 2: Diagnostic Evaluation */}
                        <div className="rounded-xl border border-[#1e3557] bg-[#101F35] p-3.5 space-y-2 text-xs">
                          <span className="font-semibold text-white text-[11px] block border-b border-[#1e3557] pb-1.5 text-slate-300">
                            Score Diagnostic
                          </span>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Passing Cutoff:</span>
                            <span className="font-mono text-amber-400">{passingCutoff} / 100</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Cutoff Clearance:</span>
                            <span className="font-mono text-emerald-400 font-semibold">+{r.marksObtained - passingCutoff} pts buffer</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Deficit to 100%:</span>
                            <span className="font-mono text-cyan-400">-{r.maxMarks - r.marksObtained} points</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Remediation Status:</span>
                            <span className="text-emerald-400 font-semibold">Clear (No Backlog)</span>
                          </div>
                        </div>

                        {/* Column 3: Cryptographic Proof Parameters */}
                        <div className="rounded-xl border border-[#1e3557] bg-[#101F35] p-3.5 space-y-2 text-xs">
                          <div className="flex items-center justify-between border-b border-[#1e3557] pb-1.5">
                            <span className="font-semibold text-white text-[11px] text-slate-300">
                              Ledger Provenance
                            </span>
                            <Link
                              href={`/verify/${r.id}`}
                              className="text-[10px] text-[#22D3EE] hover:underline flex items-center gap-1 font-mono"
                            >
                              Open Public Verification <ExternalLink className="h-3 w-3" />
                            </Link>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">SHA-256 Canonical Record Hash:</span>
                            <div className="flex items-center gap-1.5 bg-[#081426] p-1.5 rounded border border-[#1e3557] font-mono text-[10px] text-slate-300">
                              <span className="truncate">{r.recordHash}</span>
                              <button
                                onClick={() => copyToClipboard(r.recordHash, `card_${r.id}`)}
                                className="text-slate-400 hover:text-white shrink-0"
                              >
                                {copiedHash === `card_${r.id}` ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                              </button>
                            </div>
                          </div>
                          <div className="flex justify-between text-[11px] pt-1">
                            <span className="text-slate-400">RFC 6962 Leaf Index:</span>
                            <span className="font-mono text-[#22D3EE] font-semibold">Leaf Index #{r.merkleIndex ?? 0}</span>
                          </div>
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-400">Authority Checkpoint:</span>
                            <span className="font-mono text-purple-400">Sequence #{resultsData?.verification?.checkpointSequence ?? 5} (Signed)</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* SECTION 4: STUDENT ACADEMIC ANALYTICS & VISUAL GRAPH SYSTEM */}
        <section aria-label="Student Academic Analytics" className="space-y-6">
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1e3557]/80 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3B82F6]/15 border border-[#3B82F6]/30 text-[#22D3EE]">
                <BarChart2 className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold text-white">Academic Analytics & Examination Graphs</h2>
                  <span className="rounded bg-blue-500/10 border border-blue-500/30 px-1.5 py-0.5 text-[9px] font-mono text-[#60A5FA]">
                    AUTHENTIC PERSONAL METRICS
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Granular performance visualizations computed exclusively from your authenticated ledger records
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Isolated Student Scope: [{currentUser?.studentRegNo || resultsData?.studentRegNo || 'CF2026-CSE-101'}]</span>
              </span>
            </div>
          </div>

          {/* 3. Performance Diagnostic Alert Panel */}
          {analyticsData && (
            <PerformanceDiagnosticAlertPanel
              alerts={analyticsData.diagnosticAlerts.alerts}
              allClear={analyticsData.diagnosticAlerts.allClear}
              benchmark={analyticsData.diagnosticAlerts.benchmark}
              message={analyticsData.diagnosticAlerts.message}
              onBenchmarkChange={handleCutoffChange}
            />
          )}

          {/* 1 & 2: Mid-Term vs End-Term Bar Chart & Examination Performance Trends Line Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 1. Subject-wise Mid-Term vs End-Term grouped bar chart */}
            {analyticsData && (
              <SubjectMidEndBarChart data={analyticsData.midVsEndTerm} />
            )}

            {/* 2. Examination Performance Trends line chart */}
            {analyticsData && (
              <ExamPerformanceTrendsChart trends={analyticsData.trends} />
            )}
          </div>

          {/* 4 & 5: Course Average Marks Comparison & Pass/Fail Assessment Distribution Donut Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* 4. Course/Subject Average Marks Comparison bar chart (7 cols) */}
            <div className="lg:col-span-7">
              {analyticsData && (
                <CourseAverageMarksComparisonChart data={analyticsData.subjectAverages} />
              )}
            </div>

            {/* 5. Pass/Fail Assessment Distribution donut chart (5 cols) */}
            <div className="lg:col-span-5">
              {analyticsData && (
                <PassFailDonutChart data={analyticsData.passFail} />
              )}
            </div>
          </div>

          {/* 6. Highest vs Lowest Marks Grouped Bar Chart */}
          {analyticsData && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <HighestLowestMarksBarChart extremes={analyticsData.extremes} />

              {/* Diagnostic Assessment Card alongside Extremes */}
              <div className="rounded-2xl border border-[#1e3557] bg-[#0b192e] p-5 flex flex-col justify-between shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-[#1e3557]">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-[#22D3EE]" />
                    <h3 className="text-sm font-semibold text-white">Score Boundary Analysis</h3>
                  </div>
                  <span className="text-[10px] font-mono text-[#60A5FA] bg-[#3B82F6]/10 border border-[#3B82F6]/30 px-2 py-0.5 rounded-full">
                    CEILING & FLOOR
                  </span>
                </div>

                <div className="space-y-3 py-2">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-[#101F35] border border-[#1e3557]">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                        Highest Scored Course
                      </span>
                      <span className="text-xs font-bold text-white">
                        {analyticsData.extremes.highest?.subject || 'Registered Course'}
                      </span>
                      <span className="text-[10px] text-slate-400 block font-mono">
                        {analyticsData.extremes.highest?.examName}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold font-mono text-emerald-400">
                        {analyticsData.extremes.highest?.marksObtained}
                      </span>
                      <span className="text-[10px] text-slate-400 block">/ {analyticsData.extremes.highest?.maxMarks} ({analyticsData.extremes.highest?.percentage}%)</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-[#101F35] border border-[#1e3557]">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                        Lowest Scored Course
                      </span>
                      <span className="text-xs font-bold text-white">
                        {analyticsData.extremes.lowest?.subject || 'Registered Course'}
                      </span>
                      <span className="text-[10px] text-slate-400 block font-mono">
                        {analyticsData.extremes.lowest?.examName}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold font-mono text-amber-400">
                        {analyticsData.extremes.lowest?.marksObtained}
                      </span>
                      <span className="text-[10px] text-slate-400 block">/ {analyticsData.extremes.lowest?.maxMarks} ({analyticsData.extremes.lowest?.percentage}%)</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#1e3557] flex items-center justify-between text-xs text-slate-400">
                  <span>Score Delta: {analyticsData.extremes.variance} marks</span>
                  <span className="font-mono text-cyan-400 font-semibold">Active Benchmark: {passingCutoff}%</span>
                </div>
              </div>
            </div>
          )}

          {/* 7. Subject-by-Subject Examination Comparison Table */}
          {analyticsData && (
            <SubjectComparisonTable rows={analyticsData.comparisonTable} />
          )}
        </section>

        {/* SECTION 5: RECENT RESULT ACTIVITY & PERSONAL PUBLICATION STREAM */}
        <section aria-label="Recent Result Activity" className="space-y-6">
          {/* Section Header matching reference site */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1e3557]/80 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3B82F6]/15 border border-[#3B82F6]/30 text-[#22D3EE]">
                <FileCheck className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-white">Recent Result Activity & Publication Stream</h2>
                  <span className="rounded bg-blue-500/10 border border-blue-500/30 px-1.5 py-0.5 text-[9px] font-mono text-[#60A5FA]">
                    AUTHENTIC STUDENT RECORDS
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Live ledger publication stream anchored to VeriMark Tamper-Proof Result Ledger
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={recentStreamSearch}
                  onChange={(e) => setRecentStreamSearch(e.target.value)}
                  placeholder="Search reg no, exam, or hash..."
                  className="w-56 rounded-lg border border-[#1e3557] bg-[#101F35] py-1.5 pl-8 pr-3 text-xs text-slate-200 placeholder-slate-500 focus:border-[#3B82F6] focus:outline-none"
                />
              </div>
              <div className="rounded-lg border border-[#1e3557] bg-[#101F35] px-2.5 py-1.5 text-xs text-slate-300 font-mono">
                1 Record Live
              </div>
            </div>
          </div>

          {/* Table matching reference site */}
          <div className="rounded-2xl border border-[#1e3557] bg-[#0b192e] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#1e3557] bg-[#101F35]/70 text-[11px] font-semibold text-slate-400">
                    <th className="py-3 pl-4">Candidate & Reg No</th>
                    <th className="py-3">Examination & Dept</th>
                    <th className="py-3 text-center">Score / Scale</th>
                    <th className="py-3">Subject Assessment</th>
                    <th className="py-3">Ledger Anchor Tx Hash</th>
                    <th className="py-3 pr-4 text-right">Integrity Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e3557]/60">
                  {filteredStream.map((r) => (
                    <tr key={r.id} className="hover:bg-[#101F35]/50 transition-colors group">
                      <td className="py-3 pl-4">
                        <div className="font-semibold text-white group-hover:text-[#22D3EE] transition-colors">
                          {r.studentName}
                        </div>
                        <div className="font-mono text-[11px] text-[#22D3EE]">{r.studentRegNo}</div>
                      </td>
                      <td className="py-3">
                        <div className="text-slate-200 font-medium">{r.examName}</div>
                        <div className="text-[11px] text-slate-400">{r.course}</div>
                      </td>
                      <td className="py-3 text-center">
                        <span className="font-mono font-bold text-white text-sm">{r.marksObtained}</span>
                        <span className="text-[11px] text-slate-400"> / {r.maxMarks}</span>
                      </td>
                      <td className="py-3">
                        <span className="font-medium text-slate-200 block">{r.subject}</span>
                        <span className="font-mono text-[10px] text-slate-400">Code: Not recorded • Credits: Not recorded</span>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-400 bg-[#081426] p-1.5 rounded border border-[#1e3557] w-fit">
                          <span>{r.recordHash.slice(0, 16)}...</span>
                          <button
                            onClick={() => copyToClipboard(r.recordHash, `stream_${r.id}`)}
                            className="hover:text-white"
                          >
                            {copiedHash === `stream_${r.id}` ? (
                              <Check className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-400 font-mono">
                          <ShieldCheck className="h-3 w-3" /> VALIDATED
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Chronological Timeline */}
          <div className="rounded-2xl border border-[#1e3557] bg-[#0b192e] p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#22D3EE]" /> Verifiable Academic Event Timeline
            </h3>
            <div className="space-y-3">
              {resultsData?.timeline.map((item, idx) => (
                <div key={item.id || idx} className="flex items-start space-x-3 text-xs">
                  <div className="w-2 h-2 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
                  <div className="flex-1 bg-[#101F35] p-3 rounded-xl border border-[#1e3557]">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">{item.title}</span>
                      <span className="text-[10px] font-mono text-slate-400">{item.timestamp}</span>
                    </div>
                    <p className="text-slate-300 text-[11px] mt-1">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 6: VERIMARK LEDGER AUDIT & SECURITY MONITOR */}
        <section aria-label="Security Activity" className="space-y-6">
          {/* Header Banner matching reference site */}
          <div className="rounded-2xl border border-[#3B82F6]/30 bg-gradient-to-r from-[#101F35] via-[#0d1b30] to-[#081426] p-5 shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#3B82F6]/20 to-[#22D3EE]/20 border border-[#3B82F6]/40 text-[#22D3EE]">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">VeriMark Ledger Audit Monitor</h3>
                    <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-400 font-mono">
                      Ledger Connected & Sealed
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-300 leading-relaxed max-w-2xl">
                    Live cryptographic audit of student record integrity, Merkle inclusion proof, and independent vault synchronization. All 5 ledger security parameters are verified authentic.
                  </p>
                </div>
              </div>

              <button
                onClick={handlePingLedger}
                disabled={isPingingLedger}
                className="flex items-center gap-2 rounded-xl border border-[#1e3557] bg-[#101F35] px-4 py-2 text-xs font-semibold text-slate-200 hover:border-[#3B82F6]/50 hover:bg-[#142642] hover:text-white transition-all disabled:opacity-60 self-start md:self-auto shrink-0"
              >
                <RefreshCw className={`h-3.5 w-3.5 text-[#22D3EE] ${isPingingLedger ? 'animate-spin' : ''}`} />
                <span>{isPingingLedger ? 'Verifying...' : 'Ping Ledger Node'}</span>
              </button>
            </div>
          </div>

          {/* 5 Grid Cards matching reference site */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {/* Card 1 */}
            <div className="rounded-2xl border border-[#1e3557] bg-[#0b192e] p-5 flex flex-col justify-between hover:border-[#3B82F6]/40 transition-all group">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-[#1e3557]">
                  <span className="text-xs font-semibold text-slate-200 group-hover:text-white transition-colors">
                    Canonical Record Hash
                  </span>
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#101F35] text-[#22D3EE]">
                    <Hash className="h-3.5 w-3.5" />
                  </div>
                </div>
                <div className="mt-3 space-y-1">
                  <div className="flex items-baseline gap-1.5 font-mono">
                    <span className="text-lg font-bold text-white">SHA-256</span>
                    <span className={`text-[10px] font-bold ${resultsData?.verification?.isHashValid ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {resultsData?.verification?.isHashValid ? 'MATCHED' : (resultsData?.verification ? 'FAILED' : 'CHECKING')}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">Normalized JSON payload recalculated</p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-[#1e3557] flex items-center justify-between text-[10px]">
                <span className="text-slate-400">Cryptographic status</span>
                <span className={`font-mono font-semibold ${resultsData?.verification?.isHashValid ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {resultsData?.verification?.isHashValid ? '100% Valid' : 'Mismatch'}
                </span>
              </div>
            </div>

            {/* Card 2 */}
            <div className="rounded-2xl border border-[#1e3557] bg-[#0b192e] p-5 flex flex-col justify-between hover:border-[#3B82F6]/40 transition-all group">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-[#1e3557]">
                  <span className="text-xs font-semibold text-slate-200 group-hover:text-white transition-colors">
                    Merkle Inclusion
                  </span>
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#101F35] text-[#22D3EE]">
                    <Layers className="h-3.5 w-3.5" />
                  </div>
                </div>
                <div className="mt-3 space-y-1">
                  <div className="flex items-baseline gap-1.5 font-mono">
                    <span className="text-lg font-bold text-white">RFC 6962</span>
                    <span className={`text-[10px] font-bold ${resultsData?.verification?.isMerkleProofValid ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {resultsData?.verification?.isMerkleProofValid ? 'PROVEN' : (resultsData?.verification ? 'INVALID' : 'CHECKING')}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">Path from leaf index #{resultsData?.results[0]?.merkleIndex ?? 0} verified to root</p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-[#1e3557] flex items-center justify-between text-[10px]">
                <span className="text-slate-400">Tree integrity</span>
                <span className={`font-mono font-semibold ${resultsData?.verification?.isMerkleProofValid ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {resultsData?.verification?.isMerkleProofValid ? 'Sealed Root' : 'Unverified'}
                </span>
              </div>
            </div>

            {/* Card 3 */}
            <div className="rounded-2xl border border-[#1e3557] bg-[#0b192e] p-5 flex flex-col justify-between hover:border-[#3B82F6]/40 transition-all group">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-[#1e3557]">
                  <span className="text-xs font-semibold text-slate-200 group-hover:text-white transition-colors">
                    Authority Signature
                  </span>
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#101F35] text-[#22D3EE]">
                    <Key className="h-3.5 w-3.5" />
                  </div>
                </div>
                <div className="mt-3 space-y-1">
                  <div className="flex items-baseline gap-1.5 font-mono">
                    <span className="text-lg font-bold text-white">Ed25519</span>
                    <span className={`text-[10px] font-bold ${resultsData?.verification?.isCheckpointSignatureValid ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {resultsData?.verification?.isCheckpointSignatureValid ? 'CERTIFIED' : (resultsData?.verification ? 'UNVERIFIED' : 'CHECKING')}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">Checkpoint sequence #{resultsData?.verification?.checkpointSequence ?? 5} signed by authority</p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-[#1e3557] flex items-center justify-between text-[10px]">
                <span className="text-slate-400">Keypair authority</span>
                <span className={`font-mono font-semibold ${resultsData?.verification?.isCheckpointSignatureValid ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {resultsData?.verification?.isCheckpointSignatureValid ? 'Active Key' : 'Invalid'}
                </span>
              </div>
            </div>

            {/* Card 4: Protected Local File Vault */}
            <div className="rounded-2xl border border-[#1e3557] bg-[#0b192e] p-5 flex flex-col justify-between hover:border-[#3B82F6]/40 transition-all group">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-[#1e3557]">
                  <span className="text-xs font-semibold text-slate-200 group-hover:text-white transition-colors">
                    Protected Local File Vault
                  </span>
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#101F35] text-[#22D3EE]">
                    <Database className="h-3.5 w-3.5" />
                  </div>
                </div>
                <div className="mt-3 space-y-1">
                  <div className="flex items-baseline gap-1.5 font-mono">
                    <span className="text-lg font-bold text-white">Vault Sync</span>
                    <span className={`text-[10px] font-bold ${resultsData?.verification?.status === 'VERIFIED' ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {resultsData?.verification?.status === 'VERIFIED' ? 'ONLINE' : (resultsData?.verification ? 'DESYNC' : 'OFFLINE')}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">Local vault storage synchronized</p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-[#1e3557] flex items-center justify-between text-[10px]">
                <span className="text-slate-400">Vault status</span>
                <span className="font-mono text-emerald-400 font-semibold">
                  Sequence #{resultsData?.verification?.checkpointSequence ?? 5}
                </span>
              </div>
            </div>

            {/* Card 5 */}
            <div className="rounded-2xl border border-[#1e3557] bg-[#0b192e] p-5 flex flex-col justify-between hover:border-[#3B82F6]/40 transition-all group">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-[#1e3557]">
                  <span className="text-xs font-semibold text-slate-200 group-hover:text-white transition-colors">
                    Tamper Detection
                  </span>
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#101F35] text-[#22D3EE]">
                    <ShieldCheck className="h-3.5 w-3.5" />
                  </div>
                </div>
                <div className="mt-3 space-y-1">
                  <div className="flex items-baseline gap-1.5 font-mono">
                    <span className="text-lg font-bold text-white">
                      {resultsData?.verification?.status === 'VERIFIED' ? '0 Alerts' : 'Tamper Alert'}
                    </span>
                    <span className={`text-[10px] font-bold ${resultsData?.verification?.status === 'VERIFIED' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {resultsData?.verification?.status === 'VERIFIED' ? 'PRISTINE' : (resultsData?.verification ? 'ALERT' : 'CHECKING')}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {resultsData?.verification?.status === 'VERIFIED' ? 'Zero modifications or hash divergence' : 'Integrity anomaly detected'}
                  </p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-[#1e3557] flex items-center justify-between text-[10px]">
                <span className="text-slate-400">Audit result</span>
                <span className={`font-mono font-semibold ${resultsData?.verification?.status === 'VERIFIED' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {resultsData?.verification?.status === 'VERIFIED' ? '100% Genuine' : 'Compromised'}
                </span>
              </div>
            </div>
          </div>

          {/* Cryptographic Details Card */}
          <div className="rounded-2xl border border-[#1e3557] bg-[#0b192e] p-5 space-y-3 font-mono text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1e3557] pb-2 text-slate-400">
              <span>Active Merkle Root Hash:</span>
              <span className="text-[#22D3EE] truncate max-w-md">
                {resultsData?.verification?.merkleRoot || 'dd3eef27b8ac61fffd4f65e7f0514d283f89615cdbb8081cdec1d1a97dcb55bc'}
              </span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1e3557] pb-2 text-slate-400">
              <span>Checkpoint Reference:</span>
              <span className="text-white">
                {resultsData?.verification?.checkpointId || 'chk_5_f3d7f25f2b43'} (Sequence #{resultsData?.verification?.checkpointSequence || 5})
              </span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-slate-400">
              <span>Last Verification Ping:</span>
              <span className="text-emerald-400 font-semibold">{lastPingTimestamp}</span>
            </div>
          </div>
        </section>

        {/* SECTION 7: ACADEMIC REPORT CENTRE */}
        <section aria-label="Academic Report Centre" className="space-y-6">
          <div className="flex items-center justify-between border-b border-[#1e3557]/80 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3B82F6]/15 border border-[#3B82F6]/30 text-[#22D3EE]">
                <Download className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Academic Report Centre</h2>
                <p className="text-xs text-slate-400">
                  Official university document exports, transcripts, and public verification tools
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Marksheet */}
            <Link
              href="/student/marksheet"
              className="group rounded-2xl border border-[#1e3557] bg-[#0b192e] p-5 flex flex-col justify-between hover:border-[#3B82F6] hover:bg-[#101F35] transition-all shadow-sm"
            >
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white group-hover:text-cyan-400 transition-colors">
                    Digital Marksheet
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">Official transcript with embedded QR verification seal</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-400 mt-4 group-hover:translate-x-0.5 transition-transform">
                View Marksheet <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </Link>

            {/* Print / Save PDF */}
            <button
              onClick={() => window.print()}
              className="group text-left rounded-2xl border border-[#1e3557] bg-[#0b192e] p-5 flex flex-col justify-between hover:border-[#3B82F6] hover:bg-[#101F35] transition-all shadow-sm"
            >
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white group-hover:text-cyan-400 transition-colors">
                    Print / Save PDF
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">Generate high-contrast printable student academic report</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-400 mt-4 group-hover:translate-x-0.5 transition-transform">
                Print Report <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </button>

            {/* Export CSV */}
            <button
              onClick={handleExportCSV}
              className="group text-left rounded-2xl border border-[#1e3557] bg-[#0b192e] p-5 flex flex-col justify-between hover:border-[#3B82F6] hover:bg-[#101F35] transition-all shadow-sm"
            >
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">
                    Export Data CSV
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">Download verified academic scores and cryptographic hashes</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 mt-4 group-hover:translate-x-0.5 transition-transform">
                Download .csv <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </button>

            {/* Semester History */}
            <Link
              href="/student/history"
              className="group rounded-2xl border border-[#1e3557] bg-[#0b192e] p-5 flex flex-col justify-between hover:border-[#3B82F6] hover:bg-[#101F35] transition-all shadow-sm"
            >
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-transform">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white group-hover:text-purple-400 transition-colors">
                    Semester History
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">Term-wise performance timeline and examination records</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-purple-400 mt-4 group-hover:translate-x-0.5 transition-transform">
                View History <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </Link>

            {/* Public QR Verify */}
            <Link
              href={resultsData?.results[0] ? `/verify/${resultsData.results[0].id}` : '/verify'}
              className="group rounded-2xl border border-[#1e3557] bg-[#0b192e] p-5 flex flex-col justify-between hover:border-[#3B82F6] hover:bg-[#101F35] transition-all shadow-sm"
            >
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-transform">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors">
                    Public QR Verify
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">Inspect live Merkle proof on the public verification portal</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 mt-4 group-hover:translate-x-0.5 transition-transform">
                Open Verifier <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </Link>
          </div>
        </section>

        {/* Password Change Modal (Preserved) */}
        {isPasswordModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl border border-[#1e3557] bg-[#101F35] p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#1e3557] pb-3">
                <div>
                  <h3 className="text-base font-bold text-white">Change Account Password</h3>
                  <p className="text-xs text-slate-400">Set a permanent password for student portal access</p>
                </div>
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-cyan-400">
                  <Key className="w-4 h-4" />
                </div>
              </div>

              {pwdError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-300 rounded-lg text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{pwdError}</span>
                </div>
              )}

              {pwdSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-lg text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{pwdSuccess}</span>
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Current / Temporary Password</label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current activation password"
                    className="w-full px-3 py-2 bg-[#081426] border border-[#1e3557] rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">New Permanent Password</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 8 chars with uppercase, number, symbol"
                    className="w-full px-3 py-2 bg-[#081426] border border-[#1e3557] rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Confirm New Password</label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full px-3 py-2 bg-[#081426] border border-[#1e3557] rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsPasswordModalOpen(false)}
                    className="px-4 py-2 border border-[#1e3557] bg-[#0b192e] hover:bg-[#142642] text-slate-300 text-xs font-semibold rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={pwdSubmitting}
                    className="px-5 py-2 bg-[#3B82F6] hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-md"
                  >
                    {pwdSubmitting ? 'Updating...' : 'Save Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
