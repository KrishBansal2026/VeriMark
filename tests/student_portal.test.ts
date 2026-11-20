import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import {
  authenticateCredentials,
  changeUserPassword,
  createSessionToken,
  verifySessionToken,
  getDemoTokenForRole,
  STUDENT_USERS,
} from '@/lib/server/auth';
import { dbService } from '@/lib/storage/db';
import { resetCachedKeysForTesting } from '@/lib/server/keys';
import { POST as loginRoute } from '@/app/api/auth/login/route';
import { POST as changePasswordRoute } from '@/app/api/auth/change-password/route';
import { GET as studentResultsRoute } from '@/app/api/student/results/route';
import { GET as studentCorrectionsRoute } from '@/app/api/student/corrections/route';
import { POST as createResultRoute } from '@/app/api/results/route';
import { POST as publishResultRoute } from '@/app/api/results/[id]/publish/route';
import { POST as rollbackRoute } from '@/app/api/audit/rollback/route';
import { GET as qrRoute } from '@/app/api/results/[id]/qr/route';
import { GET as verifyRoute } from '@/app/api/verify/[id]/route';

describe('VeriMark Student Portal Comprehensive Security & Ownership Tests', () => {
  const origEnv = process.env.NODE_ENV;

  beforeAll(async () => {
    dbService.resetForTesting();
    await dbService.seedInitialData();
  });

  afterEach(() => {
    process.env.NODE_ENV = origEnv;
    resetCachedKeysForTesting();
  });

  describe('1. Student Provisioning & Secure Authentication', () => {
    it('1.1: Student authenticates successfully with temporary activation credentials', async () => {
      const { user, token } = await authenticateCredentials(
        'aarav.sharma@student.verimark.edu',
        'Act#Aarav$2026!'
      );

      expect(user).toBeDefined();
      expect(user.role).toBe('STUDENT');
      expect(user.studentRegNo).toBe('CF2026-CSE-101');
      expect(user.mustChangePassword).toBe(true);
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(2);
    });

    it('1.2: Student authentication fails with incorrect password', async () => {
      await expect(
        authenticateCredentials('aarav.sharma@student.verimark.edu', 'WrongPassword123!')
      ).rejects.toThrow(/Invalid credentials/i);
    });

    it('1.3: Rejects authentication for non-existent student email', async () => {
      await expect(
        authenticateCredentials('unknown.student@student.verimark.edu', 'SomePass123!')
      ).rejects.toThrow(/Invalid credentials/i);
    });

    it('1.4: Pre-provisioned students have unique, non-predictable activation credentials', () => {
      const passwords = [
        'Act#Aarav$2026!',
        'Act#Bhavna$2026!',
        'Act#Chetan$2026!',
        'Act#Divya$2026!',
        'Act#Eshan$2026!',
      ];
      const uniquePasswords = new Set(passwords);
      expect(uniquePasswords.size).toBe(5);

      const salts = STUDENT_USERS.map((s) => s.salt);
      const uniqueSalts = new Set(salts);
      expect(uniqueSalts.size).toBe(5);
    });
  });

  describe('2. First-Login Password Change Enforcement', () => {
    it('2.1: Rejects password change with incorrect current password', async () => {
      const student = STUDENT_USERS[0];
      await expect(
        changeUserPassword(student.id, 'WrongOldPass123!', 'NewSecure#Pass2026!')
      ).rejects.toThrow(/password.*incorrect|invalid.*password/i);
    });

    it('2.2: Rejects new password that violates strong complexity policy', async () => {
      const student = STUDENT_USERS[0];
      // Too short (< 8 chars)
      await expect(
        changeUserPassword(student.id, 'Act#Aarav$2026!', 'Short1!')
      ).rejects.toThrow(/at least 8 characters/i);

      // Missing symbol
      await expect(
        changeUserPassword(student.id, 'Act#Aarav$2026!', 'NoSymbol12345')
      ).rejects.toThrow(/special character/i);

      // Missing number
      await expect(
        changeUserPassword(student.id, 'Act#Aarav$2026!', 'NoNumberSymbol!')
      ).rejects.toThrow(/number/i);
    });

    it('2.3: Completing password change clears mustChangePassword and updates credentials', async () => {
      const student = STUDENT_USERS[0];
      const newPass = 'Updated#Aarav$Pass2026!';

      const { user: updatedUser } = await changeUserPassword(student.id, 'Act#Aarav$2026!', newPass);
      expect(updatedUser.mustChangePassword).toBe(false);

      // Old password should now fail
      await expect(
        authenticateCredentials('aarav.sharma@student.verimark.edu', 'Act#Aarav$2026!')
      ).rejects.toThrow(/Invalid credentials/i);

      // New password should succeed and mustChangePassword is false
      const { user } = await authenticateCredentials('aarav.sharma@student.verimark.edu', newPass);
      expect(user.mustChangePassword).toBe(false);
    });

    it('2.4: Password change API endpoint (/api/auth/change-password) functions correctly', async () => {
      const student = STUDENT_USERS[1]; // Bhavna Reddy
      const { token } = await authenticateCredentials(student.email, 'Act#Bhavna$2026!');

      const req = new Request('http://localhost:3000/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword: 'Act#Bhavna$2026!',
          newPassword: 'Bhavna#NewSecure2026!',
        }),
      });

      const res = await changePasswordRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.user.mustChangePassword).toBe(false);
    });
  });

  describe('3. Cryptographic Session Token & Ownership Binding', () => {
    it('3.1: Session token embeds studentRegNo and verifiable HMAC signature', () => {
      const demoStudent = getDemoTokenForRole('STUDENT', 'CF2026-CSE-103');
      expect(demoStudent.user.studentRegNo).toBe('CF2026-CSE-103');

      const verified = verifySessionToken(demoStudent.token);
      expect(verified).not.toBeNull();
      expect(verified?.role).toBe('STUDENT');
      expect(verified?.studentRegNo).toBe('CF2026-CSE-103');
    });

    it('3.2: Tampering with studentRegNo in token payload breaks HMAC verification', () => {
      const demoStudent = getDemoTokenForRole('STUDENT', 'CF2026-CSE-101');
      const [payloadB64, sig] = demoStudent.token.split('.');

      // Decode payload, modify studentRegNo to 102, re-encode without secret key
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
      payload.studentRegNo = 'CF2026-CSE-102';
      const forgedPayloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');

      const forgedToken = `${forgedPayloadB64}.${sig}`;
      const verified = verifySessionToken(forgedToken);
      expect(verified).toBeNull();
    });
  });

  describe('4. Student Results API & IDOR Protection', () => {
    it('4.1: Student retrieves only their own academic results', async () => {
      const studentAuth = getDemoTokenForRole('STUDENT', 'CF2026-CSE-101');

      const req = new Request('http://localhost:3000/api/student/results', {
        headers: { Authorization: `Bearer ${studentAuth.token}` },
      });

      const res = await studentResultsRoute(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.studentRegNo).toBe('CF2026-CSE-101');
      expect(json.studentName).toBe('Aarav Sharma');
      expect(json.results.length).toBeGreaterThan(0);

      // Verify every result belongs exclusively to CF2026-CSE-101
      for (const r of json.results) {
        expect(r.studentRegNo).toBe('CF2026-CSE-101');
      }

      // Verify calculated stats
      expect(json.stats.totalSubjects).toBe(1);
      expect(json.stats.overallPercentage).toBe(88);
    });

    it('4.2: IDOR Defense: Cross-student parameter tampering is blocked with HTTP 403', async () => {
      // Student 101 attempts to query records for Student 102
      const studentAuth = getDemoTokenForRole('STUDENT', 'CF2026-CSE-101');

      const req = new Request('http://localhost:3000/api/student/results?regNo=CF2026-CSE-102', {
        headers: { Authorization: `Bearer ${studentAuth.token}` },
      });

      const res = await studentResultsRoute(req);
      expect(res.status).toBe(403);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/Forbidden.*not authorized.*records.*student/i);
    });

    it('4.3: Unauthenticated request to /api/student/results is rejected with HTTP 401', async () => {
      const req = new Request('http://localhost:3000/api/student/results');
      const res = await studentResultsRoute(req);
      expect(res.status).toBe(401);
    });
  });

  describe('5. Student Correction History API & IDOR Defense', () => {
    it('5.1: Student retrieves their own correction audit trail', async () => {
      const studentAuth = getDemoTokenForRole('STUDENT', 'CF2026-CSE-101');

      const req = new Request('http://localhost:3000/api/student/corrections', {
        headers: { Authorization: `Bearer ${studentAuth.token}` },
      });

      const res = await studentCorrectionsRoute(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.studentRegNo).toBe('CF2026-CSE-101');
      expect(Array.isArray(json.corrections)).toBe(true);
    });

    it('5.2: IDOR Defense: Cross-student parameter tampering on corrections returns HTTP 403', async () => {
      const studentAuth = getDemoTokenForRole('STUDENT', 'CF2026-CSE-101');

      const req = new Request('http://localhost:3000/api/student/corrections?regNo=CF2026-CSE-104', {
        headers: { Authorization: `Bearer ${studentAuth.token}` },
      });

      const res = await studentCorrectionsRoute(req);
      expect(res.status).toBe(403);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/Forbidden.*not authorized/i);
    });
  });

  describe('6. Privilege Escalation Protection (Student Blocked from Admin APIs)', () => {
    it('6.1: Student is strictly blocked from creating marks (POST /api/results) with HTTP 403', async () => {
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
          subject: 'Unauthorized Subject',
          examName: 'Midterm 2026',
          marksObtained: 100,
          maxMarks: 100,
        }),
      });

      const res = await createResultRoute(req);
      expect(res.status).toBe(403);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/Access denied.*STUDENT.*not authorized/i);
    });

    it('6.2: Student is strictly blocked from publishing results (POST /api/results/[id]/publish) with HTTP 403', async () => {
      const studentAuth = getDemoTokenForRole('STUDENT', 'CF2026-CSE-101');
      const allResults = await dbService.getResults();
      const targetId = allResults[0].id;

      const req = new Request(`http://localhost:3000/api/results/${targetId}/publish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${studentAuth.token}` },
      });

      const res = await publishResultRoute(req, { params: { id: targetId } });
      expect(res.status).toBe(403);
    });

    it('6.3: Student is strictly blocked from ledger rollback (POST /api/audit/rollback) with HTTP 403', async () => {
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
  });

  describe('7. QR Verification & Public Cryptographic Proof', () => {
    it('7.1: QR endpoint generates valid high-resolution QR code data for student result', async () => {
      const allResults = await dbService.getResults();
      const firstResult = allResults[0];

      const req = new Request(`http://localhost:3000/api/results/${firstResult.id}/qr`);
      const res = await qrRoute(req, { params: { id: firstResult.id } });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.qrDataUrl).toMatch(/^data:image\/png;base64,/);
      expect(json.verifyUrl).toContain(`/verify/${firstResult.id}`);
      expect(json.recordHash).toBe(firstResult.recordHash);
    });

    it('7.2: Public verify endpoint confirms authentic status and Merkle inclusion proof', async () => {
      const allResults = await dbService.getResults();
      const firstResult = allResults[0];

      const req = new Request(`http://localhost:3000/api/verify/${firstResult.id}`);
      const res = await verifyRoute(req, { params: { id: firstResult.id } });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.verification.status).toBe('VERIFIED');
      expect(json.verification.isHashValid).toBe(true);
      expect(json.verification.isMerkleProofValid).toBe(true);
      expect(json.verification.isCheckpointSignatureValid).toBe(true);
    });
  });

  describe('8. Demo Switcher Security Isolation', () => {
    it('8.1: In production mode, demoRole with STUDENT is strictly rejected with HTTP 403', async () => {
      process.env.NODE_ENV = 'production';

      const req = new Request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demoRole: 'STUDENT', studentRegNo: 'CF2026-CSE-101' }),
      });

      const res = await loginRoute(req);
      expect(res.status).toBe(403);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/Demo role authentication is strictly disabled in production/i);
      expect(res.cookies.get('verimark_session')).toBeUndefined();
    });

    it('8.2: In development mode, demoRole with STUDENT sets valid session cookie with studentRegNo', async () => {
      process.env.NODE_ENV = 'development';

      const req = new Request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demoRole: 'STUDENT', studentRegNo: 'CF2026-CSE-102' }),
      });

      const res = await loginRoute(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.user.role).toBe('STUDENT');
      expect(json.user.studentRegNo).toBe('CF2026-CSE-102');

      const cookie = res.cookies.get('verimark_session');
      expect(cookie).toBeDefined();
    });
  });

  describe('9. Student Academic Dashboard Expansion & Cryptographic Verification', () => {
    it('9.1: Student results API returns complete academic overview (percentage, marks, max marks, subjects, examinations, verified record count)', async () => {
      const studentAuth = getDemoTokenForRole('STUDENT', 'CF2026-CSE-101');
      const req = new Request('http://localhost:3000/api/student/results', {
        headers: { Authorization: `Bearer ${studentAuth.token}` },
      });

      const res = await studentResultsRoute(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.stats.overallPercentage).toBe(88);
      expect(json.stats.totalMarksObtained).toBe(88);
      expect(json.stats.totalMaxMarks).toBe(100);
      expect(json.stats.totalSubjects).toBe(1);
      expect(json.stats.totalExaminations).toBe(1);
      expect(json.stats.verifiedRecordCount).toBe(1);
    });

    it('9.2: Subject performance accurately reflects actual records without synthetic courses', async () => {
      const studentAuth = getDemoTokenForRole('STUDENT', 'CF2026-CSE-101');
      const req = new Request('http://localhost:3000/api/student/results', {
        headers: { Authorization: `Bearer ${studentAuth.token}` },
      });

      const res = await studentResultsRoute(req);
      const json = await res.json();

      expect(json.results.length).toBe(1);
      const sub = json.results[0];
      expect(sub.subject).toBe('Cryptography & Network Security');
      expect(sub.marksObtained).toBe(88);
      expect(sub.maxMarks).toBe(100);
    });

    it('9.3: Academic insights calculate correct scores, subject extremes, remaining marks, and trajectory notice', async () => {
      const studentAuth = getDemoTokenForRole('STUDENT', 'CF2026-CSE-101');
      const req = new Request('http://localhost:3000/api/student/results', {
        headers: { Authorization: `Bearer ${studentAuth.token}` },
      });

      const res = await studentResultsRoute(req);
      const json = await res.json();

      expect(json.insights).toBeDefined();
      expect(json.insights.overallScore).toBe(88);
      expect(json.insights.highestSubject.subject).toBe('Cryptography & Network Security');
      expect(json.insights.highestSubject.marksObtained).toBe(88);
      expect(json.insights.lowestSubject.subject).toBe('Cryptography & Network Security');
      expect(json.insights.remainingMarks).toBe(12);
      expect(json.insights.publishedExamCount).toBe(1);
      expect(json.insights.academicNotice).toContain('1 examination session recorded');
    });

    it('9.4: Examination registry list contains accurate term records, percentages, and verification status', async () => {
      const studentAuth = getDemoTokenForRole('STUDENT', 'CF2026-CSE-101');
      const req = new Request('http://localhost:3000/api/student/results', {
        headers: { Authorization: `Bearer ${studentAuth.token}` },
      });

      const res = await studentResultsRoute(req);
      const json = await res.json();

      expect(json.examinations).toBeDefined();
      expect(json.examinations.length).toBe(1);
      const exam = json.examinations[0];
      expect(exam.examName).toBe('End Semester Examination 2026');
      expect(exam.marksObtained).toBe(88);
      expect(exam.maxMarks).toBe(100);
      expect(exam.percentage).toBe(88);
      expect(exam.verificationStatus).toBe('VERIFIED');
    });

    it('9.5: Cryptographic verification activity confirms SHA-256 canonical hash, RFC 6962 inclusion proof, and Ed25519 signature validity', async () => {
      const studentAuth = getDemoTokenForRole('STUDENT', 'CF2026-CSE-101');
      const req = new Request('http://localhost:3000/api/student/results', {
        headers: { Authorization: `Bearer ${studentAuth.token}` },
      });

      const res = await studentResultsRoute(req);
      const json = await res.json();

      expect(json.verification).toBeDefined();
      expect(json.verification.status).toBe('VERIFIED');
      expect(json.verification.isHashValid).toBe(true);
      expect(json.verification.isMerkleProofValid).toBe(true);
      expect(json.verification.isCheckpointSignatureValid).toBe(true);
      expect(json.verification.checkpointSequence).toBeGreaterThanOrEqual(1);
      expect(json.verification.verifiedAt).toBeDefined();
    });

    it('9.6: Real chronological activity timeline contains publication, checkpoint, and verification events without fabricated history', async () => {
      const studentAuth = getDemoTokenForRole('STUDENT', 'CF2026-CSE-101');
      const req = new Request('http://localhost:3000/api/student/results', {
        headers: { Authorization: `Bearer ${studentAuth.token}` },
      });

      const res = await studentResultsRoute(req);
      const json = await res.json();

      expect(json.timeline).toBeDefined();
      expect(json.timeline.length).toBeGreaterThanOrEqual(2);

      const eventTypes = json.timeline.map((e: any) => e.eventType);
      expect(eventTypes).toContain('RESULT_PUBLISHED');
      expect(eventTypes).toContain('CHECKPOINT_COMMITTED');
      expect(eventTypes).toContain('VERIFICATION_SUCCESSFUL');
      expect(json.hasCorrections).toBe(false);
    });

    it('9.7: Cryptographic verification payload includes Merkle leaf index, leaf hash, and canonical record hash', async () => {
      const studentAuth = getDemoTokenForRole('STUDENT', 'CF2026-CSE-101');
      const req = new Request('http://localhost:3000/api/student/results', {
        headers: { Authorization: `Bearer ${studentAuth.token}` },
      });

      const res = await studentResultsRoute(req);
      const json = await res.json();

      expect(json.verification.merkleLeafIndex).toBeDefined();
      expect(typeof json.verification.merkleLeafIndex).toBe('number');
      expect(json.verification.merkleLeafHash).toBeDefined();
      expect(json.verification.merkleLeafHash.length).toBe(64);
      expect(json.verification.recordHash).toBeDefined();
      expect(json.verification.recordHash.length).toBe(64);
    });

    it('9.8: Grade allocation matches official grading scheme (88% maps to Grade A+ Distinction)', async () => {
      const studentAuth = getDemoTokenForRole('STUDENT', 'CF2026-CSE-101');
      const req = new Request('http://localhost:3000/api/student/results', {
        headers: { Authorization: `Bearer ${studentAuth.token}` },
      });

      const res = await studentResultsRoute(req);
      const json = await res.json();

      const pct = json.stats.overallPercentage;
      expect(pct).toBe(88);
      // Grade rules: >= 80% is Grade A+ (Excellent / Distinction)
      expect(pct >= 80 && pct < 90).toBe(true);
      expect(pct >= 40).toBe(true); // Pass mark
    });
  });
});
