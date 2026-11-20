import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { dbService } from '../lib/storage/db';
import { getDemoTokenForRole } from '../lib/server/auth';
import { resetCachedKeysForTesting } from '../lib/server/keys';
import { GET as analyticsRoute } from '../app/api/analytics/route';
import { middleware } from '../middleware';
import { NextRequest } from 'next/server';

describe('Academic Analytics Dashboard Integration Tests', () => {
  const adminAuth = getDemoTokenForRole('ADMIN');
  const controllerAuth = getDemoTokenForRole('EXAM_CONTROLLER');
  const deanAuth = getDemoTokenForRole('ACADEMIC_DEAN');
  const auditorAuth = getDemoTokenForRole('AUDITOR');
  const studentAuth = getDemoTokenForRole('STUDENT');

  beforeEach(async () => {
    dbService.resetForTesting();
    await dbService.seedInitialData();
  });

  afterEach(() => {
    resetCachedKeysForTesting();
  });

  describe('1. Access Control & Authorization (RBAC)', () => {
    it('rejects unauthenticated request to /api/analytics with HTTP 401', async () => {
      const req = new Request('http://localhost:3000/api/analytics');
      const res = await analyticsRoute(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain('Authentication required');
    });

    it('rejects STUDENT role from /api/analytics with HTTP 403 Forbidden', async () => {
      const req = new Request('http://localhost:3000/api/analytics', {
        headers: { Authorization: `Bearer ${studentAuth.token}` },
      });
      const res = await analyticsRoute(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain('Access denied');
    });

    it('allows ADMIN role full access to /api/analytics with HTTP 200', async () => {
      const req = new Request('http://localhost:3000/api/analytics', {
        headers: { Authorization: `Bearer ${adminAuth.token}` },
      });
      const res = await analyticsRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.userRole).toBe('ADMIN');
      expect(json.kpis).toBeDefined();
    });

    it('allows EXAM_CONTROLLER role access to /api/analytics with HTTP 200', async () => {
      const req = new Request('http://localhost:3000/api/analytics', {
        headers: { Authorization: `Bearer ${controllerAuth.token}` },
      });
      const res = await analyticsRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.userRole).toBe('EXAM_CONTROLLER');
    });

    it('allows ACADEMIC_DEAN role access to /api/analytics with HTTP 200', async () => {
      const req = new Request('http://localhost:3000/api/analytics', {
        headers: { Authorization: `Bearer ${deanAuth.token}` },
      });
      const res = await analyticsRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.userRole).toBe('ACADEMIC_DEAN');
    });

    it('allows AUDITOR role access to /api/analytics with HTTP 200', async () => {
      const req = new Request('http://localhost:3000/api/analytics', {
        headers: { Authorization: `Bearer ${auditorAuth.token}` },
      });
      const res = await analyticsRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.userRole).toBe('AUDITOR');
    });

    it('middleware blocks STUDENT role from visiting /analytics and redirects to /access-denied', async () => {
      const req = new NextRequest('http://localhost:3000/analytics', {
        headers: {
          cookie: `verimark_session=${encodeURIComponent(studentAuth.token)}`,
        },
      });

      const res = await middleware(req);
      expect(res.status).toBe(307);
      const location = res.headers.get('location');
      expect(location).toContain('/access-denied');
      expect(location).toContain('reason=student_restricted');
      expect(location).toContain('path=%2Fanalytics');
    });

    it('middleware blocks STUDENT role from calling /api/analytics with JSON 403', async () => {
      const req = new NextRequest('http://localhost:3000/api/analytics', {
        headers: {
          cookie: `verimark_session=${encodeURIComponent(studentAuth.token)}`,
        },
      });

      const res = await middleware(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain('Forbidden');
    });
  });

  describe('2. Accurate KPI & Data Integrity Calculations', () => {
    it('computes accurate executive KPIs from the 5 seeded records', async () => {
      const req = new Request('http://localhost:3000/api/analytics', {
        headers: { Authorization: `Bearer ${adminAuth.token}` },
      });
      const res = await analyticsRoute(req);
      const json = await res.json();

      expect(json.kpis.totalPublishedResults).toBe(5);
      expect(json.kpis.verifiedRecordsCount).toBe(5);
      expect(json.kpis.signedLedgerCheckpoints).toBeGreaterThanOrEqual(1);
      expect(json.kpis.ledgerIntegrityStatus).toContain('SECURE');

      // Check average marks (seeded marks: 88, 92, 79, 85, 94 -> sum 438 / 5 = 87.6)
      expect(json.kpis.averageMarks).toBeGreaterThan(70);
      expect(json.kpis.overallPercentage).toBeGreaterThan(70);
      expect(json.isDemoDataset).toBe(true);
      expect(json.datasetNotice).toContain('Hackathon Demonstration Dataset');
    });

    it('confirms every detailed record has genuine cryptographic verification', async () => {
      const req = new Request('http://localhost:3000/api/analytics', {
        headers: { Authorization: `Bearer ${adminAuth.token}` },
      });
      const res = await analyticsRoute(req);
      const json = await res.json();

      expect(json.detailedRecords.length).toBe(5);
      for (const rec of json.detailedRecords) {
        expect(rec.verificationStatus).toBe('VERIFIED');
        expect(rec.recordHash).toBeDefined();
        expect(rec.recordHash.length).toBe(64);
        expect(rec.percentage).toBe(Number(((rec.marksObtained / rec.maxMarks) * 100).toFixed(2)));
      }
    });

    it('calculates accurate academic performance breakdowns (subjects, grades, extremes)', async () => {
      const req = new Request('http://localhost:3000/api/analytics', {
        headers: { Authorization: `Bearer ${adminAuth.token}` },
      });
      const res = await analyticsRoute(req);
      const json = await res.json();

      // Subjects
      expect(json.academicPerformance.subjectWise.length).toBeGreaterThanOrEqual(1);
      for (const sub of json.academicPerformance.subjectWise) {
        expect(sub.averageMarks).toBeGreaterThan(0);
        expect(sub.passRate).toBeGreaterThanOrEqual(0);
        expect(sub.studentCount).toBeGreaterThanOrEqual(1);
      }

      // Grade Distribution sum must equal total published records
      const totalInGrades = json.academicPerformance.gradeDistribution.reduce(
        (sum: number, g: any) => sum + g.count,
        0
      );
      expect(totalInGrades).toBe(5);

      // Highest and lowest
      expect(json.academicPerformance.highestMark).toBeDefined();
      expect(json.academicPerformance.lowestMark).toBeDefined();
      expect(json.academicPerformance.highestMark.mark).toBeGreaterThanOrEqual(
        json.academicPerformance.lowestMark.mark
      );

      // Pass/Fail
      expect(json.academicPerformance.passFail.passedCount).toBe(5);
      expect(json.academicPerformance.passFail.failedCount).toBe(0);
      expect(json.academicPerformance.passFail.passRate).toBe(100);
    });

    it('returns informative empty state for multi-semester comparisons', async () => {
      const req = new Request('http://localhost:3000/api/analytics', {
        headers: { Authorization: `Bearer ${adminAuth.token}` },
      });
      const res = await analyticsRoute(req);
      const json = await res.json();

      expect(json.academicTrends.hasMultipleSemesters).toBe(false);
      expect(json.academicTrends.semesterNotice).toContain('Single active semester recorded');
    });
  });

  describe('3. Filter Consistency & Interactive Features', () => {
    it('filters accurately by subject query parameter', async () => {
      const subject = 'Cryptography & Network Security';
      const req = new Request(
        `http://localhost:3000/api/analytics?subject=${encodeURIComponent(subject)}`,
        {
          headers: { Authorization: `Bearer ${adminAuth.token}` },
        }
      );
      const res = await analyticsRoute(req);
      const json = await res.json();

      expect(json.success).toBe(true);
      for (const rec of json.detailedRecords) {
        expect(rec.subject.toLowerCase()).toBe(subject.toLowerCase());
      }
      expect(json.kpis.totalPublishedResults).toBe(json.detailedRecords.length);
    });

    it('filters accurately by search query (student name or reg number)', async () => {
      const search = 'Aarav';
      const req = new Request(
        `http://localhost:3000/api/analytics?search=${encodeURIComponent(search)}`,
        {
          headers: { Authorization: `Bearer ${adminAuth.token}` },
        }
      );
      const res = await analyticsRoute(req);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.detailedRecords.length).toBe(1);
      expect(json.detailedRecords[0].studentName).toContain('Aarav');
      expect(json.kpis.totalPublishedResults).toBe(1);
    });

    it('returns empty-state dataset gracefully when filter yields 0 records', async () => {
      const req = new Request(
        'http://localhost:3000/api/analytics?subject=NonExistentSubject999',
        {
          headers: { Authorization: `Bearer ${adminAuth.token}` },
        }
      );
      const res = await analyticsRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.kpis.totalPublishedResults).toBe(0);
      expect(json.kpis.verifiedRecordsCount).toBe(0);
      expect(json.kpis.averageMarks).toBe(0);
      expect(json.detailedRecords.length).toBe(0);
      expect(json.academicPerformance.highestMark).toBeNull();
      expect(json.academicPerformance.lowestMark).toBeNull();
    });
  });
});
