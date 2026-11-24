// ==============================================================================
// VERIMARK – Pluggable Database Storage Adapter Architecture (Phase 2)
// ==============================================================================

import {
  Institution,
  StudentProfile,
  Examination,
  SubjectItem,
  StudentResult,
  LedgerEvent,
  LedgerCheckpoint,
  CorrectionRequest,
  ResultStatus,
} from '../types';
import { StoredUserRecord, StoredAuditLog } from './db';

export interface StorageHealthReport {
  status: 'HEALTHY' | 'DEGRADED' | 'CONFIG_ERROR';
  engine: 'supabase_postgres' | 'local_vault';
  isPersistent: boolean;
  tableCounts: {
    results: number;
    checkpoints: number;
    events: number;
    students: number;
  };
  warnings: string[];
  latencyMs?: number;
}

/**
 * Universal Storage Adapter Contract for VeriMark.
 * Both the Local Development Adapter and Production Supabase/PostgreSQL Adapter
 * implement this contract strictly.
 */
export interface StorageAdapter {
  readonly name: string;
  readonly engine: 'supabase_postgres' | 'local_vault';
  readonly isPersistent: boolean;

  // Institutions
  getInstitutions(): Promise<Institution[]>;
  getInstitutionById(id: string): Promise<Institution | null>;
  createInstitution(data: Partial<Institution>): Promise<Institution>;
  updateInstitution(id: string, data: Partial<Institution>): Promise<Institution | null>;

  // Students
  getStudents(institutionId?: string): Promise<StudentProfile[]>;
  getStudentById(id: string): Promise<StudentProfile | null>;
  getStudentByRegNo(regNo: string): Promise<StudentProfile | null>;
  createStudent(data: Partial<StudentProfile>): Promise<StudentProfile>;
  updateStudent(id: string, data: Partial<StudentProfile>): Promise<StudentProfile | null>;

  // Examinations & Subjects
  getExaminations(institutionId?: string): Promise<Examination[]>;
  getExaminationById(id: string): Promise<Examination | null>;
  createExamination(data: Partial<Examination>): Promise<Examination>;
  getSubjects(institutionId?: string): Promise<SubjectItem[]>;
  createSubject(data: Partial<SubjectItem>): Promise<SubjectItem>;

  // Users & Staff
  getUsers(institutionId?: string): Promise<StoredUserRecord[]>;
  getUserById(id: string): Promise<StoredUserRecord | null>;
  getUserByEmail(email: string): Promise<StoredUserRecord | null>;
  createUser(user: StoredUserRecord): Promise<StoredUserRecord>;
  updateUserPassword(id: string, passwordHash: string, salt: string): Promise<boolean>;
  setUserActiveStatus(id: string, isActive: boolean): Promise<boolean>;

  // Results & Marksheets
  getResults(institutionId?: string): Promise<StudentResult[]>;
  getResultById(id: string): Promise<StudentResult | null>;
  createResult(data: {
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
  }): Promise<StudentResult>;
  updateResultStatus(id: string, status: ResultStatus, version?: number): Promise<StudentResult | null>;

  // Ledger & Checkpoints
  getLedgerEvents(institutionId?: string): Promise<LedgerEvent[]>;
  appendLedgerEvent(event: LedgerEvent): Promise<LedgerEvent>;
  getCheckpoints(institutionId?: string): Promise<LedgerCheckpoint[]>;
  saveCheckpoint(checkpoint: LedgerCheckpoint): Promise<void>;

  // Two-Person Dual Approvals
  getCorrectionRequests(institutionId?: string): Promise<CorrectionRequest[]>;
  createCorrectionRequest(req: CorrectionRequest): Promise<CorrectionRequest>;
  updateCorrectionRequest(req: CorrectionRequest): Promise<void>;

  // Audit Logs & Health
  getAuditLogs(institutionId?: string): Promise<StoredAuditLog[]>;
  recordAuditLog(log: StoredAuditLog): Promise<StoredAuditLog>;
  checkHealth(): Promise<StorageHealthReport>;
}
