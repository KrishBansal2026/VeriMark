// ==============================================================================
// VERIMARK – Local Vault Storage Adapter (Development / Offline / Evaluation)
// ==============================================================================

import * as fs from 'fs';
import * as path from 'path';
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
import { StorageAdapter, StorageHealthReport } from './adapter';
import {
  StoredUserRecord,
  StoredAuditLog,
  ensureDbFile,
  dbService,
} from './db';
import { getVaultDir } from './vaultConfig';

export class LocalVaultStorageAdapter implements StorageAdapter {
  readonly name = 'Local Cryptographic Vault Storage Adapter';
  readonly engine = 'local_vault' as const;
  readonly isPersistent = true;

  async getInstitutions(): Promise<Institution[]> {
    return dbService.getInstitutions();
  }

  async getInstitutionById(id: string): Promise<Institution | null> {
    return dbService.getInstitutionById(id);
  }

  async createInstitution(data: Partial<Institution>): Promise<Institution> {
    return dbService.createInstitution(data);
  }

  async updateInstitution(id: string, data: Partial<Institution>): Promise<Institution | null> {
    return dbService.updateInstitution(id, data);
  }

  async getStudents(institutionId?: string): Promise<StudentProfile[]> {
    return dbService.getStudents(institutionId);
  }

  async getStudentById(id: string): Promise<StudentProfile | null> {
    return dbService.getStudentById(id);
  }

  async getStudentByRegNo(regNo: string): Promise<StudentProfile | null> {
    return dbService.getStudentByRegNo(regNo);
  }

  async createStudent(data: Partial<StudentProfile>): Promise<StudentProfile> {
    return dbService.createStudent(data);
  }

  async updateStudent(id: string, data: Partial<StudentProfile>): Promise<StudentProfile | null> {
    return dbService.updateStudent(id, data);
  }

  async getExaminations(institutionId?: string): Promise<Examination[]> {
    return dbService.getExaminations(institutionId);
  }

  async getExaminationById(id: string): Promise<Examination | null> {
    return dbService.getExaminationById(id);
  }

  async createExamination(data: Partial<Examination>): Promise<Examination> {
    return dbService.createExamination(data);
  }

  async getSubjects(institutionId?: string): Promise<SubjectItem[]> {
    return dbService.getSubjects(institutionId);
  }

  async createSubject(data: Partial<SubjectItem>): Promise<SubjectItem> {
    return dbService.createSubject(data);
  }

  async getUsers(institutionId?: string): Promise<StoredUserRecord[]> {
    return dbService.getUsers(institutionId);
  }

  async getUserById(id: string): Promise<StoredUserRecord | null> {
    return dbService.getUserById(id);
  }

  async getUserByEmail(email: string): Promise<StoredUserRecord | null> {
    return dbService.getUserByEmail(email);
  }

  async createUser(user: StoredUserRecord): Promise<StoredUserRecord> {
    return dbService.createUser(user);
  }

  async updateUserPassword(id: string, passwordHash: string, salt: string): Promise<boolean> {
    return dbService.updateUserPassword(id, passwordHash, salt);
  }

  async setUserActiveStatus(id: string, isActive: boolean): Promise<boolean> {
    return dbService.setUserActiveStatus(id, isActive);
  }

  async getResults(institutionId?: string): Promise<StudentResult[]> {
    return dbService.getResults(institutionId);
  }

  async getResultById(id: string): Promise<StudentResult | null> {
    return dbService.getResultById(id);
  }

  async createResult(data: {
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
  }): Promise<StudentResult> {
    return dbService.createResult(data);
  }

  async updateResultStatus(id: string, status: ResultStatus, version?: number): Promise<StudentResult | null> {
    return dbService.updateResultStatus(id, status, version);
  }

  async getLedgerEvents(institutionId?: string): Promise<LedgerEvent[]> {
    return dbService.getLedgerEvents(institutionId);
  }

  async appendLedgerEvent(event: LedgerEvent): Promise<LedgerEvent> {
    return dbService.appendLedgerEvent(event);
  }

  async getCheckpoints(institutionId?: string): Promise<LedgerCheckpoint[]> {
    return dbService.getCheckpoints(institutionId);
  }

  async saveCheckpoint(checkpoint: LedgerCheckpoint): Promise<void> {
    return dbService.saveCheckpoint(checkpoint);
  }

  async getCorrectionRequests(institutionId?: string): Promise<CorrectionRequest[]> {
    return dbService.getCorrectionRequests(institutionId);
  }

  async createCorrectionRequest(req: CorrectionRequest): Promise<CorrectionRequest> {
    return dbService.createCorrectionRequest(req);
  }

  async updateCorrectionRequest(req: CorrectionRequest): Promise<void> {
    return dbService.updateCorrectionRequest(req);
  }

  async getAuditLogs(institutionId?: string): Promise<StoredAuditLog[]> {
    return dbService.getAuditLogs(institutionId);
  }

  async recordAuditLog(log: StoredAuditLog): Promise<StoredAuditLog> {
    return dbService.recordAuditLog(log);
  }

  async checkHealth(): Promise<StorageHealthReport> {
    const start = Date.now();
    const db = ensureDbFile();
    const isServerless =
      Boolean(process.env.VERCEL) ||
      Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME) ||
      process.cwd().startsWith('/var/task');

    const warnings: string[] = [];
    let status: 'HEALTHY' | 'DEGRADED' | 'CONFIG_ERROR' = 'HEALTHY';

    if (process.env.NODE_ENV === 'production' && isServerless) {
      status = 'CONFIG_ERROR';
      warnings.push(
        'CRITICAL CONFIGURATION NOTICE: Application is operating on serverless runtime with local temporary storage. External persistent database (Supabase/PostgreSQL) must be configured via NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to prevent cold-start loss.'
      );
    } else if (process.env.NODE_ENV === 'production') {
      warnings.push(
        'Production Advisory: Local vault storage adapter is active. For distributed multi-instance deployment, connect Supabase PostgreSQL backend.'
      );
    }

    return {
      status,
      engine: 'local_vault',
      isPersistent: !isServerless,
      tableCounts: {
        results: db.results.length,
        checkpoints: db.checkpoints.length,
        events: db.ledgerEvents.length,
        students: db.students.length,
      },
      warnings,
      latencyMs: Date.now() - start,
    };
  }
}
