// ==============================================================================
// VERIMARK – Supabase / PostgreSQL Storage Adapter (Production Database Engine)
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
import { StorageAdapter, StorageHealthReport } from './adapter';
import { StoredUserRecord, StoredAuditLog } from './db';
import { getSupabaseAdmin, isSupabaseConfigured } from './supabaseClient';
import { computeResultRecordHash } from '../crypto/sha256';

export class SupabaseStorageAdapter implements StorageAdapter {
  readonly name = 'Supabase PostgreSQL Managed Storage Adapter';
  readonly engine = 'supabase_postgres' as const;
  readonly isPersistent = true;

  private getClient() {
    const client = getSupabaseAdmin();
    if (!client) {
      throw new Error(
        'Supabase Storage Adapter is not configured. Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.'
      );
    }
    return client;
  }

  async getInstitutions(): Promise<Institution[]> {
    const client = this.getClient();
    const { data, error } = await client.from('institutions').select('*');
    if (error) throw new Error(`Supabase getInstitutions error: ${error.message}`);
    return data || [];
  }

  async getInstitutionById(id: string): Promise<Institution | null> {
    const client = this.getClient();
    const { data, error } = await client.from('institutions').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(`Supabase getInstitutionById error: ${error.message}`);
    return data;
  }

  async createInstitution(data: Partial<Institution>): Promise<Institution> {
    const client = this.getClient();
    const id = data.id || `inst_${Date.now()}`;
    const newRecord = { ...data, id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    const { data: inserted, error } = await client.from('institutions').insert(newRecord).select().single();
    if (error) throw new Error(`Supabase createInstitution error: ${error.message}`);
    return inserted;
  }

  async getStudents(institutionId?: string): Promise<StudentProfile[]> {
    const client = this.getClient();
    let q = client.from('students').select('*');
    if (institutionId) q = q.eq('institution_id', institutionId);
    const { data, error } = await q;
    if (error) throw new Error(`Supabase getStudents error: ${error.message}`);
    return (data || []).map((row) => ({
      id: row.id,
      institutionId: row.institution_id,
      regNo: row.reg_no,
      fullName: row.full_name,
      email: row.email,
      course: row.course,
      department: row.department,
      batchYear: row.batch_year,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async getStudentById(id: string): Promise<StudentProfile | null> {
    const client = this.getClient();
    const { data, error } = await client.from('students').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(`Supabase getStudentById error: ${error.message}`);
    if (!data) return null;
    return {
      id: data.id,
      institutionId: data.institution_id,
      regNo: data.reg_no,
      fullName: data.full_name,
      email: data.email,
      course: data.course,
      department: data.department,
      batchYear: data.batch_year,
      status: data.status,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async getStudentByRegNo(regNo: string): Promise<StudentProfile | null> {
    const client = this.getClient();
    const { data, error } = await client.from('students').select('*').eq('reg_no', regNo.trim()).maybeSingle();
    if (error) throw new Error(`Supabase getStudentByRegNo error: ${error.message}`);
    if (!data) return null;
    return {
      id: data.id,
      institutionId: data.institution_id,
      regNo: data.reg_no,
      fullName: data.full_name,
      email: data.email,
      course: data.course,
      department: data.department,
      batchYear: data.batch_year,
      status: data.status,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async createStudent(data: Partial<StudentProfile>): Promise<StudentProfile> {
    const client = this.getClient();
    const id = data.id || `stud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const row = {
      id,
      institution_id: data.institutionId || 'inst_verimark_01',
      reg_no: data.regNo,
      full_name: data.fullName,
      email: data.email,
      course: data.course,
      department: data.department,
      batch_year: data.batchYear,
      status: data.status || 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { data: inserted, error } = await client.from('students').insert(row).select().single();
    if (error) throw new Error(`Supabase createStudent error: ${error.message}`);
    return {
      id: inserted.id,
      institutionId: inserted.institution_id,
      regNo: inserted.reg_no,
      fullName: inserted.full_name,
      email: inserted.email,
      course: inserted.course,
      department: inserted.department,
      batchYear: inserted.batch_year,
      status: inserted.status,
      createdAt: inserted.created_at,
      updatedAt: inserted.updated_at,
    };
  }

  async updateStudent(id: string, data: Partial<StudentProfile>): Promise<StudentProfile | null> {
    const client = this.getClient();
    const updates: any = { updated_at: new Date().toISOString() };
    if (data.fullName) updates.full_name = data.fullName;
    if (data.email) updates.email = data.email;
    if (data.course) updates.course = data.course;
    if (data.department) updates.department = data.department;
    if (data.status) updates.status = data.status;

    const { data: updated, error } = await client.from('students').update(updates).eq('id', id).select().maybeSingle();
    if (error) throw new Error(`Supabase updateStudent error: ${error.message}`);
    if (!updated) return null;
    return {
      id: updated.id,
      institutionId: updated.institution_id,
      regNo: updated.reg_no,
      fullName: updated.full_name,
      email: updated.email,
      course: updated.course,
      department: updated.department,
      batchYear: updated.batch_year,
      status: updated.status,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    };
  }

  async getExaminations(institutionId?: string): Promise<Examination[]> {
    const client = this.getClient();
    let q = client.from('examinations').select('*');
    if (institutionId) q = q.eq('institution_id', institutionId);
    const { data, error } = await q;
    if (error) throw new Error(`Supabase getExaminations error: ${error.message}`);
    return (data || []).map((row) => ({
      id: row.id,
      institutionId: row.institution_id,
      examCode: row.exam_code,
      examName: row.exam_name,
      semester: row.semester,
      academicYear: row.academic_year,
      department: row.department,
      status: row.status,
      conductedDate: row.conducted_date,
      createdAt: row.created_at,
    }));
  }

  async getExaminationById(id: string): Promise<Examination | null> {
    const client = this.getClient();
    const { data, error } = await client.from('examinations').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(`Supabase getExaminationById error: ${error.message}`);
    if (!data) return null;
    return {
      id: data.id,
      institutionId: data.institution_id,
      examCode: data.exam_code,
      examName: data.exam_name,
      semester: data.semester,
      academicYear: data.academic_year,
      department: data.department,
      status: data.status,
      conductedDate: data.conducted_date,
      createdAt: data.created_at,
    };
  }

  async createExamination(data: Partial<Examination>): Promise<Examination> {
    const client = this.getClient();
    const id = data.id || `exam_${Date.now()}`;
    const row = {
      id,
      institution_id: data.institutionId || 'inst_verimark_01',
      exam_code: data.examCode,
      exam_name: data.examName,
      semester: data.semester,
      academic_year: data.academicYear,
      department: data.department || 'Computer Science & Engineering',
      status: data.status || 'published',
      conducted_date: data.conductedDate || new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString(),
    };
    const { data: inserted, error } = await client.from('examinations').insert(row).select().single();
    if (error) throw new Error(`Supabase createExamination error: ${error.message}`);
    return {
      id: inserted.id,
      institutionId: inserted.institution_id,
      examCode: inserted.exam_code,
      examName: inserted.exam_name,
      semester: inserted.semester,
      academicYear: inserted.academic_year,
      department: inserted.department,
      status: inserted.status,
      conductedDate: inserted.conducted_date,
      createdAt: inserted.created_at,
    };
  }

  async getSubjects(institutionId?: string): Promise<SubjectItem[]> {
    const client = this.getClient();
    let q = client.from('subjects').select('*');
    if (institutionId) q = q.eq('institution_id', institutionId);
    const { data, error } = await q;
    if (error) throw new Error(`Supabase getSubjects error: ${error.message}`);
    return (data || []).map((row) => ({
      id: row.id,
      institutionId: row.institution_id,
      subjectCode: row.subject_code,
      subjectName: row.subject_name,
      department: row.department,
      credits: row.credits,
      maxMarks: row.max_marks,
      passingMarks: row.passing_marks,
      createdAt: row.created_at,
    }));
  }

  async createSubject(data: Partial<SubjectItem>): Promise<SubjectItem> {
    const client = this.getClient();
    const id = data.id || `subj_${Date.now()}`;
    const row = {
      id,
      institution_id: data.institutionId || 'inst_verimark_01',
      subject_code: data.subjectCode,
      subject_name: data.subjectName,
      department: data.department,
      credits: data.credits || 4,
      max_marks: data.maxMarks || 100,
      passing_marks: data.passingMarks || 40,
      created_at: new Date().toISOString(),
    };
    const { data: inserted, error } = await client.from('subjects').insert(row).select().single();
    if (error) throw new Error(`Supabase createSubject error: ${error.message}`);
    return {
      id: inserted.id,
      institutionId: inserted.institution_id,
      subjectCode: inserted.subject_code,
      subjectName: inserted.subject_name,
      department: inserted.department,
      credits: inserted.credits,
      maxMarks: inserted.max_marks,
      passingMarks: inserted.passing_marks,
      createdAt: inserted.created_at,
    };
  }

  async getUsers(institutionId?: string): Promise<StoredUserRecord[]> {
    const client = this.getClient();
    let q = client.from('users').select('*');
    if (institutionId) q = q.eq('institution_id', institutionId);
    const { data, error } = await q;
    if (error) throw new Error(`Supabase getUsers error: ${error.message}`);
    return (data || []).map((row) => ({
      id: row.id,
      institutionId: row.institution_id,
      email: row.email,
      name: row.name,
      role: row.role,
      studentRegNo: row.student_reg_no,
      passwordHash: row.password_hash,
      salt: row.password_salt,
      passwordSalt: row.password_salt,
      mustChangePassword: row.must_change_password,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async getUserById(id: string): Promise<StoredUserRecord | null> {
    const client = this.getClient();
    const { data, error } = await client.from('users').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(`Supabase getUserById error: ${error.message}`);
    if (!data) return null;
    return {
      id: data.id,
      institutionId: data.institution_id,
      email: data.email,
      name: data.name,
      role: data.role,
      studentRegNo: data.student_reg_no,
      passwordHash: data.password_hash,
      salt: data.password_salt,
      passwordSalt: data.password_salt,
      mustChangePassword: data.must_change_password,
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async getUserByEmail(email: string): Promise<StoredUserRecord | null> {
    const client = this.getClient();
    const { data, error } = await client
      .from('users')
      .select('*')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();
    if (error) throw new Error(`Supabase getUserByEmail error: ${error.message}`);
    if (!data) return null;
    return {
      id: data.id,
      institutionId: data.institution_id,
      email: data.email,
      name: data.name,
      role: data.role,
      studentRegNo: data.student_reg_no,
      passwordHash: data.password_hash,
      salt: data.password_salt,
      passwordSalt: data.password_salt,
      mustChangePassword: data.must_change_password,
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async createUser(user: StoredUserRecord): Promise<StoredUserRecord> {
    const client = this.getClient();
    const row = {
      id: user.id,
      institution_id: user.institutionId || 'inst_verimark_01',
      email: user.email.toLowerCase(),
      name: user.name,
      role: user.role,
      student_reg_no: user.studentRegNo,
      password_hash: user.passwordHash,
      password_salt: user.salt || user.passwordSalt,
      must_change_password: user.mustChangePassword ?? false,
      is_active: user.isActive ?? true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { data: inserted, error } = await client.from('users').insert(row).select().single();
    if (error) throw new Error(`Supabase createUser error: ${error.message}`);
    return {
      ...user,
      id: inserted.id,
    };
  }

  async updateUserPassword(id: string, passwordHash: string, salt: string): Promise<boolean> {
    const client = this.getClient();
    const { error } = await client
      .from('users')
      .update({
        password_hash: passwordHash,
        password_salt: salt,
        must_change_password: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) throw new Error(`Supabase updateUserPassword error: ${error.message}`);
    return true;
  }

  async setUserActiveStatus(id: string, isActive: boolean): Promise<boolean> {
    const client = this.getClient();
    const { error } = await client.from('users').update({ is_active: isActive }).eq('id', id);
    if (error) throw new Error(`Supabase setUserActiveStatus error: ${error.message}`);
    return true;
  }

  async getResults(institutionId?: string): Promise<StudentResult[]> {
    const client = this.getClient();
    let q = client.from('results').select('*');
    if (institutionId) q = q.eq('institution_id', institutionId);
    const { data, error } = await q;
    if (error) throw new Error(`Supabase getResults error: ${error.message}`);
    return (data || []).map((row) => ({
      id: row.id,
      institutionId: row.institution_id,
      examinationId: row.examination_id,
      studentRegNo: row.student_reg_no,
      studentName: row.student_name,
      course: row.course,
      subject: row.subject,
      examName: row.exam_name,
      marksObtained: Number(row.marks_obtained),
      maxMarks: Number(row.max_marks),
      publicationDate: row.publication_date,
      recordHash: row.record_hash,
      merkleLeafHash: row.merkle_leaf_hash,
      merkleIndex: row.merkle_index,
      checkpointId: row.checkpoint_id,
      status: row.status,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async getResultById(id: string): Promise<StudentResult | null> {
    const client = this.getClient();
    const { data, error } = await client.from('results').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(`Supabase getResultById error: ${error.message}`);
    if (!data) return null;
    return {
      id: data.id,
      institutionId: data.institution_id,
      examinationId: data.examination_id,
      studentRegNo: data.student_reg_no,
      studentName: data.student_name,
      course: data.course,
      subject: data.subject,
      examName: data.exam_name,
      marksObtained: Number(data.marks_obtained),
      maxMarks: Number(data.max_marks),
      publicationDate: data.publication_date,
      recordHash: data.record_hash,
      merkleLeafHash: data.merkle_leaf_hash,
      merkleIndex: data.merkle_index,
      checkpointId: data.checkpoint_id,
      status: data.status,
      version: data.version,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
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
    const client = this.getClient();
    const id = `res_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const publicationDate = data.publicationDate || new Date().toISOString();
    const maxMarks = data.maxMarks ?? 100;

    const { recordHash } = computeResultRecordHash({
      studentRegNo: data.studentRegNo,
      studentName: data.studentName,
      course: data.course,
      subject: data.subject,
      examName: data.examName,
      marksObtained: data.marksObtained,
      maxMarks,
      publicationDate,
    });

    const row = {
      id,
      institution_id: data.institutionId || 'inst_verimark_01',
      examination_id: data.examinationId,
      student_reg_no: data.studentRegNo.trim(),
      student_name: data.studentName.trim(),
      course: data.course.trim(),
      subject: data.subject.trim(),
      exam_name: data.examName.trim(),
      marks_obtained: data.marksObtained,
      max_marks: maxMarks,
      publication_date: publicationDate,
      record_hash: recordHash,
      status: 'draft',
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: inserted, error } = await client.from('results').insert(row).select().single();
    if (error) throw new Error(`Supabase createResult error: ${error.message}`);
    return {
      id: inserted.id,
      institutionId: inserted.institution_id,
      examinationId: inserted.examination_id,
      studentRegNo: inserted.student_reg_no,
      studentName: inserted.student_name,
      course: inserted.course,
      subject: inserted.subject,
      examName: inserted.exam_name,
      marksObtained: Number(inserted.marks_obtained),
      maxMarks: Number(inserted.max_marks),
      publicationDate: inserted.publication_date,
      recordHash: inserted.record_hash,
      status: inserted.status,
      version: inserted.version,
      createdAt: inserted.created_at,
      updatedAt: inserted.updated_at,
    };
  }

  async updateResultStatus(id: string, status: ResultStatus, version?: number): Promise<StudentResult | null> {
    const client = this.getClient();
    const updates: any = { status, updated_at: new Date().toISOString() };
    if (version !== undefined) updates.version = version;

    const { data: updated, error } = await client.from('results').update(updates).eq('id', id).select().maybeSingle();
    if (error) throw new Error(`Supabase updateResultStatus error: ${error.message}`);
    if (!updated) return null;
    return {
      id: updated.id,
      institutionId: updated.institution_id,
      examinationId: updated.examination_id,
      studentRegNo: updated.student_reg_no,
      studentName: updated.student_name,
      course: updated.course,
      subject: updated.subject,
      examName: updated.exam_name,
      marksObtained: Number(updated.marks_obtained),
      maxMarks: Number(updated.max_marks),
      publicationDate: updated.publication_date,
      recordHash: updated.record_hash,
      status: updated.status,
      version: updated.version,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    };
  }

  async getLedgerEvents(institutionId?: string): Promise<LedgerEvent[]> {
    const client = this.getClient();
    let q = client.from('ledger_events').select('*').order('sequence_number', { ascending: true });
    if (institutionId) q = q.eq('institution_id', institutionId);
    const { data, error } = await q;
    if (error) throw new Error(`Supabase getLedgerEvents error: ${error.message}`);
    return (data || []).map((row) => ({
      id: row.id,
      institutionId: row.institution_id,
      sequenceNumber: row.sequence_number,
      eventType: row.event_type,
      recordId: row.record_id || row.entity_id || '',
      studentRegNo: row.student_reg_no || '',
      payload: row.payload || {},
      payloadHash: row.payload_hash || '',
      prevEventHash: row.prev_event_hash,
      eventHash: row.event_hash,
      createdAt: row.created_at || row.timestamp || new Date().toISOString(),
    }));
  }

  async appendLedgerEvent(event: LedgerEvent): Promise<LedgerEvent> {
    const client = this.getClient();
    const row = {
      id: event.id,
      institution_id: event.institutionId || 'inst_verimark_01',
      sequence_number: event.sequenceNumber,
      event_type: event.eventType,
      record_id: event.recordId,
      student_reg_no: event.studentRegNo,
      payload: event.payload,
      payload_hash: event.payloadHash,
      prev_event_hash: event.prevEventHash,
      event_hash: event.eventHash,
      created_at: event.createdAt,
    };
    const { data: inserted, error } = await client.from('ledger_events').insert(row).select().single();
    if (error) throw new Error(`Supabase appendLedgerEvent error: ${error.message}`);
    return event;
  }

  async getCheckpoints(institutionId?: string): Promise<LedgerCheckpoint[]> {
    const client = this.getClient();
    let q = client.from('ledger_checkpoints').select('*').order('sequence_number', { ascending: true });
    if (institutionId) q = q.eq('institution_id', institutionId);
    const { data, error } = await q;
    if (error) throw new Error(`Supabase getCheckpoints error: ${error.message}`);
    return (data || []).map((row) => ({
      id: row.id,
      institutionId: row.institution_id,
      sequenceNumber: row.sequence_number,
      merkleRoot: row.merkle_root,
      eventCount: row.event_count,
      leafCount: row.leaf_count,
      prevCheckpointHash: row.prev_checkpoint_hash,
      checkpointHash: row.checkpoint_hash,
      signature: row.signature,
      signerPublicKey: row.signer_public_key,
      committedAt: row.committed_at,
    }));
  }

  async saveCheckpoint(checkpoint: LedgerCheckpoint): Promise<void> {
    const client = this.getClient();
    const row = {
      id: checkpoint.id,
      institution_id: checkpoint.institutionId || 'inst_verimark_01',
      sequence_number: checkpoint.sequenceNumber,
      merkle_root: checkpoint.merkleRoot,
      event_count: checkpoint.eventCount,
      leaf_count: checkpoint.leafCount,
      prev_checkpoint_hash: checkpoint.prevCheckpointHash,
      checkpoint_hash: checkpoint.checkpointHash,
      signature: checkpoint.signature,
      signer_public_key: checkpoint.signerPublicKey,
      committed_at: checkpoint.committedAt,
    };
    const { error } = await client.from('ledger_checkpoints').insert(row);
    if (error) throw new Error(`Supabase saveCheckpoint error: ${error.message}`);
  }

  async getCorrectionRequests(institutionId?: string): Promise<CorrectionRequest[]> {
    const client = this.getClient();
    let q = client.from('correction_requests').select('*');
    if (institutionId) q = q.eq('institution_id', institutionId);
    const { data, error } = await q;
    if (error) throw new Error(`Supabase getCorrectionRequests error: ${error.message}`);
    return (data || []).map((row) => ({
      id: row.id,
      institutionId: row.institution_id,
      resultId: row.result_id,
      studentRegNo: row.student_reg_no,
      subject: row.subject,
      originalMarks: Number(row.original_marks),
      originalHash: row.original_hash,
      proposedMarks: Number(row.proposed_marks),
      proposedHash: row.proposed_hash,
      reason: row.reason,
      status: row.status,
      requesterUserId: row.requester_user_id || row.requester_id || '',
      requesterName: row.requester_name || '',
      approvals: row.approvals || row.approvers || [],
      createdAt: row.created_at,
      resolvedAt: row.resolved_at || row.applied_at,
    }));
  }

  async createCorrectionRequest(req: CorrectionRequest): Promise<CorrectionRequest> {
    const client = this.getClient();
    const row = {
      id: req.id,
      institution_id: req.institutionId || 'inst_verimark_01',
      result_id: req.resultId,
      student_reg_no: req.studentRegNo,
      subject: req.subject,
      original_marks: req.originalMarks,
      original_hash: req.originalHash,
      proposed_marks: req.proposedMarks,
      proposed_hash: req.proposedHash,
      reason: req.reason,
      status: req.status,
      requester_user_id: req.requesterUserId,
      requester_name: req.requesterName,
      approvals: req.approvals,
      created_at: req.createdAt,
      resolved_at: req.resolvedAt,
    };
    const { error } = await client.from('correction_requests').insert(row);
    if (error) throw new Error(`Supabase createCorrectionRequest error: ${error.message}`);
    return req;
  }

  async updateCorrectionRequest(req: CorrectionRequest): Promise<void> {
    const client = this.getClient();
    const { error } = await client
      .from('correction_requests')
      .update({
        status: req.status,
        approvals: req.approvals,
        resolved_at: req.resolvedAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.id);
    if (error) throw new Error(`Supabase updateCorrectionRequest error: ${error.message}`);
  }

  async getAuditLogs(institutionId?: string): Promise<StoredAuditLog[]> {
    const client = this.getClient();
    let q = client.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100);
    if (institutionId) q = q.eq('institution_id', institutionId);
    const { data, error } = await q;
    if (error) throw new Error(`Supabase getAuditLogs error: ${error.message}`);
    return (data || []).map((row) => ({
      id: row.id,
      institutionId: row.institution_id,
      actorId: row.actor_id,
      actorName: row.actor_name,
      actorRole: row.actor_role,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      details: row.details,
      ipAddress: row.ip_address,
      createdAt: row.created_at || row.timestamp || new Date().toISOString(),
    }));
  }

  async recordAuditLog(log: StoredAuditLog): Promise<StoredAuditLog> {
    const client = this.getClient();
    const row = {
      id: log.id,
      institution_id: log.institutionId || 'inst_verimark_01',
      actor_id: log.actorId,
      actor_name: log.actorName,
      actor_role: log.actorRole,
      action: log.action,
      entity_type: log.entityType,
      entity_id: log.entityId,
      details: log.details,
      ip_address: log.ipAddress,
      created_at: log.createdAt,
    };
    const { error } = await client.from('audit_logs').insert(row);
    if (error) throw new Error(`Supabase recordAuditLog error: ${error.message}`);
    return log;
  }

  async checkHealth(): Promise<StorageHealthReport> {
    const start = Date.now();
    if (!isSupabaseConfigured()) {
      return {
        status: 'CONFIG_ERROR',
        engine: 'supabase_postgres',
        isPersistent: false,
        tableCounts: { results: 0, checkpoints: 0, events: 0, students: 0 },
        warnings: [
          'Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY) are missing or set to placeholder values.',
        ],
      };
    }

    try {
      const client = this.getClient();
      const [resResults, resCheckpoints, resEvents, resStudents] = await Promise.all([
        client.from('results').select('*', { count: 'exact', head: true }),
        client.from('ledger_checkpoints').select('*', { count: 'exact', head: true }),
        client.from('ledger_events').select('*', { count: 'exact', head: true }),
        client.from('students').select('*', { count: 'exact', head: true }),
      ]);

      const latencyMs = Date.now() - start;
      return {
        status: 'HEALTHY',
        engine: 'supabase_postgres',
        isPersistent: true,
        tableCounts: {
          results: resResults.count || 0,
          checkpoints: resCheckpoints.count || 0,
          events: resEvents.count || 0,
          students: resStudents.count || 0,
        },
        warnings: [],
        latencyMs,
      };
    } catch (err: any) {
      return {
        status: 'DEGRADED',
        engine: 'supabase_postgres',
        isPersistent: false,
        tableCounts: { results: 0, checkpoints: 0, events: 0, students: 0 },
        warnings: [`Supabase connection error: ${err.message}`],
      };
    }
  }
}
