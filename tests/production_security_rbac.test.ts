import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';
import {
  authenticateCredentials,
  createSessionToken,
  verifySessionToken,
  getDemoTokenForRole,
} from '@/lib/server/auth';
import { dbService } from '@/lib/storage/db';
import { resetCachedKeysForTesting } from '@/lib/server/keys';

import { GET as meRoute } from '@/app/api/auth/me/route';
import { POST as loginRoute } from '@/app/api/auth/login/route';
import { POST as logoutRoute } from '@/app/api/auth/logout/route';
import { GET as resultsGetRoute, POST as resultsPostRoute } from '@/app/api/results/route';
import { POST as publishRoute } from '@/app/api/results/[id]/publish/route';
import { GET as correctionsGetRoute, POST as correctionsPostRoute } from '@/app/api/corrections/route';
import { POST as approveCorrectionRoute } from '@/app/api/corrections/[id]/approve/route';
import { GET as auditGetRoute } from '@/app/api/audit/route';
import { POST as rollbackRoute } from '@/app/api/audit/rollback/route';
import { POST as simulateTamperRoute } from '@/app/api/audit/simulate-tamper/route';
import { GET as ledgerGetRoute } from '@/app/api/ledger/route';
import { GET as studentResultsRoute } from '@/app/api/student/results/route';
import { GET as studentCorrectionsRoute } from '@/app/api/student/corrections/route';

