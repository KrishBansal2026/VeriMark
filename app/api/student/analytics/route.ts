import { NextResponse } from 'next/server';
import { dbService } from '@/lib/storage/db';
import { requireAuth, AuthError } from '@/lib/server/auth';
import { verifyResultCryptographically } from '@/lib/audit/publicVerifier';
import {
  PersonalStudentAnalyticsResponse,
  StudentMidEndTermComparison,
  StudentTrendPoint,
  StudentDiagnosticAlert,
  StudentSubjectAverage,
  StudentPassFailDistribution,
  StudentExtremes,
  StudentComparisonTableRow,
} from '@/lib/types';

function computeGrade(percentage: number): string {
  if (percentage >= 90) return 'O';
  if (percentage >= 80) return 'A+';
  if (percentage >= 70) return 'A';
  if (percentage >= 60) return 'B+';
  if (percentage >= 50) return 'B';
  if (percentage >= 40) return 'C';
  return 'F';
}

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request, ['STUDENT', 'ADMIN']);

    const url = new URL(request.url);
    const requestedRegNo = url.searchParams.get('regNo');
    const benchmarkParam = url.searchParams.get('benchmark');
    const benchmark = benchmarkParam ? Math.max(0, Math.min(100, Number(benchmarkParam))) : 40;

    let targetRegNo = user.studentRegNo;

    // Strict Backend Ownership Enforcement
    if (user.role === 'STUDENT') {
      if (!user.studentRegNo) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: Student session is not bound to a valid registration number' },
          { status: 403 }
        );
      }
      if (requestedRegNo && requestedRegNo.trim().toUpperCase() !== user.studentRegNo.trim().toUpperCase()) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: You are not authorized to access private academic records of another student' },
          { status: 403 }
        );
      }
      targetRegNo = user.studentRegNo;
    } else if (user.role === 'ADMIN') {
      targetRegNo = requestedRegNo || user.studentRegNo || 'CF2026-CSE-101';
    }

    if (!targetRegNo) {
      return NextResponse.json({ success: false, error: 'Registration number required' }, { status: 400 });
    }

    // Retrieve only authenticated student records
    const results = await dbService.getResultsByStudentRegNo(targetRegNo);

    if (!results || results.length === 0) {
      return NextResponse.json({
        success: true,
        studentRegNo: targetRegNo,
        studentName: user.name,
        course: 'Not Enrolled',
        benchmark,
        isSingleExam: true,
        examCount: 0,
        subjectCount: 0,
        midVsEndTerm: [],
        trends: [],
        diagnosticAlerts: {
          alerts: [],
          allClear: true,
          benchmark,
          message: 'No published examination records found for this student account.',
        },
        subjectAverages: [],
        passFail: {
          passedCount: 0,
          failedCount: 0,
          passRate: 0,
          failRate: 0,
          benchmark,
        },
        extremes: {
          highest: null,
          lowest: null,
          variance: 0,
          isSingleSubject: true,
        },
        comparisonTable: [],
      });
    }

    // 1. Group records by subject for Mid-Term vs End-Term comparison
    const subjectsMap = new Map<string, typeof results>();
    for (const r of results) {
      const existing = subjectsMap.get(r.subject) || [];
      existing.push(r);
      subjectsMap.set(r.subject, existing);
    }

    const midVsEndTerm: StudentMidEndTermComparison[] = [];
    subjectsMap.forEach((subjectResults, subjectName) => {
      let midTermMarks: number | null = null;
      let endTermMarks: number | null = null;
      let maxMarks = 100;

      for (const r of subjectResults) {
        maxMarks = r.maxMarks || 100;
        const examLower = r.examName.toLowerCase();
        if (examLower.includes('mid') || examLower.includes('internal') || examLower.includes('term 1')) {
          midTermMarks = r.marksObtained;
        } else if (
          examLower.includes('end') ||
          examLower.includes('semester') ||
          examLower.includes('final') ||
          examLower.includes('term 2')
        ) {
          endTermMarks = r.marksObtained;
        } else {
          // If neither contains mid or end, categorize as available exam
          endTermMarks = r.marksObtained;
        }
      }

      midVsEndTerm.push({
        subject: subjectName,
        midTermMarks,
        endTermMarks,
        maxMarks,
        hasMidTerm: midTermMarks !== null,
        hasEndTerm: endTermMarks !== null,
      });
    });

    // 2. Examination Performance Trends (Chronological)
    const sortedChronological = [...results].sort(
      (a, b) => new Date(a.publicationDate).getTime() - new Date(b.publicationDate).getTime()
    );

    const trends: StudentTrendPoint[] = sortedChronological.map((r) => ({
      examName: r.examName,
      publicationDate: r.publicationDate,
      marksObtained: r.marksObtained,
      maxMarks: r.maxMarks,
      percentage: Number(((r.marksObtained / (r.maxMarks || 100)) * 100).toFixed(2)),
    }));

    // 3. Performance Diagnostic Alerts (Evaluated against benchmark)
    const diagnosticAlertsList: StudentDiagnosticAlert[] = [];
    for (const r of results) {
      const pct = Number(((r.marksObtained / (r.maxMarks || 100)) * 100).toFixed(2));
      if (pct < benchmark) {
        diagnosticAlertsList.push({
          subject: r.subject,
          marksObtained: r.marksObtained,
          maxMarks: r.maxMarks,
          percentage: pct,
          benchmark,
          deficit: Number((benchmark - pct).toFixed(2)),
          status: 'BELOW_BENCHMARK',
        });
      }
    }

    const allClear = diagnosticAlertsList.length === 0;
    const diagnosticAlertMessage = allClear
      ? `All registered subjects meet or exceed the active diagnostic benchmark of ${benchmark}%. No academic remediation warnings detected.`
      : `${diagnosticAlertsList.length} subject(s) currently score below the university diagnostic threshold of ${benchmark}%. Academic attention recommended.`;

    // 4. Subject Averages & Metrics
    const subjectAverages: StudentSubjectAverage[] = results.map((r) => {
      const pct = Number(((r.marksObtained / (r.maxMarks || 100)) * 100).toFixed(2));
      return {
        subject: r.subject,
        marksObtained: r.marksObtained,
        maxMarks: r.maxMarks,
        percentage: pct,
        grade: computeGrade(pct),
        status: pct >= benchmark ? 'PASS' : 'FAIL',
      };
    });

    // 5. Pass / Fail Distribution
    const passedCount = results.filter(
      (r) => ((r.marksObtained / (r.maxMarks || 100)) * 100) >= benchmark
    ).length;
    const failedCount = results.length - passedCount;
    const passRate = results.length > 0 ? Number(((passedCount / results.length) * 100).toFixed(2)) : 0;
    const failRate = results.length > 0 ? Number(((failedCount / results.length) * 100).toFixed(2)) : 0;

    const passFail: StudentPassFailDistribution = {
      passedCount,
      failedCount,
      passRate,
      failRate,
      benchmark,
    };

    // 6. Highest vs Lowest Marks
    const sortedByMarks = [...results].sort((a, b) => {
      const pctA = a.marksObtained / (a.maxMarks || 100);
      const pctB = b.marksObtained / (b.maxMarks || 100);
      return pctB - pctA;
    });

    const top = sortedByMarks[0];
    const bottom = sortedByMarks[sortedByMarks.length - 1];

    const highest = {
      subject: top.subject,
      marksObtained: top.marksObtained,
      maxMarks: top.maxMarks,
      percentage: Number(((top.marksObtained / (top.maxMarks || 100)) * 100).toFixed(2)),
      examName: top.examName,
    };

    const lowest = {
      subject: bottom.subject,
      marksObtained: bottom.marksObtained,
      maxMarks: bottom.maxMarks,
      percentage: Number(((bottom.marksObtained / (bottom.maxMarks || 100)) * 100).toFixed(2)),
      examName: bottom.examName,
    };

    const variance = Number((highest.marksObtained - lowest.marksObtained).toFixed(2));
    const isSingleSubject = results.length === 1;

    const extremes: StudentExtremes = {
      highest,
      lowest,
      variance,
      isSingleSubject,
    };

    // 7. Comparison Table Rows (with cryptographic verification)
    const comparisonTable: StudentComparisonTableRow[] = [];
    for (const r of results) {
      const ver = await verifyResultCryptographically(r.id);
      const isVerified = ver.status === 'VERIFIED';
      const pct = Number(((r.marksObtained / (r.maxMarks || 100)) * 100).toFixed(2));
      const examLower = r.examName.toLowerCase();
      const isMid = examLower.includes('mid') || examLower.includes('internal');

      comparisonTable.push({
        id: r.id,
        subject: r.subject,
        examName: r.examName,
        midTermMarks: isMid ? r.marksObtained : null,
        endTermMarks: !isMid ? r.marksObtained : null,
        totalMarks: r.marksObtained,
        maxMarks: r.maxMarks,
        percentage: pct,
        grade: computeGrade(pct),
        status: pct >= benchmark ? 'PASS' : 'FAIL',
        merkleIndex: r.merkleIndex ?? 0,
        recordHash: r.recordHash,
        verificationStatus: isVerified ? 'VERIFIED' : 'TAMPERED',
      });
    }

    const distinctExams = Array.from(new Set(results.map((r) => r.examName)));

    const responseData: PersonalStudentAnalyticsResponse = {
      success: true,
      studentRegNo: targetRegNo,
      studentName: results[0]?.studentName || user.name,
      course: results[0]?.course || 'B.Tech Computer Science & Engineering',
      benchmark,
      isSingleExam: distinctExams.length <= 1,
      examCount: distinctExams.length,
      subjectCount: results.length,
      midVsEndTerm,
      trends,
      diagnosticAlerts: {
        alerts: diagnosticAlertsList,
        allClear,
        benchmark,
        message: diagnosticAlertMessage,
      },
      subjectAverages,
      passFail,
      extremes,
      comparisonTable,
    };

    return NextResponse.json(responseData, { status: 200 });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
