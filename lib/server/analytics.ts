import { dbService } from '../storage/db';
import { performSystemAudit } from '../audit/tamperDetector';
import { verifyResultCryptographically } from '../audit/publicVerifier';
import { getServerKeys } from './keys';
import {
  AcademicAnalyticsResponse,
  AnalyticsKpiCards,
  SubjectPerformance,
  ExaminationPerformance,
  GradeDistributionItem,
  StudentPerformanceDistributionItem,
  HighestLowestRecord,
  PassFailDistribution,
  PublicationTimelineItem,
  CryptographicAnalytics,
  DetailedAnalyticsRecord,
  UserRole,
} from '../types';

export interface AnalyticsFilterParams {
  exam?: string;
  subject?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export async function getAcademicAnalyticsData(
  params: AnalyticsFilterParams,
  userRole: UserRole,
  institutionId?: string
): Promise<AcademicAnalyticsResponse> {
  // 1. Ensure initial seed data is present
  await dbService.seedInitialData();

  const instId = institutionId || 'inst_verimark_01';

  // 2. Fetch raw database records scoped to institution
  const allResults = await dbService.getResults(instId);
  const publishedResults = allResults.filter(
    (r) => r.status === 'published' || r.status === 'corrected'
  );
  const ledgerEvents = await dbService.getLedgerEvents(instId);
  const checkpoints = await dbService.getCheckpoints(instId);
  const correctionRequests = await dbService.getCorrectionRequests(instId);
  const latestCheckpoint = checkpoints.length > 0 ? checkpoints[checkpoints.length - 1] : null;

  // 3. Cryptographic system audit scoped to institution
  const auditReport = await performSystemAudit(instId);

  // 4. Collect available filter options from published results
  const allExams = Array.from(new Set(publishedResults.map((r) => r.examName))).sort();
  const allSubjects = Array.from(new Set(publishedResults.map((r) => r.subject))).sort();

  const sortedDates = publishedResults
    .map((r) => r.publicationDate)
    .filter(Boolean)
    .sort();
  const earliestDate = sortedDates[0] || new Date().toISOString();
  const latestDate = sortedDates[sortedDates.length - 1] || new Date().toISOString();

  // 5. Apply filters
  let filtered = [...publishedResults];

  if (params.exam && params.exam !== 'ALL') {
    filtered = filtered.filter((r) => r.examName.toLowerCase() === params.exam!.toLowerCase());
  }

  if (params.subject && params.subject !== 'ALL') {
    filtered = filtered.filter((r) => r.subject.toLowerCase() === params.subject!.toLowerCase());
  }

  if (params.startDate) {
    const start = new Date(params.startDate).getTime();
    filtered = filtered.filter((r) => new Date(r.publicationDate).getTime() >= start);
  }

  if (params.endDate) {
    // End of selected day
    const end = new Date(params.endDate);
    end.setHours(23, 59, 59, 999);
    filtered = filtered.filter((r) => new Date(r.publicationDate).getTime() <= end.getTime());
  }

  if (params.search && params.search.trim() !== '') {
    const q = params.search.trim().toLowerCase();
    filtered = filtered.filter(
      (r) =>
        r.studentName.toLowerCase().includes(q) ||
        r.studentRegNo.toLowerCase().includes(q) ||
        r.subject.toLowerCase().includes(q)
    );
  }

  // 6. Perform genuine cryptographic verification for all filtered records
  const detailedRecords: DetailedAnalyticsRecord[] = [];
  let verifiedCount = 0;
  let failedCount = 0;

  for (const record of filtered) {
    const ver = await verifyResultCryptographically(record.id);
    const vStatus = ver.status === 'VERIFIED' ? 'VERIFIED' : ver.status === 'TAMPERED' ? 'TAMPERED' : 'UNAVAILABLE';

    if (vStatus === 'VERIFIED') verifiedCount++;
    else failedCount++;

    const percentage = Number(((record.marksObtained / (record.maxMarks || 100)) * 100).toFixed(2));

    detailedRecords.push({
      id: record.id,
      studentRegNo: record.studentRegNo,
      studentName: record.studentName,
      subject: record.subject,
      examName: record.examName,
      marksObtained: record.marksObtained,
      maxMarks: record.maxMarks,
      percentage,
      status: record.status,
      publicationDate: record.publicationDate,
      verificationStatus: vStatus,
      recordHash: record.recordHash,
      merkleLeafHash: record.merkleLeafHash,
      checkpointId: record.checkpointId,
    });
  }

  // Sort detailed records by Student Registration Number by default
  detailedRecords.sort((a, b) => a.studentRegNo.localeCompare(b.studentRegNo));

  // 7. Calculate KPIs
  const totalPublishedResults = filtered.length;
  const totalMarksSum = filtered.reduce((acc, r) => acc + r.marksObtained, 0);
  const totalMaxMarksSum = filtered.reduce((acc, r) => acc + (r.maxMarks || 100), 0);

  const averageMarks = totalPublishedResults > 0
    ? Number((totalMarksSum / totalPublishedResults).toFixed(2))
    : 0;

  const overallPercentage = totalMaxMarksSum > 0
    ? Number(((totalMarksSum / totalMaxMarksSum) * 100).toFixed(2))
    : 0;

  const totalExaminations = Array.from(new Set(filtered.map((r) => r.examName))).length;
  const pendingCorrectionRequests = correctionRequests.filter(
    (cr) => cr.status === 'pending_approvals' || cr.status === 'partially_approved'
  ).length;
  const approvedCorrections = correctionRequests.filter(
    (cr) => cr.status === 'approved_applied'
  ).length;

  const signedLedgerCheckpoints = checkpoints.length;

  let ledgerIntegrityStatus = 'SECURE — ALL PROOFS & SIGNATURES VALID';
  if (auditReport.overallStatus === 'TAMPER_DETECTED') {
    ledgerIntegrityStatus = 'COMPROMISED — RECOMPUTED HASH MISMATCH';
  } else if (auditReport.overallStatus === 'CHECKPOINT_MISMATCH') {
    ledgerIntegrityStatus = 'WARNING — CHECKPOINT DIVERGENCE';
  } else if (auditReport.overallStatus === 'CORRUPTED') {
    ledgerIntegrityStatus = 'CRITICAL — LEDGER CORRUPTION DETECTED';
  }

  const kpis: AnalyticsKpiCards = {
    totalPublishedResults,
    verifiedRecordsCount: verifiedCount,
    averageMarks,
    overallPercentage,
    totalExaminations,
    pendingCorrectionRequests,
    approvedCorrections,
    signedLedgerCheckpoints,
    ledgerIntegrityStatus,
  };

  // 8. Academic Performance: Subject-wise Breakdown
  const subjectMap = new Map<string, typeof filtered>();
  for (const r of filtered) {
    if (!subjectMap.has(r.subject)) {
      subjectMap.set(r.subject, []);
    }
    subjectMap.get(r.subject)!.push(r);
  }

  const subjectWise: SubjectPerformance[] = [];
  for (const [subject, recs] of subjectMap.entries()) {
    const sMarksSum = recs.reduce((acc, r) => acc + r.marksObtained, 0);
    const sMaxMarks = Math.max(...recs.map((r) => r.maxMarks || 100));
    const sAvgMarks = Number((sMarksSum / recs.length).toFixed(2));
    const sAvgPct = Number(((sAvgMarks / sMaxMarks) * 100).toFixed(2));
    const sHighest = Math.max(...recs.map((r) => r.marksObtained));
    const sLowest = Math.min(...recs.map((r) => r.marksObtained));
    const sPassCount = recs.filter((r) => (r.marksObtained / (r.maxMarks || 100)) >= 0.40).length;
    const sFailCount = recs.length - sPassCount;
    const sPassRate = Number(((sPassCount / recs.length) * 100).toFixed(1));

    subjectWise.push({
      subject,
      averageMarks: sAvgMarks,
      maxMarks: sMaxMarks,
      averagePercentage: sAvgPct,
      highestMark: sHighest,
      lowestMark: sLowest,
      studentCount: recs.length,
      passCount: sPassCount,
      failCount: sFailCount,
      passRate: sPassRate,
    });
  }
  subjectWise.sort((a, b) => b.averagePercentage - a.averagePercentage);

  // 9. Academic Performance: Exam-wise Breakdown
  const examMap = new Map<string, typeof filtered>();
  for (const r of filtered) {
    if (!examMap.has(r.examName)) {
      examMap.set(r.examName, []);
    }
    examMap.get(r.examName)!.push(r);
  }

  const examWise: ExaminationPerformance[] = [];
  for (const [examName, recs] of examMap.entries()) {
    const eMarksSum = recs.reduce((acc, r) => acc + r.marksObtained, 0);
    const eMaxMarks = Math.max(...recs.map((r) => r.maxMarks || 100));
    const eAvgMarks = Number((eMarksSum / recs.length).toFixed(2));
    const eAvgPct = Number(((eAvgMarks / eMaxMarks) * 100).toFixed(2));
    const eHighest = Math.max(...recs.map((r) => r.marksObtained));
    const eLowest = Math.min(...recs.map((r) => r.marksObtained));
    const ePassCount = recs.filter((r) => (r.marksObtained / (r.maxMarks || 100)) >= 0.40).length;
    const eFailCount = recs.length - ePassCount;
    const ePassRate = Number(((ePassCount / recs.length) * 100).toFixed(1));

    examWise.push({
      examName,
      studentCount: recs.length,
      averageMarks: eAvgMarks,
      averagePercentage: eAvgPct,
      highestMark: eHighest,
      lowestMark: eLowest,
      passCount: ePassCount,
      failCount: eFailCount,
      passRate: ePassRate,
    });
  }
  examWise.sort((a, b) => b.averagePercentage - a.averagePercentage);

  // 10. Grade Distribution
  const gradeBuckets = [
    { grade: 'O', label: 'Outstanding (90-100%)', minPercentage: 90, maxPercentage: 100, color: '#06b6d4' },
    { grade: 'A+', label: 'Excellent (80-89%)', minPercentage: 80, maxPercentage: 89.99, color: '#3b82f6' },
    { grade: 'A', label: 'Very Good (70-79%)', minPercentage: 70, maxPercentage: 79.99, color: '#10b981' },
    { grade: 'B+', label: 'Good (60-69%)', minPercentage: 60, maxPercentage: 69.99, color: '#f59e0b' },
    { grade: 'B', label: 'Above Average (50-59%)', minPercentage: 50, maxPercentage: 59.99, color: '#f97316' },
    { grade: 'C', label: 'Pass (40-49%)', minPercentage: 40, maxPercentage: 49.99, color: '#8b5cf6' },
    { grade: 'F', label: 'Fail (<40%)', minPercentage: 0, maxPercentage: 39.99, color: '#ef4444' },
  ];

  const gradeDistribution: GradeDistributionItem[] = gradeBuckets.map((bucket) => {
    const count = filtered.filter((r) => {
      const pct = (r.marksObtained / (r.maxMarks || 100)) * 100;
      return pct >= bucket.minPercentage && pct <= bucket.maxPercentage;
    }).length;

    const percentageOfCohort = totalPublishedResults > 0
      ? Number(((count / totalPublishedResults) * 100).toFixed(1))
      : 0;

    return {
      grade: bucket.grade,
      label: bucket.label,
      minPercentage: bucket.minPercentage,
      maxPercentage: bucket.maxPercentage,
      count,
      percentageOfCohort,
      color: bucket.color,
    };
  });

  // 11. Student Performance Distribution (Histogram buckets)
  const scoreBrackets = [
    { bracket: '90 - 100%', min: 90, max: 100 },
    { bracket: '80 - 89%', min: 80, max: 89.99 },
    { bracket: '70 - 79%', min: 70, max: 79.99 },
    { bracket: '60 - 69%', min: 60, max: 69.99 },
    { bracket: '50 - 59%', min: 50, max: 59.99 },
    { bracket: '< 50%', min: 0, max: 49.99 },
  ];

  const studentDistribution: StudentPerformanceDistributionItem[] = scoreBrackets.map((b) => {
    const count = filtered.filter((r) => {
      const pct = (r.marksObtained / (r.maxMarks || 100)) * 100;
      return pct >= b.min && pct <= b.max;
    }).length;
    const percentage = totalPublishedResults > 0
      ? Number(((count / totalPublishedResults) * 100).toFixed(1))
      : 0;
    return {
      bracket: b.bracket,
      min: b.min,
      max: b.max,
      count,
      percentage,
    };
  });

  // 12. Highest and Lowest Marks
  let highestMark: HighestLowestRecord | null = null;
  let lowestMark: HighestLowestRecord | null = null;

  if (filtered.length > 0) {
    const sortedByMarks = [...filtered].sort((a, b) => b.marksObtained - a.marksObtained);
    const top = sortedByMarks[0];
    const bottom = sortedByMarks[sortedByMarks.length - 1];

    highestMark = {
      mark: top.marksObtained,
      maxMarks: top.maxMarks,
      percentage: Number(((top.marksObtained / top.maxMarks) * 100).toFixed(2)),
      studentName: top.studentName,
      studentRegNo: top.studentRegNo,
      subject: top.subject,
      examName: top.examName,
    };

    lowestMark = {
      mark: bottom.marksObtained,
      maxMarks: bottom.maxMarks,
      percentage: Number(((bottom.marksObtained / bottom.maxMarks) * 100).toFixed(2)),
      studentName: bottom.studentName,
      studentRegNo: bottom.studentRegNo,
      subject: bottom.subject,
      examName: bottom.examName,
    };
  }

  // 13. Pass and Fail Distribution
  const examPassedCount = filtered.filter((r) => (r.marksObtained / (r.maxMarks || 100)) >= 0.40).length;
  const examFailedCount = filtered.length - examPassedCount;
  const passRate = filtered.length > 0
    ? Number(((examPassedCount / filtered.length) * 100).toFixed(1))
    : 0;
  const failRate = filtered.length > 0
    ? Number(((examFailedCount / filtered.length) * 100).toFixed(1))
    : 0;

  const passFail: PassFailDistribution = {
    passThresholdPercentage: 40,
    passedCount: examPassedCount,
    failedCount: examFailedCount,
    passRate,
    failRate,
  };

  // 14. Academic Trends: Publication Timeline
  const dateMap = new Map<string, { count: number; totalMarks: number; subjects: Set<string> }>();
  for (const r of filtered) {
    const dStr = r.publicationDate ? r.publicationDate.split('T')[0] : '2026-11-20';
    if (!dateMap.has(dStr)) {
      dateMap.set(dStr, { count: 0, totalMarks: 0, subjects: new Set() });
    }
    const entry = dateMap.get(dStr)!;
    entry.count++;
    entry.totalMarks += r.marksObtained;
    entry.subjects.add(r.subject);
  }

  const timeline: PublicationTimelineItem[] = [];
  for (const [date, entry] of Array.from(dateMap.entries()).sort()) {
    timeline.push({
      date,
      publishedCount: entry.count,
      averageMarks: Number((entry.totalMarks / entry.count).toFixed(2)),
      subjects: Array.from(entry.subjects),
    });
  }

  // 15. Cryptographic Analytics
  const keys = getServerKeys();
  const cryptographicAnalytics: CryptographicAnalytics = {
    totalLedgerEvents: ledgerEvents.length,
    signedCheckpoints: checkpoints.length,
    successfulVerificationCount: verifiedCount,
    failedVerificationCount: failedCount,
    detectedTamperingIncidents: auditReport.findings.filter(
      (f) => f.severity === 'CRITICAL' || f.severity === 'WARNING'
    ).length,
    correctionApprovalActivity: {
      totalRequests: correctionRequests.length,
      pendingApprovals: correctionRequests.filter(
        (cr) => cr.status === 'pending_approvals' || cr.status === 'partially_approved'
      ).length,
      approvedApplied: approvedCorrections,
      rejected: correctionRequests.filter((cr) => cr.status === 'rejected').length,
    },
    ledgerIntegrity: {
      status: auditReport.overallStatus,
      latestCheckpointSeq: latestCheckpoint?.sequenceNumber || 0,
      merkleRoot: latestCheckpoint?.merkleRoot || '',
      signerPublicKey: latestCheckpoint?.signerPublicKey || keys.ledgerAuthority.publicKey,
      independentVaultSynced: auditReport.independentCheckpointVerified,
    },
  };

  return {
    success: true,
    userRole,
    isDemoDataset: true,
    datasetNotice:
      'Hackathon Demonstration Dataset (5 Published Records, Immutable Ledger Chain, RFC 6962 Merkle Tree, Ed25519 Signatures Active)',
    kpis,
    academicPerformance: {
      subjectWise,
      examWise,
      gradeDistribution,
      studentDistribution,
      highestMark,
      lowestMark,
      passFail,
    },
    academicTrends: {
      timeline,
      hasMultipleSemesters: false,
      semesterNotice:
        'Single active semester recorded (Semester 6 / Spring 2026). Comparative semester trends will populate as future semester examinations are published.',
    },
    cryptographicAnalytics,
    detailedRecords,
    filterOptions: {
      examinations: allExams,
      subjects: allSubjects,
      dateRange: {
        earliest: earliestDate,
        latest: latestDate,
      },
    },
  };
}
