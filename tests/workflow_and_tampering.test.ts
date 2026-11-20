import { describe, it, expect, beforeEach } from 'vitest';
import { dbService } from '../lib/storage/db';
import { performSystemAudit } from '../lib/audit/tamperDetector';
import { verifyResultCryptographically } from '../lib/audit/publicVerifier';
import { getDemoTokenForRole } from '../lib/server/auth';

describe('Workflow, Dual Approvals, and Tamper Detection Tests', () => {
  const adminUser = getDemoTokenForRole('ADMIN').user;
  const controllerUser = getDemoTokenForRole('EXAM_CONTROLLER').user;
  const deanUser = getDemoTokenForRole('ACADEMIC_DEAN').user;

  beforeEach(async () => {
    dbService.resetForTesting();
    await dbService.seedInitialData();
  });

  describe('1. Result Management & Publishing', () => {
    it('creates a new draft result and computes its SHA-256 record hash', async () => {
      const result = await dbService.createResult({
        studentRegNo: 'TEST-2026-001',
        studentName: 'Zack Taylor',
        course: 'B.Tech IT',
        subject: 'Cybersecurity',
        examName: 'Midterm 2026',
        marksObtained: 89,
        maxMarks: 100,
        publicationDate: '2026-11-20T10:00:00.000Z',
      });

      expect(result.id).toBeDefined();
      expect(result.status).toBe('draft');
      expect(result.recordHash).toBeDefined();
      expect(result.recordHash.length).toBe(64);
    });

    it('publishes a result, appends to append-only ledger, and commits a signed checkpoint', async () => {
      const draft = await dbService.createResult({
        studentRegNo: 'TEST-2026-002',
        studentName: 'Yara Shah',
        course: 'B.Tech IT',
        subject: 'Cloud Computing',
        examName: 'Midterm 2026',
        marksObtained: 92,
        publicationDate: '2026-11-20T10:00:00.000Z',
      });

      const { result, checkpoint } = await dbService.publishResult(draft.id);

      expect(result.status).toBe('published');
      expect(checkpoint).toBeDefined();
      expect(checkpoint.signature).toBeDefined();
      expect(checkpoint.merkleRoot).toBeDefined();

      const events = await dbService.getLedgerEvents();
      const publishEvent = events.find((e) => e.recordId === result.id);
      expect(publishEvent).toBeDefined();
      expect(publishEvent?.eventType).toBe('RESULT_PUBLISHED');
    });
  });

  describe('2. Two-Person Correction Approval Workflow', () => {
    it('rejects correction request creation without valid reason', async () => {
      const results = await dbService.getPublishedResults();
      const target = results[0];

      await expect(
        dbService.createCorrectionRequest({
          resultId: target.id,
          proposedMarks: 95,
          reason: '   ',
          requester: adminUser,
        })
      ).rejects.toThrow(/mandatory correction reason/i);
    });

    it('creates correction request and preserves original state until both approvers sign', async () => {
      const results = await dbService.getPublishedResults();
      const target = results[0];
      const originalMarks = target.marksObtained;

      const req = await dbService.createCorrectionRequest({
        resultId: target.id,
        proposedMarks: originalMarks + 5,
        reason: 'Recounting of question 4 yielded additional marks',
        requester: adminUser,
      });

      expect(req.status).toBe('pending_approvals');

      // Approver 1 (Controller) signs
      const step1 = await dbService.submitCorrectionApproval({
        requestId: req.id,
        authUser: controllerUser,
        comments: 'Recount verified with physical answer script',
      });

      expect(step1.applied).toBe(false);
      expect(step1.request.status).toBe('partially_approved');

      // Verify that result is NOT yet modified
      const currentResult = await dbService.getResultById(target.id);
      expect(currentResult?.marksObtained).toBe(originalMarks);

      // Attempt duplicate approval by the same user (should fail!)
      await expect(
        dbService.submitCorrectionApproval({
          requestId: req.id,
          authUser: controllerUser,
        })
      ).rejects.toThrow(/already signed/i);

      // Approver 2 (Academic Dean) signs
      const step2 = await dbService.submitCorrectionApproval({
        requestId: req.id,
        authUser: deanUser,
        comments: 'Approved under ordinance 4.2',
      });

      expect(step2.applied).toBe(true);
      expect(step2.request.status).toBe('approved_applied');

      // Now verify result is updated to new marks and status is 'corrected'
      const updatedResult = await dbService.getResultById(target.id);
      expect(updatedResult?.marksObtained).toBe(originalMarks + 5);
      expect(updatedResult?.status).toBe('corrected');

      // Verify ledger has a RESULT_CORRECTED event
      const events = await dbService.getLedgerEvents();
      const correctionEvent = events.find(
        (e) => e.eventType === 'RESULT_CORRECTED' && e.recordId === target.id
      );
      expect(correctionEvent).toBeDefined();
    });
  });

  describe('3. Public Cryptographic Verification', () => {
    it('verifies published student marksheet cryptographically with VERIFIED status', async () => {
      const results = await dbService.getPublishedResults();
      const target = results[0];

      const verification = await verifyResultCryptographically(target.id);
      expect(verification.status).toBe('VERIFIED');
      expect(verification.isHashValid).toBe(true);
      expect(verification.isMerkleProofValid).toBe(true);
      expect(verification.isCheckpointSignatureValid).toBe(true);
    });

    it('returns UNAVAILABLE for non-existent result IDs', async () => {
      const verification = await verifyResultCryptographically('non-existent-id');
      expect(verification.status).toBe('UNAVAILABLE');
    });
  });

  describe('4. Direct Database Tampering Detection & Rollback', () => {
    it('detects direct database tampering when record values are modified directly', async () => {
      const results = await dbService.getPublishedResults();
      const target = results[0];

      // Malicious insider directly updates database column (e.g. via raw SQL UPDATE)
      await dbService.directTamperResult(target.id, 'marksObtained', 99.9);

      // Run public verification on the tampered record
      const publicCheck = await verifyResultCryptographically(target.id);
      expect(publicCheck.status).toBe('TAMPERED');
      expect(publicCheck.isHashValid).toBe(false);

      // Run full system audit
      const audit = await performSystemAudit();
      expect(audit.overallStatus).toBe('TAMPER_DETECTED');
      expect(audit.tamperedCount).toBeGreaterThan(0);

      const finding = audit.findings.find((f) => f.recordId === target.id);
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe('CRITICAL');

      // Test Rollback restoration
      const rollback = await dbService.rollbackToLastValidCheckpoint();
      expect(rollback.success).toBe(true);

      // Re-run audit after rollback: should be SECURE!
      const postRollbackAudit = await performSystemAudit();
      expect(postRollbackAudit.overallStatus).toBe('SECURE');
      expect(postRollbackAudit.tamperedCount).toBe(0);
    });
  });
});
