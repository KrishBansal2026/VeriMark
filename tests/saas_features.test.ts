import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { dbService } from '@/lib/storage/db';
import { checkRateLimit, resetRateLimiterForTesting } from '@/lib/server/rateLimiter';
import { POST as batchResultsRoute } from '@/app/api/results/batch/route';
import { GET as getStudentsRoute, POST as createStudentRoute } from '@/app/api/students/route';
import { GET as getExamsRoute, POST as createExamRoute } from '@/app/api/examinations/route';
import { GET as getUsersRoute, POST as createUserRoute } from '@/app/api/users/route';
import { createSessionToken } from '@/lib/server/auth';

describe('VeriMark Multi-Tenant SaaS Features & Endpoints', () => {
  const adminToken = createSessionToken({
    id: 'usr_admin_01',
    institutionId: 'inst_verimark_01',
    email: 'admin@verimark.edu',
    name: 'Admin',
    role: 'ADMIN',
  });

  const studentToken = createSessionToken({
    id: 'usr_student_101',
    institutionId: 'inst_verimark_01',
    email: 'aarav.sharma@student.verimark.edu',
    name: 'Aarav Sharma',
    role: 'STUDENT',
    studentRegNo: 'CF2026-CSE-101',
  });

  beforeEach(async () => {
    dbService.resetForTesting();
    await dbService.seedInitialData();
    resetRateLimiterForTesting();
  });

  describe('1. Sliding-Window Rate Limiter', () => {
    it('allows requests within threshold and blocks upon exceeding limit', () => {
      const key = 'test_ip_127_0_0_1';
      // 5 attempts limit
      for (let i = 0; i < 5; i++) {
        const res = checkRateLimit(key, 5, 60);
        expect(res.allowed).toBe(true);
        expect(res.remaining).toBe(5 - (i + 1));
      }

      // 6th attempt must be blocked
      const blocked = checkRateLimit(key, 5, 60);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
      expect(blocked.resetInSeconds).toBeGreaterThan(0);
    });
  });

  describe('2. Student Management Directory API', () => {
    it('retrieves student list for authenticated administrator', async () => {
      const req = new Request('http://localhost:3000/api/students', {
        method: 'GET',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const res = await getStudentsRoute(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.students)).toBe(true);
      expect(json.students.length).toBeGreaterThan(0);
    });

    it('rejects student role attempting to list student directory with 403', async () => {
      const req = new Request('http://localhost:3000/api/students', {
        method: 'GET',
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      const res = await getStudentsRoute(req);
      expect(res.status).toBe(403);
    });

    it('enrolls a new student profile with unique registration number', async () => {
      const req = new Request('http://localhost:3000/api/students', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          regNo: 'CF2026-CSE-999',
          fullName: 'Test Student New',
          email: 'test.new@student.verimark.edu',
          course: 'B.Tech Computer Science',
          department: 'Computer Science & Engineering',
          batchYear: '2022-2026',
        }),
      });

      const res = await createStudentRoute(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.student.regNo).toBe('CF2026-CSE-999');
    });
  });

  describe('3. Examination Management API', () => {
    it('lists examinations and allows exam creation', async () => {
      const listReq = new Request('http://localhost:3000/api/examinations', {
        method: 'GET',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const listRes = await getExamsRoute(listReq);
      expect(listRes.status).toBe(200);

      const createReq = new Request('http://localhost:3000/api/examinations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          examCode: 'MIDSEM-2026',
          examName: 'Mid Semester Examination 2026',
          semester: 'Semester 8',
          academicYear: '2025-2026',
          department: 'Computer Science & Engineering',
          conductedDate: '2026-05-15',
        }),
      });
      const createRes = await createExamRoute(createReq);
      expect(createRes.status).toBe(201);
      const json = await createRes.json();
      expect(json.success).toBe(true);
      expect(json.examination.examCode).toBe('MIDSEM-2026');
    });
  });

  describe('4. User & Access Management API', () => {
    it('allows administrator to list users and provision new staff', async () => {
      const listReq = new Request('http://localhost:3000/api/users', {
        method: 'GET',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const listRes = await getUsersRoute(listReq);
      expect(listRes.status).toBe(200);

      const createReq = new Request('http://localhost:3000/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: 'New Auditor Person',
          email: 'auditor.new@verimark.edu',
          role: 'AUDITOR',
        }),
      });
      const createRes = await createUserRoute(createReq);
      expect(createRes.status).toBe(201);
      const json = await createRes.json();
      expect(json.success).toBe(true);
      expect(json.user.email).toBe('auditor.new@verimark.edu');
      expect(json.temporaryPassword).toBeDefined();
    });
  });

  describe('5. Batch Marksheet Results Import', () => {
    it('imports and seals batch results into Merkle ledger', async () => {
      const req = new Request('http://localhost:3000/api/results/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          items: [
            {
              studentRegNo: 'CF2026-CSE-101',
              studentName: 'Aarav Sharma',
              course: 'B.Tech Computer Science',
              subject: 'Advanced Cryptography',
              examName: 'End Semester Examination 2026',
              marksObtained: 95,
              maxMarks: 100,
              publishImmediately: true,
            },
            {
              studentRegNo: 'CF2026-CSE-102',
              studentName: 'Bhavna Reddy',
              course: 'B.Tech Computer Science',
              subject: 'Advanced Cryptography',
              examName: 'End Semester Examination 2026',
              marksObtained: 90,
              maxMarks: 100,
              publishImmediately: true,
            },
          ],
        }),
      });

      const res = await batchResultsRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.count).toBe(2);
      expect(json.results[0].status).toBe('published');
      expect(json.results[0].recordHash).toBeDefined();
    });
  });
});
