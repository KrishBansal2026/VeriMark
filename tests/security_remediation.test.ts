import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { dbService } from '../lib/storage/db';
import { performSystemAudit } from '../lib/audit/tamperDetector';
import { verifyResultCryptographically } from '../lib/audit/publicVerifier';
import { getDemoTokenForRole } from '../lib/server/auth';
import { getServerKeys, resetCachedKeysForTesting } from '../lib/server/keys';
import { sha256, computeResultRecordHash } from '../lib/crypto/sha256';

// Direct Route Handlers
import { POST as createResultRoute } from '../app/api/results/route';
import { POST as publishResultRoute } from '../app/api/results/[id]/publish/route';
import { POST as createCorrectionRoute } from '../app/api/corrections/route';
import { POST as approveCorrectionRoute } from '../app/api/corrections/[id]/approve/route';
import { GET as runAuditRoute } from '../app/api/audit/route';
import { POST as rollbackRoute } from '../app/api/audit/rollback/route';

describe('Security Remediation Comprehensive Audit Tests', () => {
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

  describe('1. API Authentication & Authorization (HTTP 401 & 403 Enforcement)', () => {
    it('rejects anonymous requests to create result with HTTP 401', async () => {
      const req = new Request('http://localhost:3000/api/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentRegNo: 'CF2026-TEST-99',
          studentName: 'Hacker X',
          course: 'CSE',
          subject: 'Security',
          examName: 'Midterm',
          marksObtained: 99,
        }),
      });

      const res = await createResultRoute(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/Authentication required/i);
    });

    it('rejects non-admin role (Controller) attempting to create result with HTTP 403', async () => {
      const req = new Request('http://localhost:3000/api/results', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${controllerAuth.token}`,
        },
        body: JSON.stringify({
          studentRegNo: 'CF2026-TEST-99',
          studentName: 'Hacker X',
          course: 'CSE',
          subject: 'Security',
          examName: 'Midterm',
          marksObtained: 99,
        }),
      });

      const res = await createResultRoute(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/Access denied.*EXAM_CONTROLLER/i);
    });

    it('rejects anonymous requests to publish result with HTTP 401', async () => {
      const draft = await dbService.createResult({
        studentRegNo: 'CF-UNAUTH-01',
        studentName: 'Target',
        course: 'CSE',
        subject: 'Math',
        examName: 'Midterm',
        marksObtained: 70,
      });

      const req = new Request(`http://localhost:3000/api/results/${draft.id}/publish`, {
        method: 'POST',
      });

      const res = await publishResultRoute(req, { params: { id: draft.id } });
      expect(res.status).toBe(401);
    });

    it('allows authenticated Admin to create and publish results', async () => {
      const req = new Request('http://localhost:3000/api/results', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAuth.token}`,
        },
        body: JSON.stringify({
          studentRegNo: 'CF2026-SEC-01',
          studentName: 'Valid Student',
          course: 'B.Tech CSE',
          subject: 'Network Security',
          examName: 'End Sem',
          marksObtained: 95,
          publishImmediately: true,
        }),
      });

      const res = await createResultRoute(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.result.status).toBe('published');
    });

    it('rejects unauthorized user attempting to trigger rollback with HTTP 403', async () => {
      const req = new Request('http://localhost:3000/api/audit/rollback', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${auditorAuth.token}`,
        },
      });

      const res = await rollbackRoute(req);
      expect(res.status).toBe(403);
    });
  });

  describe('2. Dual Approval Enforcement & Identity Integrity', () => {
    it('prevents the correction requester from approving their own request', async () => {
      const results = await dbService.getPublishedResults();
      const target = results[0];

      const request = await dbService.createCorrectionRequest({
        resultId: target.id,
        proposedMarks: 90,
        reason: 'Recounting of paper answers',
        requester: controllerAuth.user,
      });

      await expect(
        dbService.submitCorrectionApproval({
          requestId: request.id,
          authUser: controllerAuth.user,
        })
      ).rejects.toThrow(/Conflict of interest.*cannot approve/i);
    });

    it('prevents the same user from signing both approver roles (Anti-Impersonation)', async () => {
      const results = await dbService.getPublishedResults();
      const target = results[0];

      const request = await dbService.createCorrectionRequest({
        resultId: target.id,
        proposedMarks: 85,
        reason: 'Re-scrutiny under ordinance 12',
        requester: adminAuth.user,
      });

      await dbService.submitCorrectionApproval({
        requestId: request.id,
        authUser: controllerAuth.user,
      });

      const forgedUser = { ...controllerAuth.user, role: 'ACADEMIC_DEAN' as const };
      await expect(
        dbService.submitCorrectionApproval({
          requestId: request.id,
          authUser: forgedUser,
        })
      ).rejects.toThrow(/already signed/i);
    });

    it('rejects approval from unauthorized role (Admin or Auditor attempting to approve)', async () => {
      const results = await dbService.getPublishedResults();
      const target = results[0];

      const request = await dbService.createCorrectionRequest({
        resultId: target.id,
        proposedMarks: 91,
        reason: 'Authorized audit correction',
        requester: adminAuth.user,
      });

      await expect(
        dbService.submitCorrectionApproval({
          requestId: request.id,
          authUser: auditorAuth.user,
        })
      ).rejects.toThrow(/not authorized to sign/i);
    });

    it('successfully applies correction only when two distinct authorized users sign', async () => {
      const results = await dbService.getPublishedResults();
      const target = results[0];
      const initialMarks = target.marksObtained;

      const request = await dbService.createCorrectionRequest({
        resultId: target.id,
        proposedMarks: initialMarks + 4,
        reason: 'Verified addition error in Section C',
        requester: adminAuth.user,
      });

      const res1 = await dbService.submitCorrectionApproval({
        requestId: request.id,
        authUser: controllerAuth.user,
      });
      expect(res1.applied).toBe(false);
      expect(res1.request.status).toBe('partially_approved');

      const res2 = await dbService.submitCorrectionApproval({
        requestId: request.id,
        authUser: deanAuth.user,
      });
      expect(res2.applied).toBe(true);
      expect(res2.request.status).toBe('approved_applied');

      const updated = await dbService.getResultById(target.id);
      expect(updated?.marksObtained).toBe(initialMarks + 4);
      expect(updated?.status).toBe('corrected');
    });
  });

  describe('3. Private Key Protection & Fail-Secure Startup', () => {
    it('fails securely in production mode if required private keys are missing', () => {
      const origEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';
        delete process.env.LEDGER_SIGNING_PRIVATE_KEY;
        delete process.env.APPROVER_1_PRIVATE_KEY;
        delete process.env.APPROVER_2_PRIVATE_KEY;

        resetCachedKeysForTesting();
        expect(() => getServerKeys()).toThrow(/FATAL SECURITY VIOLATION.*disabled in production/i);
      } finally {
        process.env.NODE_ENV = origEnv;
        resetCachedKeysForTesting();
      }
    });

    it('rejects malformed hex private keys in production configuration', () => {
      const origEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';
        process.env.LEDGER_SIGNING_PRIVATE_KEY = 'invalid-hex-too-short';
        process.env.APPROVER_1_PRIVATE_KEY = 'deadbeef';
        process.env.APPROVER_2_PRIVATE_KEY = '00'.repeat(32);

        resetCachedKeysForTesting();
        expect(() => getServerKeys()).toThrow(/must be valid 64-character hexadecimal/i);
      } finally {
        process.env.NODE_ENV = origEnv;
        delete process.env.LEDGER_SIGNING_PRIVATE_KEY;
        delete process.env.APPROVER_1_PRIVATE_KEY;
        delete process.env.APPROVER_2_PRIVATE_KEY;
        resetCachedKeysForTesting();
      }
    });
  });

  describe('4. Ledger Event Chain & Tampering Detection', () => {
    it('detects when an attacker modifies BOTH marks and record_hash in the database', async () => {
      const results = await dbService.getPublishedResults();
      const target = results[0];

      const { recordHash: forgedHash } = computeResultRecordHash({
        studentRegNo: target.studentRegNo,
        studentName: target.studentName,
        course: target.course,
        subject: target.subject,
        examName: target.examName,
        marksObtained: 99.9,
        maxMarks: target.maxMarks,
        publicationDate: target.publicationDate,
      });

      await dbService.directTamperBothMarksAndHashForTest(target.id, 99.9, forgedHash);

      const audit = await performSystemAudit();
      expect(audit.overallStatus).toBe('CHECKPOINT_MISMATCH');
      expect(audit.ledgerIntegrity).toBe(false);
      const rootFinding = audit.findings.find((f) => f.recordId === 'merkle_tree_root');
      expect(rootFinding).toBeDefined();
    });

    it('detects deleted or missing ledger events in the event chain', async () => {
      const events = await dbService.getLedgerEvents();
      expect(events.length).toBeGreaterThan(0);

      // Directly corrupt event stream by deleting the last event on disk
      await dbService.corruptLedgerEventDirectlyForTest(events.length - 1, {
        sequenceNumber: 9999, // Alter sequence number to break count and order
      });

      const audit = await performSystemAudit();
      expect(audit.eventChainIntegrity).toBe(false);
      const seqFinding = audit.findings.find((f) => f.subject === 'EVENT_SEQUENCE');
      expect(seqFinding).toBeDefined();
    });

    it('detects modified payload in a historical ledger event', async () => {
      // Modify payload on disk
      await dbService.corruptLedgerEventDirectlyForTest(0, {
        payload: { studentName: 'Tampered Person', marksObtained: 999 },
      });

      const audit = await performSystemAudit();
      expect(audit.eventChainIntegrity).toBe(false);
      const payloadFinding = audit.findings.find((f) => f.subject === 'EVENT_PAYLOAD');
      expect(payloadFinding).toBeDefined();
    });

    it('detects broken previous-event hash chain linkage', async () => {
      await dbService.corruptLedgerEventDirectlyForTest(1, {
        prevEventHash: sha256('forged_prev_link'),
      });

      const audit = await performSystemAudit();
      expect(audit.eventChainIntegrity).toBe(false);
      const chainFinding = audit.findings.find((f) => f.subject === 'EVENT_HASH_CHAIN');
      expect(chainFinding).toBeDefined();
    });

    it('detects when a published result record has been completely deleted from the database', async () => {
      const results = await dbService.getPublishedResults();
      const target = results[0];
      const targetId = target.id;

      // Purge student record from disk
      await dbService.deleteResultDirectlyForTest(targetId);

      const verifyCheck = await verifyResultCryptographically(targetId);
      expect(verifyCheck.status).toBe('TAMPERED');
      expect(verifyCheck.message).toMatch(/illegally deleted or purged/i);
    });
  });

  describe('5. Secure Rollback Verification', () => {
    it('successfully restores tampered database using verified event chain and trusted checkpoint', async () => {
      const results = await dbService.getPublishedResults();
      const target = results[0];
      const originalMarks = target.marksObtained;

      await dbService.directTamperResult(target.id, 'marksObtained', 10.5);

      const preAudit = await performSystemAudit();
      expect(preAudit.overallStatus).toBe('TAMPER_DETECTED');

      const rollbackResult = await dbService.rollbackToLastValidCheckpoint();
      expect(rollbackResult.success).toBe(true);

      const postAudit = await performSystemAudit();
      expect(postAudit.overallStatus).toBe('SECURE');
      expect(postAudit.findings.length).toBe(0);

      const restored = await dbService.getResultById(target.id);
      expect(restored?.marksObtained).toBe(originalMarks);
    });

    it('aborts rollback and throws error if the ledger event chain has been corrupted', async () => {
      await dbService.corruptLedgerEventDirectlyForTest(0, {
        payload: { corrupted: true },
      });

      await expect(dbService.rollbackToLastValidCheckpoint()).rejects.toThrow(
        /Tampered event payload|Broken hash chain/i
      );
    });
  });
});