describe('VeriMark Production Security & Server-Side RBAC Enforcement', () => {
  const origEnv = process.env.NODE_ENV;

  beforeAll(async () => {
    dbService.resetForTesting();
    await dbService.seedInitialData();
  });

  afterEach(() => {
    process.env.NODE_ENV = origEnv;
    resetCachedKeysForTesting();
  });

  describe('1. Student Privilege Escalation Prevention (Admin APIs Blocked)', () => {
    it('1.1: Student is strictly blocked from GET /api/results (cannot view other students)', async () => {
      const studentAuth = getDemoTokenForRole('STUDENT', 'CF2026-CSE-101');
      const req = new Request('http://localhost:3000/api/results', {
        headers: { Authorization: `Bearer ${studentAuth.token}` },
      });

      const res = await resultsGetRoute(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/Access denied.*STUDENT.*not authorized/i);
    });

    it('1.2: Student is strictly blocked from creating results (POST /api/results)', async () => {
      const studentAuth = getDemoTokenForRole('STUDENT', 'CF2026-CSE-101');
      const req = new Request('http://localhost:3000/api/results', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentAuth.token}`,
        },
        body: JSON.stringify({
          studentRegNo: 'CF2026-CSE-101',
          studentName: 'Aarav Sharma',
          course: 'B.Tech CSE',
          subject: 'Hacked Subject',
          examName: 'Midterm 2026',
          marksObtained: 100,
        }),
      });

      const res = await resultsPostRoute(req);
      expect(res.status).toBe(403);
    });

    it('1.3: Student is strictly blocked from publishing results (POST /api/results/[id]/publish)', async () => {
      const studentAuth = getDemoTokenForRole('STUDENT', 'CF2026-CSE-101');
      const results = await dbService.getResults();
      const targetId = results[0].id;

      const req = new Request(`http://localhost:3000/api/results/${targetId}/publish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${studentAuth.token}` },
      });

      const res = await publishRoute(req, { params: { id: targetId } });
      expect(res.status).toBe(403);
    });

    it('1.4: Student is strictly blocked from viewing all corrections (GET /api/corrections)', async () => {
      const studentAuth = getDemoTokenForRole('STUDENT', 'CF2026-CSE-101');
      const req = new Request('http://localhost:3000/api/corrections', {
        headers: { Authorization: `Bearer ${studentAuth.token}` },
      });

      const res = await correctionsGetRoute(req);
      expect(res.status).toBe(403);
    });

    it('1.5: Student is strictly blocked from filing institutional corrections (POST /api/corrections)', async () => {
      const studentAuth = getDemoTokenForRole('STUDENT', 'CF2026-CSE-101');
      const results = await dbService.getResults();

      const req = new Request('http://localhost:3000/api/corrections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentAuth.token}`,
        },
        body: JSON.stringify({
          resultId: results[0].id,
          proposedMarks: 99,
          reason: 'Unauthorized student amendment attempt',
        }),
      });

      const res = await correctionsPostRoute(req);
      expect(res.status).toBe(403);
    });

    it('1.6: Student is strictly blocked from approving corrections (POST /api/corrections/[id]/approve)', async () => {
      const studentAuth = getDemoTokenForRole('STUDENT', 'CF2026-CSE-101');

      const req = new Request('http://localhost:3000/api/corrections/req_123/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentAuth.token}`,
        },
        body: JSON.stringify({ comments: 'Self-approval attempt' }),
      });

      const res = await approveCorrectionRoute(req, { params: { id: 'req_123' } });
      expect(res.status).toBe(403);
    });

    it('1.7: Student is strictly blocked from administrative audit controls (GET /api/audit)', async () => {
      const studentAuth = getDemoTokenForRole('STUDENT', 'CF2026-CSE-101');
      const req = new Request('http://localhost:3000/api/audit', {
        headers: { Authorization: `Bearer ${studentAuth.token}` },
      });

      const res = await auditGetRoute(req);
      expect(res.status).toBe(403);
    });

    it('1.8: Student is strictly blocked from rolling back the ledger (POST /api/audit/rollback)', async () => {
      const studentAuth = getDemoTokenForRole('STUDENT', 'CF2026-CSE-101');
      const req = new Request('http://localhost:3000/api/audit/rollback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentAuth.token}`,
        },
        body: JSON.stringify({ checkpointId: 'chk_seq_0001' }),
      });

      const res = await rollbackRoute(req);
      expect(res.status).toBe(403);
    });

    it('1.9: Student is strictly blocked from simulating tampering (POST /api/audit/simulate-tamper)', async () => {
      const studentAuth = getDemoTokenForRole('STUDENT', 'CF2026-CSE-101');
      const req = new Request('http://localhost:3000/api/audit/simulate-tamper', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentAuth.token}`,
        },
      });

      const res = await simulateTamperRoute(req);
      expect(res.status).toBe(403);
    });

    it('1.10: Student is strictly blocked from accessing raw institutional ledger events (GET /api/ledger)', async () => {
      const studentAuth = getDemoTokenForRole('STUDENT', 'CF2026-CSE-101');
      const req = new Request('http://localhost:3000/api/ledger', {
        headers: { Authorization: `Bearer ${studentAuth.token}` },
      });

      const res = await ledgerGetRoute(req);
      expect(res.status).toBe(403);
    });
  });

  describe('2. Cross-Student Ownership & IDOR Protection', () => {
    it('2.1: Student A cannot access Student B results by modifying URL/parameter', async () => {
      const studentA = getDemoTokenForRole('STUDENT', 'CF2026-CSE-101');
      const req = new Request('http://localhost:3000/api/student/results?regNo=CF2026-CSE-102', {
        headers: { Authorization: `Bearer ${studentA.token}` },
      });

      const res = await studentResultsRoute(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toMatch(/Forbidden.*not authorized.*records.*student/i);
    });

    it('2.2: Student A cannot access Student B correction history', async () => {
      const studentA = getDemoTokenForRole('STUDENT', 'CF2026-CSE-101');
      const req = new Request('http://localhost:3000/api/student/corrections?regNo=CF2026-CSE-103', {
        headers: { Authorization: `Bearer ${studentA.token}` },
      });

      const res = await studentCorrectionsRoute(req);
      expect(res.status).toBe(403);
    });

    it('2.3: Student cannot forge or alter studentRegNo in cryptographic session token', () => {
      const studentA = getDemoTokenForRole('STUDENT', 'CF2026-CSE-101');
      const [payloadB64, sig] = studentA.token.split('.');

      // Forger decodes and modifies studentRegNo
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
      payload.studentRegNo = 'CF2026-CSE-105';
      payload.role = 'ADMIN'; // Attempt role escalation

      const forgedPayloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const forgedToken = `${forgedPayloadB64}.${sig}`;

      const verified = verifySessionToken(forgedToken);
      expect(verified).toBeNull();
    });
  });

  describe('3. Institutional Role Boundary Enforcement', () => {
    it('3.1: AUDITOR cannot create results or approve corrections', async () => {
      const auditor = getDemoTokenForRole('AUDITOR');

      const createReq = new Request('http://localhost:3000/api/results', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auditor.token}`,
        },
        body: JSON.stringify({ studentRegNo: 'CF2026-CSE-101' }),
      });
      const createRes = await resultsPostRoute(createReq);
      expect(createRes.status).toBe(403);

      const approveReq = new Request('http://localhost:3000/api/corrections/req_123/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auditor.token}`,
        },
      });
      const approveRes = await approveCorrectionRoute(approveReq, { params: { id: 'req_123' } });
      expect(approveRes.status).toBe(403);
    });

    it('3.2: EXAM_CONTROLLER cannot rollback the ledger (ADMIN only)', async () => {
      const controller = getDemoTokenForRole('EXAM_CONTROLLER');

      const req = new Request('http://localhost:3000/api/audit/rollback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${controller.token}`,
        },
      });
      const res = await rollbackRoute(req);
      expect(res.status).toBe(403);
    });

    it('3.3: ACADEMIC_DEAN cannot publish results (ADMIN only)', async () => {
      const dean = getDemoTokenForRole('ACADEMIC_DEAN');
      const results = await dbService.getResults();

      const req = new Request(`http://localhost:3000/api/results/${results[0].id}/publish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${dean.token}` },
      });
      const res = await publishRoute(req, { params: { id: results[0].id } });
      expect(res.status).toBe(403);
    });
  });

  describe('4. Production Isolation (No Backdoor / Zero Directory Leakage)', () => {
    it('4.1: Production strictly rejects demoRole login with HTTP 403', async () => {
      process.env.NODE_ENV = 'production';

      const req = new Request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demoRole: 'ADMIN' }),
      });

      const res = await loginRoute(req);
      expect(res.status).toBe(403);
      expect(res.cookies.get('verimark_session')).toBeUndefined();
    });

    it('4.2: Production GET /api/auth/me returns empty availableAccounts (no persona exposure)', async () => {
      process.env.NODE_ENV = 'production';

      const req = new Request('http://localhost:3000/api/auth/me');
      const res = await meRoute(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.availableAccounts).toEqual([]);
    });

    it('4.3: Real credential-based authentication succeeds in production', async () => {
      process.env.NODE_ENV = 'production';

      const req = new Request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@verimark.edu',
          password: 'Admin@2026!',
        }),
      });

      const res = await loginRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.user.role).toBe('ADMIN');
      expect(res.cookies.get('verimark_session')).toBeDefined();
    });

    it('4.4: Student credential-based login succeeds and binds immutable studentRegNo in production', async () => {
      process.env.NODE_ENV = 'production';

      const req = new Request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'aarav.sharma@student.verimark.edu',
          password: 'Act#Aarav$2026!',
        }),
      });

      const res = await loginRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.user.role).toBe('STUDENT');
      expect(json.user.studentRegNo).toBe('CF2026-CSE-101');
      expect(res.cookies.get('verimark_session')).toBeDefined();
    });

    it('4.5: Client page code contains no hardcoded evaluator passwords or credentials', async () => {
      const fs = await import('fs');
      const loginCode = fs.readFileSync('app/login/page.tsx', 'utf8');
      const studentCode = fs.readFileSync('app/student/page.tsx', 'utf8');

      // Ensure no passwords are in client source files
      expect(loginCode).not.toContain('Admin@2026!');
      expect(loginCode).not.toContain('Act#Aarav$2026!');
      expect(loginCode).not.toContain('Act#Bhavna$2026!');
      expect(studentCode).not.toContain('Act#Aarav$2026!');
    });
  });

  describe('5. Next.js Server-Side Middleware Route Guards', () => {
    it('5.1: Unauthenticated request to protected page redirects to /login', async () => {
      const req = new NextRequest('http://localhost:3000/');
      const res = await middleware(req);

      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/login?redirect=%2F');
    });

    it('5.2: Unauthenticated request to /api/results returns HTTP 401', async () => {
      const req = new NextRequest('http://localhost:3000/api/results');
      const res = await middleware(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/Unauthorized/i);
    });

    it('5.3: Student session navigating to admin dashboard (/) is redirected to /access-denied', async () => {
      const student = getDemoTokenForRole('STUDENT', 'CF2026-CSE-101');
      const req = new NextRequest('http://localhost:3000/', {
        headers: {
          cookie: `verimark_session=${student.token}`,
        },
      });

      const res = await middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/access-denied?reason=student_restricted&path=%2F');
    });

    it('5.4: Student session accessing /api/results in middleware returns HTTP 403 Forbidden', async () => {
      const student = getDemoTokenForRole('STUDENT', 'CF2026-CSE-101');
      const req = new NextRequest('http://localhost:3000/api/results', {
        headers: {
          cookie: `verimark_session=${student.token}`,
        },
      });

      const res = await middleware(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toMatch(/Forbidden.*Student accounts are strictly restricted/i);
    });

    it('5.5: Institutional user accessing /student is redirected to institutional dashboard', async () => {
      const admin = getDemoTokenForRole('ADMIN');
      const req = new NextRequest('http://localhost:3000/student', {
        headers: {
          cookie: `verimark_session=${admin.token}`,
        },
      });

      const res = await middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('http://localhost:3000/');
    });

    it('5.6: Public verification route (/verify/123) is accessible without authentication', async () => {
      const req = new NextRequest('http://localhost:3000/verify/res_sample_123');
      const res = await middleware(req);

      // Status 200 / NextResponse.next()
      expect(res.status).toBe(200);
    });

    it('5.7: Public QR route (/api/results/123/qr) is accessible without authentication', async () => {
      const req = new NextRequest('http://localhost:3000/api/results/res_sample_123/qr');
      const res = await middleware(req);

      expect(res.status).toBe(200);
    });

    it('5.8: Authenticated student visiting /login is redirected to /student', async () => {
      const student = getDemoTokenForRole('STUDENT', 'CF2026-CSE-101');
      const req = new NextRequest('http://localhost:3000/login', {
        headers: { cookie: `verimark_session=${student.token}` },
      });
      const res = await middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('http://localhost:3000/student');
    });

    it('5.9: Authenticated admin visiting /login is redirected to institutional dashboard', async () => {
      const admin = getDemoTokenForRole('ADMIN');
      const req = new NextRequest('http://localhost:3000/login', {
        headers: { cookie: `verimark_session=${admin.token}` },
      });
      const res = await middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('http://localhost:3000/');
    });
  });

  describe('6. Secure Logout Handling', () => {
    it('6.1: Logout clears session cookie with maxAge=0', async () => {
      const req = new Request('http://localhost:3000/api/auth/logout', { method: 'POST' });
      const res = await logoutRoute();

      expect(res.status).toBe(200);
      const cookie = res.cookies.get('verimark_session');
      expect(cookie).toBeDefined();
      expect(cookie?.value).toBe('');
      expect(cookie?.maxAge).toBe(0);
    });
  });
});
