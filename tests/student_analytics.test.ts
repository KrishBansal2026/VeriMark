import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { getDemoTokenForRole } from '@/lib/server/auth';
import { dbService } from '@/lib/storage/db';
import { resetCachedKeysForTesting } from '@/lib/server/keys';
import { GET as studentAnalyticsRoute } from '@/app/api/student/analytics/route';

describe('Personal Student Analytics Graph System & Ownership Enforcement Tests', () => {
  const origEnv = process.env.NODE_ENV;

  beforeAll(async () => {
    dbService.resetForTesting();
    await dbService.seedInitialData();
  });

  afterEach(() => {
    process.env.NODE_ENV = origEnv;
    resetCachedKeysForTesting();
  });

  describe('1. Authentication & Role-Based Access Control', () => {
    it('1.1: Rejects unauthenticated request to /api/student/analytics with HTTP 401', async () => {
      const req = new Request('http://localhost:3000/api/student/analytics');
      const res = await studentAnalyticsRoute(req);
      expect(res.status).toBe(401);

      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it('1.2: Allows authenticated STUDENT role to access /api/student/analytics with HTTP 200', async () => {
      const studentAuth = getDemoTokenForRole('STUDENT', 'CF2026-CSE-101');
      const req = new Request('http://localhost:3000/api/student/analytics', {
        headers: { Authorization: `Bearer ${studentAuth.token}` },
      });

      const res = await studentAnalyticsRoute(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.studentRegNo).toBe('CF2026-CSE-101');
    });

    it('1.3: Allows authenticated ADMIN role to access /api/student/analytics with HTTP 200', async () => {
      const adminAuth = getDemoTokenForRole('ADMIN');
      const req = new Request('http://localhost:3000/api/student/analytics?regNo=CF2026-CSE-102', {
        headers: { Authorization: `Bearer ${adminAuth.token}` },
      });

      const res = await studentAnalyticsRoute(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.studentRegNo).toBe('CF2026-CSE-102');
      expect(json.studentName).toBe('Bhavna Reddy');
    });
  });

  describe('2. Strict Student Ownership & IDOR Protection', () => {
    it('2.1: Student 101 attempting to view Student 102 analytics is blocked with HTTP 403 Forbidden', async () => {
      const studentAuth = getDemoTokenForRole('STUDENT', 'CF2026-CSE-101');
      const req = new Request('http://localhost:3000/api/student/analytics?regNo=CF2026-CSE-102', {
        headers: { Authorization: `Bearer ${studentAuth.token}` },
      });

      const res = await studentAnalyticsRoute(req);
      expect(res.status).toBe(403);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/Forbidden.*not authorized.*another student/i);
    });

    it('2.2: Student 102 attempting to view Student 105 analytics is blocked with HTTP 403 Forbidden', async () => {
      const studentAuth = getDemoTokenForRole('STUDENT', 'CF2026-CSE-102');
      const req = new Request('http://localhost:3000/api/student/analytics?regNo=CF2026-CSE-105', {
        headers: { Authorization: `Bearer ${studentAuth.token}` },
      });

      const res = await studentAnalyticsRoute(req);
      expect(res.status).toBe(403);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/Forbidden.*not authorized.*another student/i);
    });

    it('2.3: Student with matching regNo in query receives their own data without error', async () => {
      const studentAuth = getDemoTokenForRole('STUDENT', 'CF2026-CSE-101');
      const req = new Request('http://localhost:3000/api/student/analytics?regNo=CF2026-CSE-101', {
        headers: { Authorization: `Bearer ${studentAuth.token}` },
      });

      const res = await studentAnalyticsRoute(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.studentRegNo).toBe('CF2026-CSE-101');
    });
  });

  describe('3. Student Personalisation & Verification Across Multiple Accounts', () => {
    it('3.1: Aarav Sharma (CF2026-CSE-101) sees only Cryptography & Network Security with 88 marks', async () => {
      const studentAuth = getDemoTokenForRole('STUDENT', 'CF2026-CSE-101');
      const req = new Request('http://localhost:3000/api/student/analytics', {
        headers: { Authorization: `Bearer ${studentAuth.token}` },
      });

      const res = await studentAnalyticsRoute(req);
      const json = await res.json();

      expect(json.studentName).toBe('Aarav Sharma');
      expect(json.subjectCount).toBe(1);
      expect(json.subjectAverages[0].subject).toBe('Cryptography & Network Security');
      expect(json.subjectAverages[0].marksObtained).toBe(88);
      expect(json.subjectAverages[0].percentage).toBe(88);
      expect(json.subjectAverages[0].grade).toBe('A+');
      expect(json.extremes.highest.marksObtained).toBe(88);
      expect(json.extremes.lowest.marksObtained).toBe(88);
    });

    it('3.2: Bhavna Reddy (CF2026-CSE-102) sees only Distributed Ledger Technologies with 94 marks', async () => {
      const studentAuth = getDemoTokenForRole('STUDENT', 'CF2026-CSE-102');
      const req = new Request('http://localhost:3000/api/student/analytics', {
        headers: { Authorization: `Bearer ${studentAuth.token}` },
      });

      const res = await studentAnalyticsRoute(req);
      const json = await res.json();

      expect(json.studentName).toBe('Bhavna Reddy');
      expect(json.subjectCount).toBe(1);
      expect(json.subjectAverages[0].subject).toBe('Distributed Ledger Technologies');
      expect(json.subjectAverages[0].marksObtained).toBe(94);
      expect(json.subjectAverages[0].percentage).toBe(94);
      expect(json.subjectAverages[0].grade).toBe('O');
      expect(json.extremes.highest.marksObtained).toBe(94);
    });

    it('3.3: Chetan Verma (CF2026-CSE-103) sees only Database Systems Architecture with 76 marks', async () => {
      const studentAuth = getDemoTokenForRole('STUDENT', 'CF2026-CSE-103');
      const req = new Request('http://localhost:3000/api/student/analytics', {
        headers: { Authorization: `Bearer ${studentAuth.token}` },
      });

      const res = await studentAnalyticsRoute(req);
      const json = await res.json();

      expect(json.studentName).toBe('Chetan Verma');
      expect(json.subjectCount).toBe(1);
      expect(json.subjectAverages[0].subject).toBe('Database Systems Architecture');
      expect(json.subjectAverages[0].marksObtained).toBe(76);
      expect(json.subjectAverages[0].percentage).toBe(76);
      expect(json.subjectAverages[0].grade).toBe('A');
    });

    it('3.4: Divya Nair (CF2026-CSE-104) sees Operating Systems & Security with 91 marks', async () => {
      const studentAuth = getDemoTokenForRole('STUDENT', 'CF2026-CSE-104');
      const req = new Request('http://localhost:3000/api/student/analytics', {
        headers: { Authorization: `Bearer ${studentAuth.token}` },
      });

      const res = await studentAnalyticsRoute(req);
      const json = await res.json();

      expect(json.studentName).toBe('Divya Nair');
      expect(json.subjectAverages[0].subject).toBe('Operating Systems & Security');
      expect(json.subjectAverages[0].marksObtained).toBe(91);
      expect(json.subjectAverages[0].grade).toBe('O');
    });

    it('3.5: Eshan Roy (CF2026-CSE-105) sees Algorithm Design & Analysis with 83 marks', async () => {
      const studentAuth = getDemoTokenForRole('STUDENT', 'CF2026-CSE-105');
      const req = new Request('http://localhost:3000/api/student/analytics', {
        headers: { Authorization: `Bearer ${studentAuth.token}` },
      });

      const res = await studentAnalyticsRoute(req);
      const json = await res.json();

      expect(json.studentName).toBe('Eshan Roy');
      expect(json.subjectAverages[0].subject).toBe('Algorithm Design & Analysis');
      expect(json.subjectAverages[0].marksObtained).toBe(83);
      expect(json.subjectAverages[0].grade).toBe('A+');
    });
  });

  describe('4. Complete 7 Analytics Graph & Table Structures', () => {
    it('4.1: Subject-wise Mid-Term vs End-Term grouped bar chart data is accurately formed without fabricating Mid-Term', async () => {
      const studentAuth = getDemoTokenForRole('STUDENT', 'CF2026-CSE-101');
      const req = new Request('http://localhost:3000/api/student/analytics', {
        headers: { Authorization: `Bearer ${studentAuth.token}` },
      });

      const res = await studentAnalyticsRoute(req);
      const json = await res.json();

      expect(Array.isArray(json.midVsEndTerm)).toBe(true);
      expect(json.midVsEndTerm.length).toBe(1);
      const item = json.midVsEndTerm[0];
      expect(item.subject).toBe('Cryptography & Network Security');
      expect(item.endTermMarks).toBe(88);
      // Data integrity: Mid-term is honestly null (not fabricated)
      expect(item.midTermMarks).toBeNull();
      expect(item.hasMidTerm).toBe(false);
      expect(item.hasEndTerm).toBe(true);
    });

    it('4.2: Examination Performance Trends line chart reflects actual chronological history', async () => {
      const studentAuth = getDemoTokenForRole('STUDENT', 'CF2026-CSE-101');
      const req = new Request('http://localhost:3000/api/student/analytics', {
        headers: { Authorization: `Bearer ${studentAuth.token}` },
      });

      const res = await studentAnalyticsRoute(req);
      const json = await res.json();

      expect(Array.isArray(json.trends)).toBe(true);
      expect(json.trends.length).toBe(1);
      expect(json.trends[0].examName).toBe('End Semester Examination 2026');
      expect(json.trends[0].percentage).toBe(88);
      expect(json.isSingleExam).toBe(true);
    });

    it('4.3: Performance Diagnostic Alerts identify subjects below benchmark dynamically', async () => {
      const studentAuth = getDemoTokenForRole('STUDENT', 'CF2026-CSE-103'); // Chetan has 76%

      // With default 40% benchmark -> All Clear
      const req40 = new Request('http://localhost:3000/api/student/analytics?benchmark=40', {
        headers: { Authorization: `Bearer ${studentAuth.token}` },
      });
      const res40 = await studentAnalyticsRoute(req40);
      const json40 = await res40.json();
      expect(json40.diagnosticAlerts.allClear).toBe(true);
      expect(json40.diagnosticAlerts.alerts.length).toBe(0);

      // With 80% benchmark -> Triggers alert for 76%
      const req80 = new Request('http://localhost:3000/api/student/analytics?benchmark=80', {
        headers: { Authorization: `Bearer ${studentAuth.token}` },
      });
      const res80 = await studentAnalyticsRoute(req80);
      const json80 = await res80.json();
      expect(json80.diagnosticAlerts.allClear).toBe(false);
      expect(json80.diagnosticAlerts.alerts.length).toBe(1);
      expect(json80.diagnosticAlerts.alerts[0].subject).toBe('Database Systems Architecture');
      expect(json80.diagnosticAlerts.alerts[0].deficit).toBe(4); // 80 - 76 = 4
      expect(json80.diagnosticAlerts.alerts[0].status).toBe('BELOW_BENCHMARK');
    });

    it('4.4: Course/Subject Average Marks Comparison bar chart data reflects authentic marks', async () => {
      const studentAuth = getDemoTokenForRole('STUDENT', 'CF2026-CSE-101');
      const req = new Request('http://localhost:3000/api/student/analytics', {
        headers: { Authorization: `Bearer ${studentAuth.token}` },
      });

      const res = await studentAnalyticsRoute(req);
      const json = await res.json();

      expect(json.subjectAverages.length).toBe(1);
      expect(json.subjectAverages[0].marksObtained).toBe(88);
      expect(json.subjectAverages[0].maxMarks).toBe(100);
      expect(json.subjectAverages[0].status).toBe('PASS');
    });

    it('4.5: Pass/Fail Assessment Distribution donut chart calculates accurately from student marks', async () => {
      const studentAuth = getDemoTokenForRole('STUDENT', 'CF2026-CSE-101');
      const req = new Request('http://localhost:3000/api/student/analytics?benchmark=40', {
        headers: { Authorization: `Bearer ${studentAuth.token}` },
      });

      const res = await studentAnalyticsRoute(req);
      const json = await res.json();

      expect(json.passFail.passedCount).toBe(1);
      expect(json.passFail.failedCount).toBe(0);
      expect(json.passFail.passRate).toBe(100);
      expect(json.passFail.failRate).toBe(0);
    });

    it('4.6: Highest vs Lowest Marks grouped bar chart identifies boundaries and handles single subject honestly', async () => {
      const studentAuth = getDemoTokenForRole('STUDENT', 'CF2026-CSE-101');
      const req = new Request('http://localhost:3000/api/student/analytics', {
        headers: { Authorization: `Bearer ${studentAuth.token}` },
      });

      const res = await studentAnalyticsRoute(req);
      const json = await res.json();

      expect(json.extremes.isSingleSubject).toBe(true);
      expect(json.extremes.highest.marksObtained).toBe(88);
      expect(json.extremes.lowest.marksObtained).toBe(88);
      expect(json.extremes.variance).toBe(0);
    });

    it('4.7: Subject-by-Subject Examination Comparison Table has verified cryptographic status', async () => {
      const studentAuth = getDemoTokenForRole('STUDENT', 'CF2026-CSE-101');
      const req = new Request('http://localhost:3000/api/student/analytics', {
        headers: { Authorization: `Bearer ${studentAuth.token}` },
      });

      const res = await studentAnalyticsRoute(req);
      const json = await res.json();

      expect(json.comparisonTable.length).toBe(1);
      const row = json.comparisonTable[0];
      expect(row.subject).toBe('Cryptography & Network Security');
      expect(row.examName).toBe('End Semester Examination 2026');
      expect(row.midTermMarks).toBeNull();
      expect(row.endTermMarks).toBe(88);
      expect(row.totalMarks).toBe(88);
      expect(row.verificationStatus).toBe('VERIFIED');
      expect(row.recordHash).toBe('2df321ced340a17e191b5a8486e6502281f0565a0d872172abfb445bf418b1e9');
    });
  });
});
