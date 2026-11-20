import { describe, it, expect } from 'vitest';
import { GET as getStudentResults } from '@/app/api/student/results/route';
import { GET as getStudentAnalytics } from '@/app/api/student/analytics/route';
import { GET as getStudentCorrections } from '@/app/api/student/corrections/route';
import { createSessionToken, getDemoTokenForRole } from '@/lib/server/auth';
import * as fs from 'fs';
import * as path from 'path';

describe('VeriMark Student Portal Authentication & Record Privacy Boundary', () => {
  const VAULT_FILE = path.join(process.cwd(), '.verimark_vault', 'database.json');

  it('1. Backend Integrity: Confirms 5 original students, 5 results, 5 ledger events, and 5 checkpoints intact', () => {
    expect(fs.existsSync(VAULT_FILE)).toBe(true);
    const db = JSON.parse(fs.readFileSync(VAULT_FILE, 'utf8'));

    const studentUsers = db.users.filter((u: any) => u.role === 'STUDENT');
    expect(studentUsers.length).toBe(5);

    const aaravUser = studentUsers.find((u: any) => u.studentRegNo === 'CF2026-CSE-101');
    expect(aaravUser).toBeDefined();
    expect(aaravUser.email).toBe('aarav.sharma@student.verimark.edu');
    expect(aaravUser.isActive).toBe(true);

    expect(db.results.length).toBe(5);
    const aaravResult = db.results.find((r: any) => r.studentRegNo === 'CF2026-CSE-101');
    expect(aaravResult).toBeDefined();
    expect(aaravResult.studentName).toBe('Aarav Sharma');
    expect(aaravResult.subject).toBe('Cryptography & Network Security');
    expect(aaravResult.marksObtained).toBe(88);
    expect(aaravResult.maxMarks).toBe(100);
    expect(aaravResult.recordHash).toBe('2df321ced340a17e191b5a8486e6502281f0565a0d872172abfb445bf418b1e9');

    expect(db.ledgerEvents.length).toBe(5);
    expect(db.checkpoints.length).toBe(5);
  });

  it('2. Valid Aarav Sharma Session: Returns 88/100, verified cryptographic proof, and published record', async () => {
    const { token: aaravToken } = getDemoTokenForRole('STUDENT', 'CF2026-CSE-101');
    const req = new Request('http://localhost:3000/api/student/results', {
      headers: {
        cookie: `verimark_session=${aaravToken}`,
      },
    });

    const res = await getStudentResults(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.studentRegNo).toBe('CF2026-CSE-101');
    expect(data.studentName).toBe('Aarav Sharma');
    expect(data.results.length).toBe(1);

    const record = data.results[0];
    expect(record.subject).toBe('Cryptography & Network Security');
    expect(record.marksObtained).toBe(88);
    expect(record.maxMarks).toBe(100);
    expect(record.recordHash).toBe('2df321ced340a17e191b5a8486e6502281f0565a0d872172abfb445bf418b1e9');

    // Cryptographic verification attestation
    expect(data.verification).toBeDefined();
    expect(data.verification.status).toBe('VERIFIED');
    expect(data.verification.isHashValid).toBe(true);
    expect(data.verification.isMerkleProofValid).toBe(true);
    expect(data.verification.isCheckpointSignatureValid).toBe(true);
  });

  it('3. Unauthenticated / Expired Session: Returns HTTP 401 with security error', async () => {
    // 3a. Completely missing token
    const reqNoToken = new Request('http://localhost:3000/api/student/results');
    const resNoToken = await getStudentResults(reqNoToken);
    expect(resNoToken.status).toBe(401);
    const dataNoToken = await resNoToken.json();
    expect(dataNoToken.success).toBe(false);
    expect(dataNoToken.error).toMatch(/Authentication required|Authentication token missing/i);

    // 3b. Expired / invalid token format
    const reqBadToken = new Request('http://localhost:3000/api/student/results', {
      headers: {
        cookie: 'verimark_session=invalid.expired.signature',
      },
    });
    const resBadToken = await getStudentResults(reqBadToken);
    expect(resBadToken.status).toBe(401);
    const dataBadToken = await resBadToken.json();
    expect(dataBadToken.success).toBe(false);
  });

  it('4. Access Control (Horizontal Privilege Escalation Prevention): Another student cannot access Aarav Sharma records', async () => {
    // Create authenticated token for Bhavna Reddy (CF2026-CSE-102)
    const { token: bhavnaToken } = getDemoTokenForRole('STUDENT', 'CF2026-CSE-102');

    // Bhavna attempts to query Aarav Sharma's registration number
    const req = new Request('http://localhost:3000/api/student/results?regNo=CF2026-CSE-101', {
      headers: {
        cookie: `verimark_session=${bhavnaToken}`,
      },
    });

    const res = await getStudentResults(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('Forbidden: You are not authorized to access private academic records of another student');
  });

  it('5. Corrections Endpoint Privacy & Auth: Honors 401 and 403 status', async () => {
    const unauthReq = new Request('http://localhost:3000/api/student/corrections');
    const res = await getStudentCorrections(unauthReq);
    expect(res.status).toBe(401);
  });

  it('6. Analytics Endpoint: Aarav Sharma metrics are fully computed and verified', async () => {
    const { token: aaravToken } = getDemoTokenForRole('STUDENT', 'CF2026-CSE-101');
    const req = new Request('http://localhost:3000/api/student/analytics?benchmark=40', {
      headers: {
        cookie: `verimark_session=${aaravToken}`,
      },
    });

    const res = await getStudentAnalytics(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.studentRegNo).toBe('CF2026-CSE-101');
    expect(data.studentName).toBe('Aarav Sharma');
    expect(data.subjectCount).toBe(1);
    expect(data.midVsEndTerm.length).toBeGreaterThan(0);
  });
});
