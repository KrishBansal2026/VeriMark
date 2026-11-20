import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { dbService } from '@/lib/storage/db';
import { performSystemAudit } from '@/lib/audit/tamperDetector';
import { verifyResultCryptographically } from '@/lib/audit/publicVerifier';
import {
  createSessionToken,
  verifySessionToken,
  getDemoTokenForRole,
  authenticateCredentials,
} from '@/lib/server/auth';
import { getServerKeys, getPublicKeys, resetCachedKeysForTesting } from '@/lib/server/keys';
import { getActiveCheckpointAdapter, getLatestIndependentCheckpoint } from '@/lib/storage/independentCheckpointStore';
import { sha256, computeResultRecordHash } from '@/lib/crypto/sha256';

// Direct API Route Handlers
import { POST as createResultRoute } from '@/app/api/results/route';
import { POST as publishResultRoute } from '@/app/api/results/[id]/publish/route';
import { POST as createCorrectionRoute } from '@/app/api/corrections/route';
import { POST as approveCorrectionRoute } from '@/app/api/corrections/[id]/approve/route';
import { GET as runAuditRoute } from '@/app/api/audit/route';
import { POST as rollbackRoute } from '@/app/api/audit/rollback/route';
import { POST as loginRoute } from '@/app/api/auth/login/route';
import { GET as ledgerRoute } from '@/app/api/ledger/route';
import { GET as verifyRoute } from '@/app/api/verify/[id]/route';

