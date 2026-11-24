// ==============================================================================
// VERIMARK – Phase 3 Multi-Tenant SaaS Architecture Test Suite
// ==============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { dbService } from '@/lib/storage/db';
import { createSessionToken } from '@/lib/server/auth';
import { GET as getInstitutionsRoute, POST as createInstitutionRoute } from '@/app/api/institutions/route';
import { GET as getInstitutionByIdRoute, PATCH as patchInstitutionRoute } from '@/app/api/institutions/[id]/route';
import { GET as getStudentsRoute, POST as createStudentRoute } from '@/app/api/students/route';
import { GET as getStudentByIdRoute, PUT as updateStudentRoute } from '@/app/api/students/[id]/route';
import { GET as getExamsRoute, POST as createExamRoute } from '@/app/api/examinations/route';
import { GET as getExamByIdRoute, PUT as updateExamRoute } from '@/app/api/examinations/[id]/route';
import { GET as getUsersRoute, POST as createUserRoute } from '@/app/api/users/route';
import { PUT as updateUserRoute } from '@/app/api/users/[id]/route';
import { GET as getResultsRoute, POST as createResultRoute } from '@/app/api/results/route';
import { POST as publishResultRoute } from '@/app/api/results/[id]/publish/route';
import { GET as getCorrectionsRoute, POST as createCorrectionRoute } from '@/app/api/corrections/route';
import { POST as approveCorrectionRoute } from '@/app/api/corrections/[id]/approve/route';
import { GET as getStudentResultsRoute } from '@/app/api/student/results/route';
import { GET as getStudentAnalyticsRoute } from '@/app/api/student/analytics/route';
import { GET as getVerifyRoute } from '@/app/api/verify/[id]/route';
import { GET as getQrRoute } from '@/app/api/results/[id]/qr/route';
import { computeResultRecordHash } from '@/lib/crypto/sha256';
import { verifyCheckpoint } from '@/lib/crypto/ed25519';

