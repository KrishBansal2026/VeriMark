import * as fs from 'fs';
import * as path from 'path';
import {
  StudentResult,
  LedgerEvent,
  LedgerCheckpoint,
  CorrectionRequest,
  CorrectionApproval,
  ApproverRole,
  AuthUser,
  Institution,
  StudentProfile,
  Examination,
  SubjectItem,
  UserRole,
} from '../types';
import { computeResultRecordHash, hashLeaf, sha256, canonicalizeJson } from '../crypto/sha256';
import { MerkleTree } from '../crypto/merkle';
import {
  createSignedCheckpoint,
  verifyWithEd25519,
  signWithEd25519,
  verifyCheckpoint,
} from '../crypto/ed25519';
import { getServerKeys } from '../server/keys';
import {
  commitIndependentCheckpoint,
  getLatestIndependentCheckpoint,
  resetIndependentStoreForTesting,
} from './independentCheckpointStore';
import { getVaultDir, safeWriteFileSync as safeWriteVaultFile } from './vaultConfig';
import { CANONICAL_DATABASE } from './canonicalVaultData';
import { scryptSync } from 'crypto';

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString('hex');
}

function getDbFile(): string {
  return path.join(getVaultDir(), 'database.json');
}

export interface StoredUserRecord {
  id: string;
  institutionId?: string;
  email: string;
  name: string;
  role: UserRole;
  passwordHash: string;
  salt: string;
  passwordSalt?: string;
  studentRegNo?: string;
  mustChangePassword?: boolean;
  isActive?: boolean;
  publicKey?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StoredAuditLog {
  id: string;
  institutionId?: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  createdAt: string;
}

export interface DatabaseSchema {
  institutions: Institution[];
  users: StoredUserRecord[];
  students: StudentProfile[];
  examinations: Examination[];
  subjects: SubjectItem[];
  results: StudentResult[];
  ledgerEvents: LedgerEvent[];
  checkpoints: LedgerCheckpoint[];
  correctionRequests: CorrectionRequest[];
  auditLogs: StoredAuditLog[];
  revokedTokens: { tokenHash: string; userId: string; revokedAt: string; expiresAt: string }[];
}

export const DEFAULT_INSTITUTION: Institution = {
  id: 'inst_verimark_01',
  code: 'VERIMARK',
  name: 'VeriMark Institute of Higher Learning',
  domain: 'verimark.edu',
  themeColor: '#0284c7',
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

export const DEFAULT_EXAMINATIONS: Examination[] = [
  {
    id: 'exam_endsem_2026',
    institutionId: 'inst_verimark_01',
    examCode: 'ENDSEM-2026',
    examName: 'End Semester Examination 2026',
    semester: 'Semester 8',
    academicYear: '2025-2026',
    department: 'Computer Science & Engineering',
    status: 'published',
    conductedDate: '2026-05-15',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

export const DEFAULT_SUBJECTS: SubjectItem[] = [
  {
    id: 'subj_cns',
    institutionId: 'inst_verimark_01',
    subjectCode: 'CS801',
    subjectName: 'Cryptography & Network Security',
    department: 'Computer Science & Engineering',
    credits: 4,
    maxMarks: 100,
    passingMarks: 40,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'subj_dlt',
    institutionId: 'inst_verimark_01',
    subjectCode: 'CS802',
    subjectName: 'Distributed Ledger Technologies',
    department: 'Computer Science & Engineering',
    credits: 4,
    maxMarks: 100,
    passingMarks: 40,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'subj_dsa',
    institutionId: 'inst_verimark_01',
    subjectCode: 'CS803',
    subjectName: 'Database Systems Architecture',
    department: 'Computer Science & Engineering',
    credits: 4,
    maxMarks: 100,
    passingMarks: 40,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'subj_oss',
    institutionId: 'inst_verimark_01',
    subjectCode: 'CS804',
    subjectName: 'Operating Systems & Security',
    department: 'Computer Science & Engineering',
    credits: 4,
    maxMarks: 100,
    passingMarks: 40,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'subj_ada',
    institutionId: 'inst_verimark_01',
    subjectCode: 'CS805',
    subjectName: 'Algorithm Design & Analysis',
    department: 'Computer Science & Engineering',
    credits: 4,
    maxMarks: 100,
    passingMarks: 40,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

export const DEFAULT_STUDENTS: StudentProfile[] = [
  {
    id: 'stud_101',
    institutionId: 'inst_verimark_01',
    regNo: 'CF2026-CSE-101',
    fullName: 'Aarav Sharma',
    email: 'aarav.sharma@student.verimark.edu',
    course: 'B.Tech Computer Science & Engineering',
    department: 'Computer Science & Engineering',
    batchYear: '2022-2026',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'stud_102',
    institutionId: 'inst_verimark_01',
    regNo: 'CF2026-CSE-102',
    fullName: 'Bhavna Reddy',
    email: 'bhavna.reddy@student.verimark.edu',
    course: 'B.Tech Computer Science & Engineering',
    department: 'Computer Science & Engineering',
    batchYear: '2022-2026',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'stud_103',
    institutionId: 'inst_verimark_01',
    regNo: 'CF2026-CSE-103',
    fullName: 'Chetan Verma',
    email: 'chetan.verma@student.verimark.edu',
    course: 'B.Tech Computer Science & Engineering',
    department: 'Computer Science & Engineering',
    batchYear: '2022-2026',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'stud_104',
    institutionId: 'inst_verimark_01',
    regNo: 'CF2026-CSE-104',
    fullName: 'Divya Nair',
    email: 'divya.nair@student.verimark.edu',
    course: 'B.Tech Computer Science & Engineering',
    department: 'Computer Science & Engineering',
    batchYear: '2022-2026',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'stud_105',
    institutionId: 'inst_verimark_01',
    regNo: 'CF2026-CSE-105',
    fullName: 'Eshan Roy',
    email: 'eshan.roy@student.verimark.edu',
    course: 'B.Tech Computer Science & Engineering',
    department: 'Computer Science & Engineering',
    batchYear: '2022-2026',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

export const DEFAULT_USERS: StoredUserRecord[] = [
  {
    id: 'usr_super_00',
    email: 'superadmin@verimark.saas',
    name: 'Global SaaS Administrator',
    role: 'SUPER_ADMIN',
    salt: 'salt_super_cf2026',
    passwordHash: hashPassword('SuperAdmin@2026!', 'salt_super_cf2026'),
    mustChangePassword: false,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'usr_admin_01',
    institutionId: 'inst_verimark_01',
    email: 'admin@verimark.edu',
    name: 'Chief Academic Officer',
    role: 'ADMIN',
    salt: 'salt_admin_cf2026',
    passwordHash: hashPassword('Admin@2026!', 'salt_admin_cf2026'),
    mustChangePassword: false,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'usr_controller_02',
    institutionId: 'inst_verimark_01',
    email: 'controller@verimark.edu',
    name: 'Dr. Robert Vance',
    role: 'EXAM_CONTROLLER',
    salt: 'salt_ctrl_cf2026',
    passwordHash: hashPassword('Controller@2026!', 'salt_ctrl_cf2026'),
    mustChangePassword: false,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'usr_dean_03',
    institutionId: 'inst_verimark_01',
    email: 'dean@verimark.edu',
    name: 'Prof. Margaret Hamilton',
    role: 'ACADEMIC_DEAN',
    salt: 'salt_dean_cf2026',
    passwordHash: hashPassword('Dean@2026!', 'salt_dean_cf2026'),
    mustChangePassword: false,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'usr_auditor_04',
    institutionId: 'inst_verimark_01',
    email: 'auditor@verimark.edu',
    name: 'Dr. Elena Rostova',
    role: 'AUDITOR',
    salt: 'salt_audit_cf2026',
    passwordHash: hashPassword('Auditor@2026!', 'salt_audit_cf2026'),
    mustChangePassword: false,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'usr_faculty_05',
    institutionId: 'inst_verimark_01',
    email: 'faculty@verimark.edu',
    name: 'Dr. Alan Turing',
    role: 'FACULTY',
    salt: 'salt_faculty_cf2026',
    passwordHash: hashPassword('Faculty@2026!', 'salt_faculty_cf2026'),
    mustChangePassword: false,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'usr_student_101',
    institutionId: 'inst_verimark_01',
    email: 'aarav.sharma@student.verimark.edu',
    name: 'Aarav Sharma',
    role: 'STUDENT',
    studentRegNo: 'CF2026-CSE-101',
    salt: 'salt_stud_101_cf2026',
    passwordHash: hashPassword('Act#Aarav$2026!', 'salt_stud_101_cf2026'),
    mustChangePassword: true,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'usr_student_102',
    institutionId: 'inst_verimark_01',
    email: 'bhavna.reddy@student.verimark.edu',
    name: 'Bhavna Reddy',
    role: 'STUDENT',
    studentRegNo: 'CF2026-CSE-102',
    salt: 'salt_stud_102_cf2026',
    passwordHash: hashPassword('Act#Bhavna$2026!', 'salt_stud_102_cf2026'),
    mustChangePassword: true,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'usr_student_103',
    institutionId: 'inst_verimark_01',
    email: 'chetan.verma@student.verimark.edu',
    name: 'Chetan Verma',
    role: 'STUDENT',
    studentRegNo: 'CF2026-CSE-103',
    salt: 'salt_stud_103_cf2026',
    passwordHash: hashPassword('Act#Chetan$2026!', 'salt_stud_103_cf2026'),
    mustChangePassword: true,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'usr_student_104',
    institutionId: 'inst_verimark_01',
    email: 'divya.nair@student.verimark.edu',
    name: 'Divya Nair',
    role: 'STUDENT',
    studentRegNo: 'CF2026-CSE-104',
    salt: 'salt_stud_104_cf2026',
    passwordHash: hashPassword('Act#Divya$2026!', 'salt_stud_104_cf2026'),
    mustChangePassword: true,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'usr_student_105',
    institutionId: 'inst_verimark_01',
    email: 'eshan.roy@student.verimark.edu',
    name: 'Eshan Roy',
    role: 'STUDENT',
    studentRegNo: 'CF2026-CSE-105',
    salt: 'salt_stud_105_cf2026',
    passwordHash: hashPassword('Act#Eshan$2026!', 'salt_stud_105_cf2026'),
    mustChangePassword: true,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

function sanitizeDb(data: any): DatabaseSchema {
  if (!data || typeof data !== 'object') {
    data = {};
  }
  if (!Array.isArray(data.institutions) || data.institutions.length === 0) {
    data.institutions = [DEFAULT_INSTITUTION];
  }
  if (!Array.isArray(data.students) || data.students.length === 0) {
    data.students = [...DEFAULT_STUDENTS];
  }
  if (!Array.isArray(data.examinations) || data.examinations.length === 0) {
    data.examinations = [...DEFAULT_EXAMINATIONS];
  }
  if (!Array.isArray(data.subjects) || data.subjects.length === 0) {
    data.subjects = [...DEFAULT_SUBJECTS];
  }
  if (!Array.isArray(data.users) || data.users.length === 0) {
    data.users = [...DEFAULT_USERS];
  } else {
    for (const u of data.users) {
      if (!u.salt && u.passwordSalt) {
        u.salt = u.passwordSalt;
      }
      if (!u.passwordSalt && u.salt) {
        u.passwordSalt = u.salt;
      }
    }
  }
  if (!Array.isArray(data.results)) {
    data.results = [];
  }
  if (!Array.isArray(data.ledgerEvents)) {
    data.ledgerEvents = [];
  }
  if (!Array.isArray(data.checkpoints)) {
    data.checkpoints = [];
  }
  if (!Array.isArray(data.correctionRequests)) {
    data.correctionRequests = [];
  }
  if (!Array.isArray(data.auditLogs)) {
    data.auditLogs = [];
  }
  if (!Array.isArray(data.revokedTokens)) {
    data.revokedTokens = [];
  }

  // Ensure default tenant assignment for legacy data
  for (const r of data.results) {
    if (!r.institutionId) r.institutionId = 'inst_verimark_01';
  }
  for (const ev of data.ledgerEvents) {
    if (!ev.institutionId) ev.institutionId = 'inst_verimark_01';
  }
  for (const chk of data.checkpoints) {
    if (!chk.institutionId) chk.institutionId = 'inst_verimark_01';
  }
  for (const req of data.correctionRequests) {
    if (!req.institutionId) req.institutionId = 'inst_verimark_01';
  }

  return data as DatabaseSchema;
}

export function ensureDbFile(): DatabaseSchema {
  const dbFile = getDbFile();

  if (fs.existsSync(dbFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
      if (data && Array.isArray(data.results) && data.results.length > 0) {
        return sanitizeDb(data);
      }
    } catch (err) {}
  }

  // Check if repository cwd has pre-existing database.json
  const cwdDb = path.join(process.cwd(), '.verimark_vault', 'database.json');
  if (fs.existsSync(cwdDb)) {
    try {
      const data = JSON.parse(fs.readFileSync(cwdDb, 'utf8'));
      if (data && Array.isArray(data.results) && data.results.length > 0) {
        const sanitized = sanitizeDb(data);
        safeWriteVaultFile(dbFile, JSON.stringify(sanitized, null, 2));
        return sanitized;
      }
    } catch {}
  }

  // Fallback to canonical snapshot ensuring academic records are never lost or empty
  const initialDb: DatabaseSchema = sanitizeDb(JSON.parse(JSON.stringify(CANONICAL_DATABASE)));
  console.warn('[VeriMark Vault] Warning: No existing vault data found; falling back to canonical snapshot. Original records may be missing.');
  safeWriteVaultFile(dbFile, JSON.stringify(initialDb, null, 2));
  return initialDb;
}

function saveDb(data: DatabaseSchema): void {
  const dbFile = getDbFile();
  safeWriteVaultFile(dbFile, JSON.stringify(data, null, 2));
}

/**
 * Commits a new signed checkpoint across the entire ledger.
 */
export async function commitLedgerCheckpoint(institutionId = 'inst_verimark_01'): Promise<LedgerCheckpoint> {
  const db = ensureDbFile();
  const keys = getServerKeys();

  const publishedResults = db.results.filter(
    (r) =>
      (!r.institutionId || r.institutionId === institutionId) &&
      (r.status === 'published' || r.status === 'corrected')
  );

  publishedResults.sort((a, b) =>
    `${a.studentRegNo}_${a.subject}`.localeCompare(`${b.studentRegNo}_${b.subject}`)
  );

  const leafRecordHashes = publishedResults.map((r) => r.recordHash);
  const tree = new MerkleTree(leafRecordHashes);
  const merkleRoot = tree.getRoot();

  publishedResults.forEach((r, idx) => {
    r.merkleIndex = idx;
    r.merkleLeafHash = hashLeaf(r.recordHash);
  });

  const instCheckpoints = db.checkpoints.filter(
    (c) => !c.institutionId || c.institutionId === institutionId
  );
  const prevCheckpoint = instCheckpoints.length > 0 ? instCheckpoints[instCheckpoints.length - 1] : null;

  const prevCheckpointHash = prevCheckpoint
    ? prevCheckpoint.checkpointHash
    : '0000000000000000000000000000000000000000000000000000000000000000';

  const sequenceNumber = (prevCheckpoint?.sequenceNumber || 0) + 1;

  const instEvents = db.ledgerEvents.filter(
    (e) => !e.institutionId || e.institutionId === institutionId
  );

  const checkpoint = createSignedCheckpoint(
    {
      sequenceNumber,
      merkleRoot,
      eventCount: instEvents.length,
      leafCount: publishedResults.length,
      prevCheckpointHash,
    },
    keys.ledgerAuthority.privateKey,
    keys.ledgerAuthority.publicKey
  );
  checkpoint.institutionId = institutionId;

  publishedResults.forEach((r) => {
    r.checkpointId = checkpoint.id;
  });

  db.checkpoints.push(checkpoint);
  saveDb(db);

  await commitIndependentCheckpoint(checkpoint);

  return checkpoint;
}

/**
 * Appends a verified event to the append-only ledger sequence.
 */
export function appendLedgerEvent(
  eventType: LedgerEvent['eventType'],
  recordId: string,
  studentRegNo: string,
  payload: Record<string, any>,
  institutionId = 'inst_verimark_01'
): LedgerEvent {
  const db = ensureDbFile();

  const instEvents = db.ledgerEvents.filter(
    (e) => !e.institutionId || e.institutionId === institutionId
  );
  const prevEvent = instEvents.length > 0 ? instEvents[instEvents.length - 1] : null;

  const prevEventHash = prevEvent
    ? prevEvent.eventHash
    : '0000000000000000000000000000000000000000000000000000000000000000';

  const sequenceNumber = (prevEvent?.sequenceNumber || 0) + 1;
  const payloadHash = sha256(canonicalizeJson(payload));
  const eventHash = sha256(
    `${sequenceNumber}:${eventType}:${recordId}:${payloadHash}:${prevEventHash}`
  );

  const event: LedgerEvent = {
    id: `evt_${sequenceNumber}_${eventHash.substring(0, 10)}`,
    institutionId,
    sequenceNumber,
    eventType,
    recordId,
    studentRegNo,
    payload,
    payloadHash,
    prevEventHash,
    eventHash,
    createdAt: new Date().toISOString(),
  };

  db.ledgerEvents.push(event);
  saveDb(db);
  return event;
}

export const dbService = {
  resetForTesting: (): void => {
    resetIndependentStoreForTesting();
    const cleanDb: DatabaseSchema = {
      institutions: [DEFAULT_INSTITUTION],
      users: [...DEFAULT_USERS],
      students: [...DEFAULT_STUDENTS],
      examinations: [...DEFAULT_EXAMINATIONS],
      subjects: [...DEFAULT_SUBJECTS],
      results: [],
      ledgerEvents: [],
      checkpoints: [],
      correctionRequests: [],
      auditLogs: [],
      revokedTokens: [],
    };
    saveDb(cleanDb);
  },

  // Institutions
  getInstitutions: async (): Promise<Institution[]> => {
    const db = ensureDbFile();
    return db.institutions;
  },

  getInstitutionById: async (id: string): Promise<Institution | null> => {
    const db = ensureDbFile();
    return db.institutions.find((i) => i.id === id) || null;
  },

  createInstitution: async (data: Partial<Institution>): Promise<Institution> => {
    const db = ensureDbFile();
    const newInst: Institution = {
      id: data.id || `inst_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      code: (data.code || 'INST').toUpperCase(),
      name: data.name || 'New Institution',
      domain: data.domain || `inst-${Date.now()}.edu`,
      logoUrl: data.logoUrl,
      themeColor: data.themeColor || '#0284c7',
      status: data.status || 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.institutions.push(newInst);
    saveDb(db);
    return newInst;
  },

  // Students Directory
  getStudents: async (institutionId?: string): Promise<StudentProfile[]> => {
    const db = ensureDbFile();
    if (!institutionId) return db.students;
    return db.students.filter((s) => s.institutionId === institutionId);
  },

  getStudentByRegNo: async (regNo: string, institutionId?: string): Promise<StudentProfile | null> => {
    const db = ensureDbFile();
    const clean = regNo.trim().toUpperCase();
    return (
      db.students.find(
        (s) =>
          s.regNo.trim().toUpperCase() === clean &&
          (!institutionId || s.institutionId === institutionId)
      ) || null
    );
  },

  createStudent: async (data: Omit<StudentProfile, 'id' | 'createdAt' | 'updatedAt'>): Promise<StudentProfile> => {
    const db = ensureDbFile();
    const now = new Date().toISOString();
    const newStudent: StudentProfile = {
      ...data,
      id: `stud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: now,
      updatedAt: now,
    };
    db.students.push(newStudent);
    saveDb(db);
    return newStudent;
  },

  updateStudent: async (id: string, data: Partial<StudentProfile>): Promise<StudentProfile | null> => {
    const db = ensureDbFile();
    const idx = db.students.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    db.students[idx] = {
      ...db.students[idx],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    saveDb(db);
    return db.students[idx];
  },

  // Examinations
  getExaminations: async (institutionId?: string): Promise<Examination[]> => {
    const db = ensureDbFile();
    if (!institutionId) return db.examinations;
    return db.examinations.filter((e) => e.institutionId === institutionId);
  },

  getExaminationById: async (id: string): Promise<Examination | null> => {
    const db = ensureDbFile();
    return db.examinations.find((e) => e.id === id) || null;
  },

  createExamination: async (data: Omit<Examination, 'id' | 'createdAt'>): Promise<Examination> => {
    const db = ensureDbFile();
    const newExam: Examination = {
      ...data,
      id: `exam_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    db.examinations.push(newExam);
    saveDb(db);
    return newExam;
  },

  updateExamination: async (id: string, data: Partial<Examination>): Promise<Examination | null> => {
    const db = ensureDbFile();
    const idx = db.examinations.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    db.examinations[idx] = {
      ...db.examinations[idx],
      ...data,
    };
    saveDb(db);
    return db.examinations[idx];
  },

  // Subjects
  getSubjects: async (institutionId?: string): Promise<SubjectItem[]> => {
    const db = ensureDbFile();
    if (!institutionId) return db.subjects;
    return db.subjects.filter((s) => s.institutionId === institutionId);
  },

  createSubject: async (data: Omit<SubjectItem, 'id' | 'createdAt'>): Promise<SubjectItem> => {
    const db = ensureDbFile();
    const newSubj: SubjectItem = {
      ...data,
      id: `subj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    db.subjects.push(newSubj);
    saveDb(db);
    return newSubj;
  },

  // Users & Accounts
  getUsers: async (institutionId?: string): Promise<StoredUserRecord[]> => {
    const db = ensureDbFile();
    if (!institutionId) return db.users;
    return db.users.filter((u) => !u.institutionId || u.institutionId === institutionId);
  },

  getUserById: async (id: string): Promise<StoredUserRecord | null> => {
    const db = ensureDbFile();
    return db.users.find((u) => u.id === id) || null;
  },

  getUserByEmail: async (email: string): Promise<StoredUserRecord | null> => {
    const db = ensureDbFile();
    const clean = email.trim().toLowerCase();
    return db.users.find((u) => u.email.trim().toLowerCase() === clean) || null;
  },

  createUser: async (user: StoredUserRecord): Promise<StoredUserRecord> => {
    const db = ensureDbFile();
    db.users.push(user);
    saveDb(db);
    return user;
  },

  updateUserPassword: async (id: string, passwordHash: string, salt: string): Promise<boolean> => {
    const db = ensureDbFile();
    const user = db.users.find((u) => u.id === id);
    if (!user) return false;
    user.passwordHash = passwordHash;
    user.salt = salt;
    user.passwordSalt = salt;
    user.mustChangePassword = false;
    user.updatedAt = new Date().toISOString();
    saveDb(db);
    return true;
  },

  updateUserStatus: async (id: string, isActive: boolean): Promise<boolean> => {
    const db = ensureDbFile();
    const user = db.users.find((u) => u.id === id);
    if (!user) return false;
    user.isActive = isActive;
    user.updatedAt = new Date().toISOString();
    saveDb(db);
    return true;
  },

  // Session Revocation
  revokeToken: async (tokenHash: string, userId: string, expiresAt: string): Promise<void> => {
    const db = ensureDbFile();
    db.revokedTokens.push({
      tokenHash,
      userId,
      revokedAt: new Date().toISOString(),
      expiresAt,
    });
    saveDb(db);
  },

  isTokenRevoked: async (tokenHash: string): Promise<boolean> => {
    const db = ensureDbFile();
    return db.revokedTokens.some((rt) => rt.tokenHash === tokenHash);
  },

  // Audit Logs
  recordAuditLog: async (log: Omit<StoredAuditLog, 'id' | 'createdAt'>): Promise<StoredAuditLog> => {
    const db = ensureDbFile();
    const newEntry: StoredAuditLog = {
      ...log,
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    db.auditLogs.unshift(newEntry);
    if (db.auditLogs.length > 500) {
      db.auditLogs = db.auditLogs.slice(0, 500);
    }
    saveDb(db);
    return newEntry;
  },

  getAuditLogs: async (institutionId?: string, limit = 50): Promise<StoredAuditLog[]> => {
    const db = ensureDbFile();
    let logs = db.auditLogs;
    if (institutionId) {
      logs = logs.filter((l) => !l.institutionId || l.institutionId === institutionId);
    }
    return logs.slice(0, limit);
  },

  // Results
  getResults: async (institutionId?: string): Promise<StudentResult[]> => {
    const db = ensureDbFile();
    if (!institutionId) return db.results;
    return db.results.filter((r) => !r.institutionId || r.institutionId === institutionId);
  },

  getPublishedResults: async (institutionId?: string): Promise<StudentResult[]> => {
    const db = ensureDbFile();
    return db.results.filter(
      (r) =>
        (!institutionId || !r.institutionId || r.institutionId === institutionId) &&
        (r.status === 'published' || r.status === 'corrected')
    );
  },

  getResultsByStudentRegNo: async (studentRegNo: string, institutionId?: string): Promise<StudentResult[]> => {
    const db = ensureDbFile();
    const cleanRegNo = studentRegNo.trim().toUpperCase();
    return db.results.filter(
      (r) =>
        r.studentRegNo.trim().toUpperCase() === cleanRegNo &&
        (!institutionId || !r.institutionId || r.institutionId === institutionId) &&
        (r.status === 'published' || r.status === 'corrected')
    );
  },

  getCorrectionHistoryByStudentRegNo: async (studentRegNo: string, institutionId?: string): Promise<CorrectionRequest[]> => {
    const db = ensureDbFile();
    const cleanRegNo = studentRegNo.trim().toUpperCase();
    return db.correctionRequests.filter(
      (cr) =>
        cr.studentRegNo.trim().toUpperCase() === cleanRegNo &&
        (!institutionId || !cr.institutionId || cr.institutionId === institutionId)
    );
  },

  getResultById: async (id: string): Promise<StudentResult | null> => {
    const db = ensureDbFile();
    const result = db.results.find((r) => r.id === id);
    return result || null;
  },

  createResult: async (data: {
    institutionId?: string;
    examinationId?: string;
    studentRegNo: string;
    studentName: string;
    course: string;
    subject: string;
    examName: string;
    marksObtained: number;
    maxMarks?: number;
    publicationDate?: string;
  }): Promise<StudentResult> => {
    const db = ensureDbFile();
    const now = new Date().toISOString();
    const pubDate = data.publicationDate || now;
    const instId = data.institutionId || 'inst_verimark_01';

    const { recordHash } = computeResultRecordHash({
      studentRegNo: data.studentRegNo,
      studentName: data.studentName,
      course: data.course,
      subject: data.subject,
      examName: data.examName,
      marksObtained: data.marksObtained,
      maxMarks: data.maxMarks ?? 100,
      publicationDate: pubDate,
    });

    const newResult: StudentResult = {
      id: `res_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      institutionId: instId,
      examinationId: data.examinationId,
      studentRegNo: data.studentRegNo.trim(),
      studentName: data.studentName.trim(),
      course: data.course.trim(),
      subject: data.subject.trim(),
      examName: data.examName.trim(),
      marksObtained: Number(data.marksObtained),
      maxMarks: Number(data.maxMarks ?? 100),
      publicationDate: new Date(pubDate).toISOString(),
      recordHash,
      status: 'draft',
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    db.results.push(newResult);
    saveDb(db);
    return newResult;
  },

  publishResult: async (id: string): Promise<{ result: StudentResult; checkpoint: LedgerCheckpoint }> => {
    const db = ensureDbFile();
    const result = db.results.find((r) => r.id === id);
    if (!result) {
      throw new Error(`Result ${id} not found`);
    }

    const instId = result.institutionId || 'inst_verimark_01';

    const { recordHash } = computeResultRecordHash({
      studentRegNo: result.studentRegNo,
      studentName: result.studentName,
      course: result.course,
      subject: result.subject,
      examName: result.examName,
      marksObtained: result.marksObtained,
      maxMarks: result.maxMarks,
      publicationDate: result.publicationDate,
    });

    result.recordHash = recordHash;
    result.status = 'published';
    result.updatedAt = new Date().toISOString();
    saveDb(db);

    appendLedgerEvent(
      'RESULT_PUBLISHED',
      result.id,
      result.studentRegNo,
      {
        studentName: result.studentName,
        subject: result.subject,
        marksObtained: result.marksObtained,
        recordHash,
      },
      instId
    );

    const checkpoint = await commitLedgerCheckpoint(instId);
    const updatedDb = ensureDbFile();
    const updatedResult = updatedDb.results.find((r) => r.id === id)!;
    return { result: updatedResult, checkpoint };
  },

  getLedgerEvents: async (institutionId?: string): Promise<LedgerEvent[]> => {
    const db = ensureDbFile();
    if (!institutionId) return db.ledgerEvents;
    return db.ledgerEvents.filter((e) => !e.institutionId || e.institutionId === institutionId);
  },

  getCheckpoints: async (institutionId?: string): Promise<LedgerCheckpoint[]> => {
    const db = ensureDbFile();
    if (!institutionId) return db.checkpoints;
    return db.checkpoints.filter((c) => !c.institutionId || c.institutionId === institutionId);
  },

  getLatestCheckpoint: async (institutionId?: string): Promise<LedgerCheckpoint | null> => {
    const db = ensureDbFile();
    const chks = institutionId
      ? db.checkpoints.filter((c) => !c.institutionId || c.institutionId === institutionId)
      : db.checkpoints;
    if (chks.length === 0) return null;
    return chks[chks.length - 1];
  },

  getResultMerkleProof: async (resultId: string) => {
    const db = ensureDbFile();
    const result = db.results.find((r) => r.id === resultId);
    if (!result || (result.status !== 'published' && result.status !== 'corrected')) {
      return null;
    }

    const instId = result.institutionId || 'inst_verimark_01';

    const publishedResults = db.results
      .filter(
        (r) =>
          (!r.institutionId || r.institutionId === instId) &&
          (r.status === 'published' || r.status === 'corrected')
      )
      .sort((a, b) => `${a.studentRegNo}_${a.subject}`.localeCompare(`${b.studentRegNo}_${b.subject}`));

    const leafIndex = publishedResults.findIndex((r) => r.id === resultId);
    if (leafIndex === -1) return null;

    const leafRecordHashes = publishedResults.map((r) => r.recordHash);
    const tree = new MerkleTree(leafRecordHashes);

    const inclusionProof = tree.getInclusionProof(leafIndex);
    const instCheckpoints = db.checkpoints.filter(
      (c) => !c.institutionId || c.institutionId === instId
    );
    const latestCheckpoint = instCheckpoints.length > 0 ? instCheckpoints[instCheckpoints.length - 1] : null;

    return {
      inclusionProof,
      checkpoint: latestCheckpoint,
    };
  },

  getCorrectionRequests: async (institutionId?: string): Promise<CorrectionRequest[]> => {
    const db = ensureDbFile();
    if (!institutionId) return db.correctionRequests;
    return db.correctionRequests.filter((cr) => !cr.institutionId || cr.institutionId === institutionId);
  },

  getCorrectionRequestById: async (id: string): Promise<CorrectionRequest | null> => {
    const db = ensureDbFile();
    return db.correctionRequests.find((cr) => cr.id === id) || null;
  },

  createCorrectionRequest: async (params: {
    resultId: string;
    proposedMarks: number;
    reason: string;
    requester: AuthUser;
    institutionId?: string;
  }): Promise<CorrectionRequest> => {
    const db = ensureDbFile();
    const result = db.results.find((r) => r.id === params.resultId);
    if (!result) {
      throw new Error(`Target result ${params.resultId} not found`);
    }

    const instId = params.institutionId || result.institutionId || 'inst_verimark_01';

    if (!params.reason || params.reason.trim().length < 5) {
      throw new Error('Mandatory correction reason must be provided (min 5 characters)');
    }

    const proposedMarksNum = Number(params.proposedMarks);
    if (isNaN(proposedMarksNum) || proposedMarksNum < 0 || proposedMarksNum > result.maxMarks) {
      throw new Error(`Proposed marks must be between 0 and ${result.maxMarks}`);
    }

    const { recordHash: proposedHash } = computeResultRecordHash({
      studentRegNo: result.studentRegNo,
      studentName: result.studentName,
      course: result.course,
      subject: result.subject,
      examName: result.examName,
      marksObtained: proposedMarksNum,
      maxMarks: result.maxMarks,
      publicationDate: result.publicationDate,
    });

    const request: CorrectionRequest = {
      id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      institutionId: instId,
      resultId: result.id,
      studentRegNo: result.studentRegNo,
      subject: result.subject,
      originalMarks: result.marksObtained,
      proposedMarks: proposedMarksNum,
      originalHash: result.recordHash,
      proposedHash,
      reason: params.reason.trim(),
      status: 'pending_approvals',
      requesterUserId: params.requester.id,
      requesterName: params.requester.name,
      approvals: [],
      createdAt: new Date().toISOString(),
    };

    db.correctionRequests.push(request);
    saveDb(db);
    return request;
  },

  submitCorrectionApproval: async (params: {
    requestId: string;
    authUser: AuthUser;
    comments?: string;
  }): Promise<{ request: CorrectionRequest; applied: boolean }> => {
    const db = ensureDbFile();
    const request = db.correctionRequests.find((r) => r.id === params.requestId);
    if (!request) {
      throw new Error(`Correction request ${params.requestId} not found`);
    }

    if (request.status === 'approved_applied' || request.status === 'rejected') {
      throw new Error(`Request is already ${request.status}`);
    }

    const user = params.authUser;

    if (user.role !== 'EXAM_CONTROLLER' && user.role !== 'ACADEMIC_DEAN') {
      throw new Error(
        `Role '${user.role}' is not authorized to sign correction approvals. Required: EXAM_CONTROLLER or ACADEMIC_DEAN`
      );
    }
    const approverRole: ApproverRole = user.role;

    if (request.requesterUserId === user.id) {
      throw new Error('Conflict of interest: the user who requested this correction cannot approve it');
    }

    const alreadyApprovedByThisUser = request.approvals.some(
      (a) => a.approverUserId === user.id
    );
    if (alreadyApprovedByThisUser) {
      throw new Error(`User '${user.name}' (${user.id}) has already signed this correction request`);
    }

    const roleAlreadySigned = request.approvals.some(
      (a) => a.approverRole === approverRole
    );
    if (roleAlreadySigned) {
      throw new Error(`An approval signature for role '${approverRole}' already exists on this request`);
    }

    const keys = getServerKeys();
    const approverKeyInfo = approverRole === 'EXAM_CONTROLLER' ? keys.approver1 : keys.approver2;

    const signPayload = `${request.id}:${request.proposedHash}:${approverRole}:${user.id}`;
    const signature = signWithEd25519(signPayload, approverKeyInfo.privateKey);

    const isSigValid = verifyWithEd25519(signPayload, approverKeyInfo.publicKey, signature);
    if (!isSigValid) {
      throw new Error('Cryptographic signature verification failed on backend');
    }

    const approval: CorrectionApproval = {
      id: `appr_${Date.now()}_${approverRole.toLowerCase()}`,
      requestId: request.id,
      approverUserId: user.id,
      approverName: user.name,
      approverRole,
      approverPublicKey: approverKeyInfo.publicKey,
      signature,
      signedPayloadHash: sha256(signPayload),
      comments: params.comments || 'Cryptographically approved under statutory examination regulations',
      approvedAt: new Date().toISOString(),
    };

    request.approvals.push(approval);

    const controllerApproval = request.approvals.find((a) => a.approverRole === 'EXAM_CONTROLLER');
    const deanApproval = request.approvals.find((a) => a.approverRole === 'ACADEMIC_DEAN');

    let applied = false;

    if (
      controllerApproval &&
      deanApproval &&
      controllerApproval.approverUserId !== deanApproval.approverUserId
    ) {
      const result = db.results.find((r) => r.id === request.resultId);
      if (result) {
        result.marksObtained = request.proposedMarks;
        result.recordHash = request.proposedHash;
        result.status = 'corrected';
        result.version += 1;
        result.updatedAt = new Date().toISOString();

        request.status = 'approved_applied';
        request.resolvedAt = new Date().toISOString();

        saveDb(db);

        const instId = request.institutionId || result.institutionId || 'inst_verimark_01';

        appendLedgerEvent(
          'RESULT_CORRECTED',
          result.id,
          result.studentRegNo,
          {
            requestId: request.id,
            originalMarks: request.originalMarks,
            newMarks: request.proposedMarks,
            reason: request.reason,
            approvers: request.approvals.map((a) => ({
              userId: a.approverUserId,
              role: a.approverRole,
              name: a.approverName,
            })),
            recordHash: request.proposedHash,
          },
          instId
        );

        await commitLedgerCheckpoint(instId);
        applied = true;
      }
    } else {
      request.status = 'partially_approved';
      saveDb(db);
    }

    const freshDb = ensureDbFile();
    const freshRequest = freshDb.correctionRequests.find((r) => r.id === params.requestId)!;
    return { request: freshRequest, applied };
  },

  directTamperResult: async (
    resultId: string,
    tamperedField: 'marksObtained' | 'studentName',
    newValue: any
  ): Promise<StudentResult> => {
    const db = ensureDbFile();
    const result = db.results.find((r) => r.id === resultId);
    if (!result) {
      throw new Error(`Result ${resultId} not found`);
    }

    if (tamperedField === 'marksObtained') {
      result.marksObtained = Number(newValue);
    } else if (tamperedField === 'studentName') {
      result.studentName = String(newValue);
    }
    saveDb(db);
    return result;
  },

  directTamperBothMarksAndHashForTest: async (
    resultId: string,
    newMarks: number,
    newHash: string
  ): Promise<void> => {
    const db = ensureDbFile();
    const result = db.results.find((r) => r.id === resultId);
    if (result) {
      result.marksObtained = newMarks;
      result.recordHash = newHash;
      saveDb(db);
    }
  },

  deleteResultDirectlyForTest: async (resultId: string): Promise<void> => {
    const db = ensureDbFile();
    db.results = db.results.filter((r) => r.id !== resultId);
    saveDb(db);
  },

  corruptLedgerEventDirectlyForTest: async (
    eventIndex: number,
    corruptedFields: Partial<LedgerEvent>
  ): Promise<void> => {
    const db = ensureDbFile();
    if (db.ledgerEvents[eventIndex]) {
      Object.assign(db.ledgerEvents[eventIndex], corruptedFields);
      saveDb(db);
    }
  },

  rollbackToLastValidCheckpoint: async (): Promise<{ success: boolean; message: string }> => {
    const trustedCheckpoint = await getLatestIndependentCheckpoint();
    if (!trustedCheckpoint) {
      throw new Error('Rollback failed: No trusted independent checkpoint found in vault');
    }

    const chkCheck = verifyCheckpoint(trustedCheckpoint);
    if (!chkCheck.isValid) {
      throw new Error(`Rollback failed: Trusted checkpoint signature is invalid: ${chkCheck.error}`);
    }

    const db = ensureDbFile();
    const events = db.ledgerEvents;

    let runningPrevHash = '0000000000000000000000000000000000000000000000000000000000000000';
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      if (e.sequenceNumber !== i + 1) {
        throw new Error(`Rollback failed: Non-continuous event sequence at event #${e.sequenceNumber}`);
      }
      if (e.prevEventHash.toLowerCase() !== runningPrevHash.toLowerCase()) {
        throw new Error(`Rollback failed: Broken hash chain at event #${e.sequenceNumber}`);
      }
      const expectedPayloadHash = sha256(canonicalizeJson(e.payload));
      if (e.payloadHash.toLowerCase() !== expectedPayloadHash.toLowerCase()) {
        throw new Error(`Rollback failed: Tampered event payload at event #${e.sequenceNumber}`);
      }
      const expectedEventHash = sha256(
        `${e.sequenceNumber}:${e.eventType}:${e.recordId}:${e.payloadHash}:${e.prevEventHash}`
      );
      if (e.eventHash.toLowerCase() !== expectedEventHash.toLowerCase()) {
        throw new Error(`Rollback failed: Corrupted event hash at event #${e.sequenceNumber}`);
      }
      runningPrevHash = e.eventHash;
    }

    const reconstructedResultsMap = new Map<string, StudentResult>();

    for (const r of db.results) {
      reconstructedResultsMap.set(r.id, { ...r });
    }

    for (const e of events) {
      if (e.eventType === 'RESULT_PUBLISHED') {
        const r = reconstructedResultsMap.get(e.recordId);
        if (r) {
          r.marksObtained = Number(e.payload.marksObtained);
          r.recordHash = e.payload.recordHash;
          r.status = 'published';
        }
      } else if (e.eventType === 'RESULT_CORRECTED') {
        const r = reconstructedResultsMap.get(e.recordId);
        if (r) {
          r.marksObtained = Number(e.payload.newMarks);
          r.recordHash = e.payload.recordHash;
          r.status = 'corrected';
        }
      }
    }

    const reconstructedResults = Array.from(reconstructedResultsMap.values());
    const published = reconstructedResults.filter(
      (r) => r.status === 'published' || r.status === 'corrected'
    );

    published.sort((a, b) =>
      `${a.studentRegNo}_${a.subject}`.localeCompare(`${b.studentRegNo}_${b.subject}`)
    );

    const reconstructedLeaves = published.map((r) => r.recordHash);
    const tree = new MerkleTree(reconstructedLeaves);
    const reconstructedRoot = tree.getRoot();

    if (reconstructedRoot.toLowerCase() !== trustedCheckpoint.merkleRoot.toLowerCase()) {
      throw new Error(
        `Rollback failed: Reconstructed Merkle root (${reconstructedRoot.substring(0, 16)}...) does not match authenticated checkpoint root (${trustedCheckpoint.merkleRoot.substring(0, 16)}...)`
      );
    }

    db.results = reconstructedResults;
    saveDb(db);

    return {
      success: true,
      message: `State cryptographically restored to match signed Checkpoint #${trustedCheckpoint.sequenceNumber} (${trustedCheckpoint.merkleRoot.substring(0, 16)}...)`,
    };
  },

  rollbackDatabaseToVerifiedCheckpoint: async (): Promise<{
    success: boolean;
    message: string;
  }> => {
    const trustedCheckpoint = await getLatestIndependentCheckpoint();
    if (!trustedCheckpoint) {
      throw new Error('No trusted independent checkpoint found in external store to verify rollback');
    }

    const verification = verifyCheckpoint(trustedCheckpoint);
    if (!verification.isValid) {
      throw new Error(`Independent checkpoint signature verification failed: ${verification.error}`);
    }

    const db = ensureDbFile();
    const publishedEvents = db.ledgerEvents.filter(
      (e) => e.eventType === 'RESULT_PUBLISHED' || e.eventType === 'RESULT_CORRECTED'
    );

    const latestStateByRecordId = new Map<string, {
      studentRegNo: string;
      studentName: string;
      course: string;
      subject: string;
      examName: string;
      marksObtained: number;
      maxMarks: number;
      publicationDate: string;
      recordHash: string;
      status: 'published' | 'corrected';
      version: number;
    }>();

    for (const event of publishedEvents) {
      if (event.eventType === 'RESULT_PUBLISHED') {
        const p = event.payload;
        const currentResult = db.results.find((r) => r.id === event.recordId);
        latestStateByRecordId.set(event.recordId, {
          studentRegNo: event.studentRegNo,
          studentName: p.studentName || currentResult?.studentName || 'Student',
          course: currentResult?.course || 'B.Tech Computer Science',
          subject: p.subject || currentResult?.subject || 'Subject',
          examName: currentResult?.examName || 'End Semester Examination 2026',
          marksObtained: p.marksObtained,
          maxMarks: currentResult?.maxMarks || 100,
          publicationDate: currentResult?.publicationDate || event.createdAt,
          recordHash: p.recordHash,
          status: 'published',
          version: 1,
        });
      } else if (event.eventType === 'RESULT_CORRECTED') {
        const p = event.payload;
        const existing = latestStateByRecordId.get(event.recordId);
        if (existing) {
          existing.marksObtained = p.proposedMarks;
          existing.recordHash = p.newHash;
          existing.status = 'corrected';
          existing.version += 1;
        }
      }
    }

    const reconstructedResults: StudentResult[] = [];
    for (const [id, state] of latestStateByRecordId.entries()) {
      const existing = db.results.find((r) => r.id === id);
      reconstructedResults.push({
        id,
        institutionId: existing?.institutionId || 'inst_verimark_01',
        studentRegNo: state.studentRegNo,
        studentName: state.studentName,
        course: state.course,
        subject: state.subject,
        examName: state.examName,
        marksObtained: state.marksObtained,
        maxMarks: state.maxMarks,
        publicationDate: state.publicationDate,
        recordHash: state.recordHash,
        status: state.status,
        version: state.version,
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        checkpointId: trustedCheckpoint.id,
      });
    }

    const published = reconstructedResults.filter(
      (r) => r.status === 'published' || r.status === 'corrected'
    );

    published.sort((a, b) =>
      `${a.studentRegNo}_${a.subject}`.localeCompare(`${b.studentRegNo}_${b.subject}`)
    );

    const reconstructedLeaves = published.map((r) => r.recordHash);
    const tree = new MerkleTree(reconstructedLeaves);
    const reconstructedRoot = tree.getRoot();

    if (reconstructedRoot.toLowerCase() !== trustedCheckpoint.merkleRoot.toLowerCase()) {
      throw new Error(
        `Rollback failed: Reconstructed Merkle root (${reconstructedRoot.substring(0, 16)}...) does not match authenticated checkpoint root (${trustedCheckpoint.merkleRoot.substring(0, 16)}...)`
      );
    }

    db.results = reconstructedResults;
    saveDb(db);

    return {
      success: true,
      message: `State cryptographically restored to match signed Checkpoint #${trustedCheckpoint.sequenceNumber} (${trustedCheckpoint.merkleRoot.substring(0, 16)}...)`,
    };
  },

  seedInitialData: async (): Promise<void> => {
    const db = ensureDbFile();
    if (db.results.length > 0) return;

    const sampleStudents = [
      {
        studentRegNo: 'CF2026-CSE-101',
        studentName: 'Aarav Sharma',
        course: 'B.Tech Computer Science & Engineering',
        subject: 'Cryptography & Network Security',
        examName: 'End Semester Examination 2026',
        marksObtained: 88,
        maxMarks: 100,
        publicationDate: '2026-11-20T09:00:00.000Z',
      },
      {
        studentRegNo: 'CF2026-CSE-102',
        studentName: 'Bhavna Reddy',
        course: 'B.Tech Computer Science & Engineering',
        subject: 'Distributed Ledger Technologies',
        examName: 'End Semester Examination 2026',
        marksObtained: 94,
        maxMarks: 100,
        publicationDate: '2026-11-20T09:00:00.000Z',
      },
      {
        studentRegNo: 'CF2026-CSE-103',
        studentName: 'Chetan Verma',
        course: 'B.Tech Computer Science & Engineering',
        subject: 'Database Systems Architecture',
        examName: 'End Semester Examination 2026',
        marksObtained: 76,
        maxMarks: 100,
        publicationDate: '2026-11-20T09:00:00.000Z',
      },
      {
        studentRegNo: 'CF2026-CSE-104',
        studentName: 'Divya Nair',
        course: 'B.Tech Computer Science & Engineering',
        subject: 'Operating Systems & Security',
        examName: 'End Semester Examination 2026',
        marksObtained: 91,
        maxMarks: 100,
        publicationDate: '2026-11-20T09:00:00.000Z',
      },
      {
        studentRegNo: 'CF2026-CSE-105',
        studentName: 'Eshan Roy',
        course: 'B.Tech Computer Science & Engineering',
        subject: 'Algorithm Design & Analysis',
        examName: 'End Semester Examination 2026',
        marksObtained: 83,
        maxMarks: 100,
        publicationDate: '2026-11-20T09:00:00.000Z',
      },
    ];

    for (const item of sampleStudents) {
      const res = await dbService.createResult(item);
      await dbService.publishResult(res.id);
    }
  },
};