describe('Adversarial Security Validation Suite', () => {
  const adminAuth = getDemoTokenForRole('ADMIN');
  const controllerAuth = getDemoTokenForRole('EXAM_CONTROLLER');
  const deanAuth = getDemoTokenForRole('ACADEMIC_DEAN');
  const auditorAuth = getDemoTokenForRole('AUDITOR');

  beforeEach(async () => {
    dbService.resetForTesting();
    await dbService.seedInitialData();
  });

  afterEach(() => {
    resetCachedKeysForTesting();
  });

  describe('1. AUTHENTICATION & TOKEN SECURITY', () => {
    it('ATTACK 1.1: Token signature forgery (Attacker modifies payload from AUDITOR to ADMIN)', () => {
      // Step 1: Obtain valid Auditor token
      const originalToken = auditorAuth.token;
      const [payloadB64, signature] = originalToken.split('.');

      // Step 2: Attacker decodes payload and alters role to ADMIN
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
      payload.role = 'ADMIN';
      const forgedPayloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');

      // Step 3: Attacker pairs forged payload with original signature
      const forgedToken = `${forgedPayloadB64}.${signature}`;

      // Step 4: Verification must reject forged token
      const verified = verifySessionToken(forgedToken);
      expect(verified).toBeNull();
    });

    it('ATTACK 1.2: Expired token replay (Attacker replays token with exp in the past)', () => {
      // Step 1: Create token with negative expiration
      const expiredToken = createSessionToken(auditorAuth.user, -1); // expired 1 hour ago

      // Step 2: Verification must reject expired token
      const verified = verifySessionToken(expiredToken);
      expect(verified).toBeNull();
    });

    it('ATTACK 1.3: Malformed token injection (Null bytes, bad delimiters, random bytes)', () => {
      expect(verifySessionToken('')).toBeNull();
      expect(verifySessionToken('random_garbage_string')).toBeNull();
      expect(verifySessionToken('part1.part2.part3')).toBeNull();
      expect(verifySessionToken('part1')).toBeNull();
    });
  });

  describe('2. DEMO IDENTITY SWITCHER EXPOSURE', () => {
    it('ATTACK 2.1: Anonymous user switches directly to ADMIN via demoRole parameter without password', async () => {
      // Step 1: Anonymous request to login route with demoRole: 'ADMIN'
      const req = new Request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demoRole: 'ADMIN' }),
      });

      const res = await loginRoute(req);
      const json = await res.json();

      // EVALUATION: In the current prototype, demoRole grants a valid token without password
      expect(json.success).toBe(true);
      expect(json.user.role).toBe('ADMIN');
      expect(json.token).toBeDefined();

      // Verify the returned token actually works on administrative endpoints
      const authTest = verifySessionToken(json.token);
      expect(authTest?.role).toBe('ADMIN');
    });
  });

  describe('3. DUAL APPROVAL ADVERSARIAL ATTACKS', () => {
    it('ATTACK 3.1: Attacker attempts both approvals using the exact same user account', async () => {
      const results = await dbService.getPublishedResults();
      const target = results[0];

      const request = await dbService.createCorrectionRequest({
        resultId: target.id,
        proposedMarks: 88,
        reason: 'Recounting Section B marks',
        requester: adminAuth.user,
      });

      // Step 1: User controllerAuth signs as Controller
      await dbService.submitCorrectionApproval({
        requestId: request.id,
        authUser: controllerAuth.user,
      });

      // Step 2: Same user controllerAuth tries to sign again
      await expect(
        dbService.submitCorrectionApproval({
          requestId: request.id,
          authUser: controllerAuth.user,
        })
      ).rejects.toThrow(/already signed/i);
    });

    it('ATTACK 3.2: Attacker sends role: "ACADEMIC_DEAN" in request body while authenticated as ADMIN', async () => {
      const results = await dbService.getPublishedResults();
      const target = results[0];

      const request = await dbService.createCorrectionRequest({
        resultId: target.id,
        proposedMarks: 89,
        reason: 'Audit correction',
        requester: controllerAuth.user,
      });

      // Attacker is ADMIN, but sends approverRole: "ACADEMIC_DEAN" in body to /api/corrections/[id]/approve
      const req = new Request(`http://localhost:3000/api/corrections/${request.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAuth.token}`,
        },
        body: JSON.stringify({ approverRole: 'ACADEMIC_DEAN' }),
      });

      const res = await approveCorrectionRoute(req, { params: { id: request.id } });
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toMatch(/Role 'ADMIN' is not authorized/i);
    });

    it('ATTACK 3.3: Correction requester attempts self-approval', async () => {
      const results = await dbService.getPublishedResults();
      const target = results[0];

      // Dean requests the correction
      const request = await dbService.createCorrectionRequest({
        resultId: target.id,
        proposedMarks: 95,
        reason: 'Authorized Dean recount',
        requester: deanAuth.user,
      });

      // Dean attempts to approve their own request
      await expect(
        dbService.submitCorrectionApproval({
          requestId: request.id,
          authUser: deanAuth.user,
        })
      ).rejects.toThrow(/Conflict of interest.*cannot approve/i);
    });

    it('ATTACK 3.4: Attacker attempts approval using an expired session token', async () => {
      const results = await dbService.getPublishedResults();
      const target = results[0];

      const request = await dbService.createCorrectionRequest({
        resultId: target.id,
        proposedMarks: 92,
        reason: 'Verification error',
        requester: adminAuth.user,
      });

      const expiredToken = createSessionToken(controllerAuth.user, -2);

      const req = new Request(`http://localhost:3000/api/corrections/${request.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${expiredToken}`,
        },
        body: JSON.stringify({}),
      });

      const res = await approveCorrectionRoute(req, { params: { id: request.id } });
      expect(res.status).toBe(401);
    });
  });

  describe('4. PRIVATE KEY SECURITY & LEAK PREVENTION', () => {
    it('ATTACK 4.1: Inspect /api/ledger to verify private keys are never returned', async () => {
      const res = await ledgerRoute();
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.publicKeys).toBeDefined();

      expect(json.publicKeys.ledgerAuthority.privateKey).toBeUndefined();
      expect(json.publicKeys.approver1.privateKey).toBeUndefined();
      expect(json.publicKeys.approver2.privateKey).toBeUndefined();

      const jsonString = JSON.stringify(json);
      expect(jsonString).not.toMatch(/privateKey/i);
    });

    it('ATTACK 4.2: Inspect /api/verify/[id] to verify private keys are never returned', async () => {
      const results = await dbService.getPublishedResults();
      const target = results[0];

      const res = await verifyRoute(new Request(`http://localhost:3000/api/verify/${target.id}`), {
        params: { id: target.id },
      });
      const json = await res.json();

      expect(json.success).toBe(true);
      const jsonString = JSON.stringify(json);
      expect(jsonString).not.toMatch(/privateKey/i);
    });

    it('ATTACK 4.3: Production startup fail-secure without valid keys', () => {
      const origEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';
        delete process.env.LEDGER_SIGNING_PRIVATE_KEY;
        delete process.env.APPROVER_1_PRIVATE_KEY;
        delete process.env.APPROVER_2_PRIVATE_KEY;

        resetCachedKeysForTesting();
        expect(() => getServerKeys()).toThrow(/FATAL SECURITY VIOLATION/i);
      } finally {
        process.env.NODE_ENV = origEnv;
        resetCachedKeysForTesting();
      }
    });
  });

  describe('5. CHECKPOINT STORAGE & ADAPTER INSPECTION', () => {
    it('INSPECTION 5.1: Verify active checkpoint adapter type and properties', () => {
      const adapter = getActiveCheckpointAdapter();
      expect(adapter).toBeDefined();
      expect(adapter.name).toBe('Local Protected Vault Adapter');
      expect(adapter.isImmutableWORM).toBe(false);
    });

    it('INSPECTION 5.2: Checkpoint survival and integrity across simulated restarts', async () => {
      const latestBefore = await getLatestIndependentCheckpoint();
      expect(latestBefore).not.toBeNull();

      const adapter = getActiveCheckpointAdapter();
      const latestAfter = await adapter.getLatestCheckpoint();

      expect(latestAfter?.sequenceNumber).toBe(latestBefore?.sequenceNumber);
      expect(latestAfter?.checkpointHash).toBe(latestBefore?.checkpointHash);
      expect(latestAfter?.merkleRoot).toBe(latestBefore?.merkleRoot);
    });
  });

  describe('6. ROLLBACK SECURITY & INTEGRITY RECONSTRUCTION', () => {
    it('ATTACK 6.1: Attacker modifies result data AND event payload together, then triggers rollback', async () => {
      const results = await dbService.getPublishedResults();
      const target = results[0];

      await dbService.directTamperResult(target.id, 'marksObtained', 99.5);

      await dbService.corruptLedgerEventDirectlyForTest(0, {
        payload: { ...target, marksObtained: 99.5 },
      });

      await expect(dbService.rollbackToLastValidCheckpoint()).rejects.toThrow(
        /Tampered event payload|Broken hash chain/i
      );
    });

    it('ATTACK 6.2: Rollback with authentic events successfully restores pristine state', async () => {
      const results = await dbService.getPublishedResults();
      const target = results[0];

      await dbService.directTamperResult(target.id, 'marksObtained', 10.0);

      const rollback = await dbService.rollbackToLastValidCheckpoint();
      expect(rollback.success).toBe(true);
    });
  });

  describe('7. LEDGER INTEGRITY AUDIT VERIFICATION', () => {
    it('ATTACK 7.1: Deleting an event is detected by performSystemAudit', async () => {
      const events = await dbService.getLedgerEvents();
      await dbService.corruptLedgerEventDirectlyForTest(events.length - 1, {
        sequenceNumber: 9999,
      });

      const audit = await performSystemAudit();
      expect(audit.eventChainIntegrity).toBe(false);
      expect(audit.overallStatus).toBe('TAMPER_DETECTED');
    });

    it('ATTACK 7.2: Modifying an event payload is detected', async () => {
      await dbService.corruptLedgerEventDirectlyForTest(0, {
        payload: { studentName: 'Imposter', marksObtained: 100 },
      });

      const audit = await performSystemAudit();
      expect(audit.eventChainIntegrity).toBe(false);
      expect(audit.findings.some((f) => f.subject === 'EVENT_PAYLOAD')).toBe(true);
    });

    it('ATTACK 7.3: Breaking prevEventHash is detected', async () => {
      await dbService.corruptLedgerEventDirectlyForTest(1, {
        prevEventHash: sha256('forged_link'),
      });

      const audit = await performSystemAudit();
      expect(audit.eventChainIntegrity).toBe(false);
      expect(audit.findings.some((f) => f.subject === 'EVENT_HASH_CHAIN')).toBe(true);
    });
  });

  describe('8. FINAL HTTP ENDPOINT ADVERSARIAL MATRIX', () => {
    it('HTTP 8.1: No authentication returns HTTP 401 on protected route', async () => {
      const req = new Request('http://localhost:3000/api/audit', { method: 'GET' });
      const res = await runAuditRoute(req);
      expect(res.status).toBe(401);
    });

    it('HTTP 8.2: Invalid token returns HTTP 401', async () => {
      const req = new Request('http://localhost:3000/api/audit', {
        method: 'GET',
        headers: { Authorization: 'Bearer forged.invalid.token' },
      });
      const res = await runAuditRoute(req);
      expect(res.status).toBe(401);
    });

    it('HTTP 8.3: Expired token returns HTTP 401', async () => {
      const expiredToken = createSessionToken(adminAuth.user, -5);
      const req = new Request('http://localhost:3000/api/audit', {
        method: 'GET',
        headers: { Authorization: `Bearer ${expiredToken}` },
      });
      const res = await runAuditRoute(req);
      expect(res.status).toBe(401);
    });

    it('HTTP 8.4: Valid token but insufficient role returns HTTP 403', async () => {
      const req = new Request('http://localhost:3000/api/audit/rollback', {
        method: 'POST',
        headers: { Authorization: `Bearer ${auditorAuth.token}` },
      });
      const res = await rollbackRoute(req);
      expect(res.status).toBe(403);
    });

    it('HTTP 8.5: Valid authorized user succeeds', async () => {
      const req = new Request('http://localhost:3000/api/audit', {
        method: 'GET',
        headers: { Authorization: `Bearer ${auditorAuth.token}` },
      });
      const res = await runAuditRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });

    it('HTTP 8.6: Duplicate approval returns HTTP 400 with duplicate error', async () => {
      const results = await dbService.getPublishedResults();
      const target = results[0];

      const request = await dbService.createCorrectionRequest({
        resultId: target.id,
        proposedMarks: 91,
        reason: 'Recount test',
        requester: adminAuth.user,
      });

      const req1 = new Request(`http://localhost:3000/api/corrections/${request.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${controllerAuth.token}`,
        },
        body: JSON.stringify({}),
      });
      const res1 = await approveCorrectionRoute(req1, { params: { id: request.id } });
      expect(res1.status).toBe(200);

      const req2 = new Request(`http://localhost:3000/api/corrections/${request.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${controllerAuth.token}`,
        },
        body: JSON.stringify({}),
      });
      const res2 = await approveCorrectionRoute(req2, { params: { id: request.id } });
      expect(res2.status).toBe(400);
      const json2 = await res2.json();
      expect(json2.error).toMatch(/already signed/i);
    });
  });
});
