import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { POST as loginRoute } from '@/app/api/auth/login/route';
import { GET as auditRoute } from '@/app/api/audit/route';
import { GET as ledgerRoute } from '@/app/api/ledger/route';
import { dbService } from '@/lib/storage/db';
import { getDemoTokenForRole, createSessionToken } from '@/lib/server/auth';
import { resetCachedKeysForTesting } from '@/lib/server/keys';

describe('Priority Security Remediation Tests (H8)', () => {
  const origEnv = process.env.NODE_ENV;

  beforeEach(async () => {
    dbService.resetForTesting();
    await dbService.seedInitialData();
  });

  afterEach(() => {
    process.env.NODE_ENV = origEnv;
    resetCachedKeysForTesting();
  });

  describe('FIX 1: demoRole Login Backdoor Hardening', () => {
    it('1.1: Production strictly rejects ADMIN demoRole login with HTTP 403', async () => {
      process.env.NODE_ENV = 'production';

      const req = new Request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demoRole: 'ADMIN' }),
      });

      const res = await loginRoute(req);
      expect(res.status).toBe(403);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/Demo role authentication is strictly disabled in production/i);
      expect(json.token).toBeUndefined();
      expect(json.user).toBeUndefined();

      // Ensure no session cookie was attached to response
      const cookie = res.cookies.get('verimark_session');
      expect(cookie).toBeUndefined();
    });

    it('1.2: Production strictly rejects AUDITOR demoRole login with HTTP 403', async () => {
      process.env.NODE_ENV = 'production';

      const req = new Request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demoRole: 'AUDITOR' }),
      });

      const res = await loginRoute(req);
      expect(res.status).toBe(403);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.token).toBeUndefined();
      expect(res.cookies.get('verimark_session')).toBeUndefined();
    });

    it('1.3: Production rejects EXAM_CONTROLLER and ACADEMIC_DEAN demoRole logins', async () => {
      process.env.NODE_ENV = 'production';

      for (const role of ['EXAM_CONTROLLER', 'ACADEMIC_DEAN']) {
        const req = new Request('http://localhost:3000/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ demoRole: role }),
        });

        const res = await loginRoute(req);
        expect(res.status).toBe(403);
        const json = await res.json();
        expect(json.token).toBeUndefined();
        expect(res.cookies.get('verimark_session')).toBeUndefined();
      }
    });

    it('1.4: Normal credentials authentication in production remains fully functional', async () => {
      process.env.NODE_ENV = 'production';

      // Invalid credentials fail
      const badReq = new Request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@verimark.edu',
          password: 'IncorrectPassword!2026',
        }),
      });
      const badRes = await loginRoute(badReq);
      expect(badRes.status).toBe(401);
      const badJson = await badRes.json();
      expect(badJson.success).toBe(false);
      expect(badJson.token).toBeUndefined();

      // Valid credentials succeed
      const goodReq = new Request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@verimark.edu',
          password: 'Admin@2026!',
        }),
      });
      const goodRes = await loginRoute(goodReq);
      expect(goodRes.status).toBe(200);
      const goodJson = await goodRes.json();
      expect(goodJson.success).toBe(true);
      expect(goodJson.user.email).toBe('admin@verimark.edu');
      expect(goodJson.token).toBeDefined();

      const cookie = goodRes.cookies.get('verimark_session');
      expect(cookie).toBeDefined();
      expect(cookie?.value).toBe(goodJson.token);
    });

    it('1.5: Local development mode still permits demoRole switching for evaluation', async () => {
      process.env.NODE_ENV = 'development';

      const req = new Request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demoRole: 'ADMIN' }),
      });

      const res = await loginRoute(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.user.role).toBe('ADMIN');
      expect(json.token).toBeDefined();

      const cookie = res.cookies.get('verimark_session');
      expect(cookie).toBeDefined();
      expect(cookie?.value).toBe(json.token);
    });
  });

  describe('FIX 2: Security Audit API Authorization & Status Handling', () => {
    it('2.1: Unauthorized request (no token) returns HTTP 401', async () => {
      const req = new Request('http://localhost:3000/api/audit', { method: 'GET' });
      const res = await auditRoute(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/Authentication required/i);
      expect(json.report).toBeUndefined();
    });

    it('2.2: Forbidden request (unauthorized role) returns HTTP 403', async () => {
      const controllerAuth = getDemoTokenForRole('EXAM_CONTROLLER');
      const req = new Request('http://localhost:3000/api/audit', {
        method: 'GET',
        headers: { Authorization: `Bearer ${controllerAuth.token}` },
      });
      const res = await auditRoute(req);

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/Role 'EXAM_CONTROLLER' is not authorized/i);
      expect(json.report).toBeUndefined();
    });

    it('2.3: Forbidden request with Dean role returns HTTP 403', async () => {
      const deanAuth = getDemoTokenForRole('ACADEMIC_DEAN');
      const req = new Request('http://localhost:3000/api/audit', {
        method: 'GET',
        headers: { Authorization: `Bearer ${deanAuth.token}` },
      });
      const res = await auditRoute(req);

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/Role 'ACADEMIC_DEAN' is not authorized/i);
    });

    it('2.4: Authorized Auditor request returns HTTP 200 with full verified report', async () => {
      const auditorAuth = getDemoTokenForRole('AUDITOR');
      const req = new Request('http://localhost:3000/api/audit', {
        method: 'GET',
        headers: { Authorization: `Bearer ${auditorAuth.token}` },
      });
      const res = await auditRoute(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.report).toBeDefined();
      expect(json.report.overallStatus).toBe('SECURE');
      expect(json.report.publishedCount).toBe(5);
      expect(json.report.findings).toHaveLength(0);
    });

    it('2.5: Authorized Admin request returns HTTP 200 with full verified report', async () => {
      const adminAuth = getDemoTokenForRole('ADMIN');
      const req = new Request('http://localhost:3000/api/audit', {
        method: 'GET',
        headers: { Authorization: `Bearer ${adminAuth.token}` },
      });
      const res = await auditRoute(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.report.publishedCount).toBe(5);
      expect(json.report.ledgerIntegrity).toBe(true);
      expect(json.report.eventChainIntegrity).toBe(true);
    });

    it('2.6: Tampered database detection reflected accurately in audit report', async () => {
      const results = await dbService.getPublishedResults();
      await dbService.directTamperResult(results[0].id, 'marksObtained', 99.5);

      const auditorAuth = getDemoTokenForRole('AUDITOR');
      const req = new Request('http://localhost:3000/api/audit', {
        method: 'GET',
        headers: { Authorization: `Bearer ${auditorAuth.token}` },
      });
      const res = await auditRoute(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.report.overallStatus).toBe('TAMPER_DETECTED');
      expect(json.report.findings.length).toBeGreaterThan(0);
      expect(json.report.findings[0].studentRegNo).toBe(results[0].studentRegNo);
    });
  });

  describe('FIX 3: Vault Terminology and Data Exposure Contract', () => {
    it('3.1: /api/ledger exposes public keys without private keys or false WORM claims', async () => {
      const res = await ledgerRoute();
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.publicKeys).toBeDefined();
      expect(json.checkpoints.length).toBeGreaterThan(0);
      expect(json.independentCheckpoints.length).toBeGreaterThan(0);

      const serialized = JSON.stringify(json);
      expect(serialized).not.toMatch(/privateKey/i);
      expect(serialized).not.toMatch(/WORM_COMPLIANT/i);
    });
  });
});