describe('Phase 3: Multi-Tenant SaaS Architecture & Tenant Isolation Tests', () => {
  // Tokens
  const superAdminToken = createSessionToken({
    id: 'usr_super_00',
    email: 'superadmin@verimark.saas',
    name: 'Global SaaS Administrator',
    role: 'SUPER_ADMIN',
  });

  const instAAdminToken = createSessionToken({
    id: 'usr_admin_inst_a',
    institutionId: 'inst_verimark_01',
    email: 'admin@verimark.edu',
    name: 'Institution A Admin',
    role: 'INSTITUTION_ADMIN',
  });

  const instBAdminToken = createSessionToken({
    id: 'usr_admin_inst_b',
    institutionId: 'inst_apex_univ_02',
    email: 'admin@apex.edu',
    name: 'Institution B Admin',
    role: 'INSTITUTION_ADMIN',
  });

  const instAStudentToken = createSessionToken({
    id: 'usr_student_101',
    institutionId: 'inst_verimark_01',
    email: 'aarav.sharma@student.verimark.edu',
    name: 'Aarav Sharma',
    role: 'STUDENT',
    studentRegNo: 'CF2026-CSE-101',
  });

  const instBStudentToken = createSessionToken({
    id: 'usr_student_b_201',
    institutionId: 'inst_apex_univ_02',
    email: 'rohan.mehta@student.apex.edu',
    name: 'Rohan Mehta',
    role: 'STUDENT',
    studentRegNo: 'APEX-2026-001',
  });

  beforeEach(async () => {
    dbService.resetForTesting();
    await dbService.seedInitialData();

    // Create a second tenant institution for testing
    await dbService.createInstitution({
      id: 'inst_apex_univ_02',
      code: 'APEX_UNIV',
      name: 'Apex Institute of Technology',
      domain: 'apex.edu',
      status: 'active',
    });

    // Create a student in Institution B
    await dbService.createStudent({
      id: 'stud_b_201',
      institutionId: 'inst_apex_univ_02',
      regNo: 'APEX-2026-001',
      fullName: 'Rohan Mehta',
      email: 'rohan.mehta@student.apex.edu',
      course: 'B.Tech Information Technology',
      department: 'Information Technology',
      batchYear: '2022-2026',
      status: 'active',
    });

    // Create an exam in Institution B
    await dbService.createExamination({
      id: 'exam_apex_01',
      institutionId: 'inst_apex_univ_02',
      examCode: 'APEX-EX-2026',
      examName: 'Apex Final Semester Exam 2026',
      semester: 'Semester 8',
      academicYear: '2025-2026',
      department: 'Information Technology',
      status: 'published',
      conductedDate: '2026-05-15',
    });

    // Create a result in Institution B
    const resB = await dbService.createResult({
      institutionId: 'inst_apex_univ_02',
      examinationId: 'exam_apex_01',
      studentRegNo: 'APEX-2026-001',
      studentName: 'Rohan Mehta',
      course: 'B.Tech Information Technology',
      subject: 'Cloud Computing & Distributed Systems',
      examName: 'Apex Final Semester Exam 2026',
      marksObtained: 89,
      maxMarks: 100,
    });
    await dbService.publishResult(resB.id);
  });

  describe('1. Platform Super Admin vs Institution Admin Privilege Separation', () => {
    it('allows SUPER_ADMIN to list all institutions on the SaaS platform', async () => {
      const req = new Request('http://localhost:3000/api/institutions', {
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });
      const res = await getInstitutionsRoute(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.institutions.length).toBeGreaterThanOrEqual(2);
      expect(data.institutions.some((i: any) => i.id === 'inst_verimark_01')).toBe(true);
      expect(data.institutions.some((i: any) => i.id === 'inst_apex_univ_02')).toBe(true);
    });

    it('restricts Institution Admin to only view their own institution', async () => {
      const req = new Request('http://localhost:3000/api/institutions', {
        headers: { Authorization: `Bearer ${instAAdminToken}` },
      });
      const res = await getInstitutionsRoute(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.institutions.length).toBe(1);
      expect(data.institutions[0].id).toBe('inst_verimark_01');
    });

    it('rejects Institution Admin attempting to provision a new institution with HTTP 403', async () => {
      const req = new Request('http://localhost:3000/api/institutions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${instAAdminToken}`,
        },
        body: JSON.stringify({
          code: 'ILLEGAL_UNIV',
          name: 'Illegal University',
          domain: 'illegal.edu',
        }),
      });
      const res = await createInstitutionRoute(req);
      expect(res.status).toBe(403);
    });

    it('allows SUPER_ADMIN to provision a new institution with HTTP 201', async () => {
      const req = new Request('http://localhost:3000/api/institutions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          code: 'METRO_UNIV',
          name: 'Metropolitan University',
          domain: 'metro.edu',
        }),
      });
      const res = await createInstitutionRoute(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.institution.code).toBe('METRO_UNIV');
    });

    it('blocks Institution Admin from provisioning a SUPER_ADMIN account with HTTP 403', async () => {
      const req = new Request('http://localhost:3000/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${instAAdminToken}`,
        },
        body: JSON.stringify({
          email: 'hacker@verimark.saas',
          name: 'Privilege Escalator',
          role: 'SUPER_ADMIN',
        }),
      });
      const res = await createUserRoute(req);
      expect(res.status).toBe(403);
    });
  });

  describe('2. Strict Cross-Tenant Isolation: Institution A vs Institution B', () => {
    it('Institution A Admin cannot access Institution B students via ?institutionId query param', async () => {
      const req = new Request('http://localhost:3000/api/students?institutionId=inst_apex_univ_02', {
        headers: { Authorization: `Bearer ${instAAdminToken}` },
      });
      const res = await getStudentsRoute(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain('Cross-tenant access denied');
    });

    it('Institution B Admin cannot access Institution A students via ?institutionId query param', async () => {
      const req = new Request('http://localhost:3000/api/students?institutionId=inst_verimark_01', {
        headers: { Authorization: `Bearer ${instBAdminToken}` },
      });
      const res = await getStudentsRoute(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain('Cross-tenant access denied');
    });

    it('Institution A Admin cannot update a student belonging to Institution B', async () => {
      const req = new Request('http://localhost:3000/api/students/stud_b_201', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${instAAdminToken}`,
        },
        body: JSON.stringify({ fullName: 'Tampered Student Name' }),
      });
      const res = await updateStudentRoute(req, { params: { id: 'stud_b_201' } });
      expect(res.status).toBe(403);
    });

    it('Institution A Admin cannot view results of Institution B', async () => {
      const req = new Request('http://localhost:3000/api/results?institutionId=inst_apex_univ_02', {
        headers: { Authorization: `Bearer ${instAAdminToken}` },
      });
      const res = await getResultsRoute(req);
      expect(res.status).toBe(403);
    });

    it('Institution A Admin cannot publish or tamper results of Institution B', async () => {
      const bResults = await dbService.getResults('inst_apex_univ_02');
      const bResId = bResults[0].id;

      const req = new Request(`http://localhost:3000/api/results/${bResId}/publish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${instAAdminToken}` },
      });
      const res = await publishResultRoute(req, { params: { id: bResId } });
      expect(res.status).toBe(403);
    });

    it('Institution A Controller cannot approve correction requests of Institution B', async () => {
      // Create correction in Institution B
      const bResults = await dbService.getResults('inst_apex_univ_02');
      const reqB = await dbService.createCorrectionRequest({
        id: 'req_apex_test_01',
        institutionId: 'inst_apex_univ_02',
        resultId: bResults[0].id,
        studentRegNo: bResults[0].studentRegNo,
        subject: bResults[0].subject,
        originalMarks: 89,
        proposedMarks: 95,
        originalHash: bResults[0].recordHash,
        proposedHash: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        reason: 'Re-evaluation of question 4',
        status: 'pending_approvals',
        requesterUserId: 'usr_admin_inst_b',
        requesterName: 'Institution B Admin',
        approvals: [],
        createdAt: new Date().toISOString(),
      });

      const controllerA = createSessionToken({
        id: 'usr_controller_02',
        institutionId: 'inst_verimark_01',
        email: 'controller@verimark.edu',
        name: 'Dr. Robert Vance',
        role: 'EXAM_CONTROLLER',
      });

      const approveReq = new Request(`http://localhost:3000/api/corrections/${reqB.id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${controllerA}` },
      });
      const approveRes = await approveCorrectionRoute(approveReq, { params: { id: reqB.id } });
      expect(approveRes.status).toBe(403);
    });
  });

  describe('3. Student Privacy & Cross-Student Record Protection', () => {
    it('student cannot view another student records within the same institution', async () => {
      // Student 101 requests Student 102's records
      const req = new Request('http://localhost:3000/api/student/results?regNo=CF2026-CSE-102', {
        headers: { Authorization: `Bearer ${instAStudentToken}` },
      });
      const res = await getStudentResultsRoute(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain('Forbidden: You are not authorized to access private academic records of another student');
    });

    it('student cannot view another student analytics', async () => {
      const req = new Request('http://localhost:3000/api/student/analytics?regNo=CF2026-CSE-102', {
        headers: { Authorization: `Bearer ${instAStudentToken}` },
      });
      const res = await getStudentAnalyticsRoute(req);
      expect(res.status).toBe(403);
    });

    it('student from Institution A cannot access student records in Institution B', async () => {
      const req = new Request('http://localhost:3000/api/student/results?regNo=APEX-2026-001', {
        headers: { Authorization: `Bearer ${instAStudentToken}` },
      });
      const res = await getStudentResultsRoute(req);
      expect(res.status).toBe(403);
    });
  });

  describe('4. Independent Ledger Event Chains & Checkpoint Isolation', () => {
    it('maintains independent sequence numbers and Merkle roots across tenants', async () => {
      const instAEvents = await dbService.getLedgerEvents('inst_verimark_01');
      const instBEvents = await dbService.getLedgerEvents('inst_apex_univ_02');

      const instACheckpoints = await dbService.getCheckpoints('inst_verimark_01');
      const instBCheckpoints = await dbService.getCheckpoints('inst_apex_univ_02');

      // Institution A has 5 published records and 5 checkpoints
      expect(instAEvents.length).toBe(5);
      expect(instACheckpoints.length).toBe(5);

      // Institution B has its own independent event and checkpoint
      expect(instBEvents.length).toBe(1);
      expect(instBEvents[0].sequenceNumber).toBe(1);
      expect(instBCheckpoints.length).toBe(1);
      expect(instBCheckpoints[0].sequenceNumber).toBe(1);

      // Merkle roots must be distinct
      expect(instACheckpoints[instACheckpoints.length - 1].merkleRoot).not.toBe(
        instBCheckpoints[0].merkleRoot
      );
    });
  });

  describe('5. Preservation of Original VeriMark Records & Hashes', () => {
    it('verifies all 5 original VeriMark student marks and canonical hashes remain authentic', async () => {
      const originalResults = await dbService.getResults('inst_verimark_01');
      expect(originalResults.length).toBe(5);

      const expected = [
        { regNo: 'CF2026-CSE-101', name: 'Aarav Sharma', marks: 88 },
        { regNo: 'CF2026-CSE-102', name: 'Bhavna Reddy', marks: 94 },
        { regNo: 'CF2026-CSE-103', name: 'Chetan Verma', marks: 76 },
        { regNo: 'CF2026-CSE-104', name: 'Divya Nair', marks: 91 },
        { regNo: 'CF2026-CSE-105', name: 'Eshan Roy', marks: 83 },
      ];

      for (const exp of expected) {
        const r = originalResults.find((x) => x.studentRegNo === exp.regNo);
        expect(r).toBeDefined();
        expect(Number(r!.marksObtained)).toBe(exp.marks);

        const { recordHash } = computeResultRecordHash({
          studentRegNo: r!.studentRegNo,
          studentName: r!.studentName,
          course: r!.course,
          subject: r!.subject,
          examName: r!.examName,
          marksObtained: r!.marksObtained,
          maxMarks: r!.maxMarks,
          publicationDate: r!.publicationDate,
        });
        expect(recordHash.toLowerCase()).toBe(r!.recordHash.toLowerCase());
      }
    });

    it('verifies all 5 original Ed25519 checkpoint signatures remain valid', async () => {
      const checkpoints = await dbService.getCheckpoints('inst_verimark_01');
      expect(checkpoints.length).toBe(5);

      for (const chk of checkpoints) {
        const v = verifyCheckpoint(chk);
        expect(v.isValid).toBe(true);
      }
    });
  });

  describe('6. Public QR Code Verification Security & Minimal Exposure', () => {
    it('public QR endpoint generates valid verification URL without exposing secrets', async () => {
      const results = await dbService.getResults('inst_verimark_01');
      const resId = results[0].id;

      const req = new Request(`http://localhost:3000/api/results/${resId}/qr`);
      const res = await getQrRoute(req, { params: { id: resId } });
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.verifyUrl).toContain(`/verify/${resId}`);
      expect(data.qrDataUrl).toMatch(/^data:image\/png;base64,/);
      expect(data.recordHash).toBe(results[0].recordHash);
    });

    it('public /api/verify/[id] exposes only minimal necessary verification info (no passwords/salts)', async () => {
      const results = await dbService.getResults('inst_verimark_01');
      const resId = results[0].id;

      const req = new Request(`http://localhost:3000/api/verify/${resId}`);
      const res = await getVerifyRoute(req, { params: { id: resId } });
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.verification.status).toBe('VERIFIED');
      expect(data.verification.result).toBeDefined();
      expect(data.verification.result.studentRegNo).toBe('CF2026-CSE-101');
      expect(data.verification.result.passwordHash).toBeUndefined();
      expect(data.verification.result.salt).toBeUndefined();
    });
  });
});
