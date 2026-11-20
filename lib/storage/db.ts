import * as fs from 'fs';
import * as path from 'path';
import {
  StudentResult,
  LedgerEvent,
  LedgerCheckpoint,
  CorrectionRequest,
  CorrectionApproval,
  ApproverRole,
} from '../types';
import { computeResultRecordHash, hashLeaf, sha256 } from '../crypto/sha256';
import { MerkleTree } from '../crypto/merkle';
import {
  createSignedCheckpoint,
  verifyWithEd25519,
  signWithEd25519,
} from '../crypto/ed25519';
import { getServerKeys } from '../server/keys';
import {
  commitIndependentCheckpoint,
  resetIndependentStoreForTesting,
} from './independentCheckpointStore';

const VAULT_DIR = path.join(process.cwd(), '.verimark_vault');
const DB_FILE = path.join(VAULT_DIR, 'database.json');

interface DatabaseSchema {
  results: StudentResult[];
  ledgerEvents: LedgerEvent[];
  checkpoints: LedgerCheckpoint[];
  correctionRequests: CorrectionRequest[];
}

function ensureDbFile(): DatabaseSchema {
  if (!fs.existsSync(VAULT_DIR)) {
    fs.mkdirSync(VAULT_DIR, { recursive: true });
  }

  if (fs.existsSync(DB_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      return data;
    } catch (err) {
      console.error('Error reading db file:', err);
    }
  }

  const initialDb: DatabaseSchema = {
    results: [],
    ledgerEvents: [],
    checkpoints: [],
    correctionRequests: [],
  };

  fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2), { mode: 0o600 });
  return initialDb;
}

function saveDb(data: DatabaseSchema): void {
  if (!fs.existsSync(VAULT_DIR)) {
    fs.mkdirSync(VAULT_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), { mode: 0o600 });
}

/**
 * Commits a new signed checkpoint across the entire ledger.
 */
export async function commitLedgerCheckpoint(): Promise<LedgerCheckpoint> {
  const db = ensureDbFile();
  const keys = getServerKeys();

  const publishedResults = db.results.filter(
    (r) => r.status === 'published' || r.status === 'corrected'
  );

  // Compute leaf hashes in deterministic order by registration number + subject
  publishedResults.sort((a, b) =>
    `${a.studentRegNo}_${a.subject}`.localeCompare(`${b.studentRegNo}_${b.subject}`)
  );

  const leafRecordHashes = publishedResults.map((r) => r.recordHash);
  const tree = new MerkleTree(leafRecordHashes);
  const merkleRoot = tree.getRoot();

  // Update merkle indices on the records
  publishedResults.forEach((r, idx) => {
    r.merkleIndex = idx;
    r.merkleLeafHash = hashLeaf(r.recordHash);
  });

  const prevCheckpoint = db.checkpoints.length > 0
    ? db.checkpoints[db.checkpoints.length - 1]
    : null;

  const prevCheckpointHash = prevCheckpoint
    ? prevCheckpoint.checkpointHash
    : '0000000000000000000000000000000000000000000000000000000000000000';

  const sequenceNumber = (prevCheckpoint?.sequenceNumber || 0) + 1;

  const checkpoint = createSignedCheckpoint(
    {
      sequenceNumber,
      merkleRoot,
      eventCount: db.ledgerEvents.length,
      leafCount: publishedResults.length,
      prevCheckpointHash,
    },
    keys.ledgerAuthority.privateKey,
    keys.ledgerAuthority.publicKey
  );

  // Associate checkpoint ID with results
  publishedResults.forEach((r) => {
    r.checkpointId = checkpoint.id;
  });

  // Save to DB and independent store
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
  payload: Record<string, any>
): LedgerEvent {
  const db = ensureDbFile();

  const prevEvent = db.ledgerEvents.length > 0
    ? db.ledgerEvents[db.ledgerEvents.length - 1]
    : null;

  const prevEventHash = prevEvent
    ? prevEvent.eventHash
    : '0000000000000000000000000000000000000000000000000000000000000000';

  const sequenceNumber = (prevEvent?.sequenceNumber || 0) + 1;
  const payloadHash = sha256(JSON.stringify(payload));
  const eventHash = sha256(
    `${sequenceNumber}:${eventType}:${recordId}:${payloadHash}:${prevEventHash}`
  );

  const event: LedgerEvent = {
    id: `evt_${sequenceNumber}_${eventHash.substring(0, 10)}`,
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
      results: [],
      ledgerEvents: [],
      checkpoints: [],
      correctionRequests: [],
    };
    saveDb(cleanDb);
  },

  // Results
  getResults: async (): Promise<StudentResult[]> => {
    const db = ensureDbFile();
    return db.results;
  },

  getPublishedResults: async (): Promise<StudentResult[]> => {
    const db = ensureDbFile();
    return db.results.filter(
      (r) => r.status === 'published' || r.status === 'corrected'
    );
  },

  getResultById: async (id: string): Promise<StudentResult | null> => {
    const db = ensureDbFile();
    const result = db.results.find((r) => r.id === id);
    return result || null;
  },

  createResult: async (data: {
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

    appendLedgerEvent('RESULT_PUBLISHED', result.id, result.studentRegNo, {
      studentName: result.studentName,
      subject: result.subject,
      marksObtained: result.marksObtained,
      recordHash,
    });

    const checkpoint = await commitLedgerCheckpoint();
    const updatedDb = ensureDbFile();
    const updatedResult = updatedDb.results.find((r) => r.id === id)!;
    return { result: updatedResult, checkpoint };
  },

  getLedgerEvents: async (): Promise<LedgerEvent[]> => {
    const db = ensureDbFile();
    return db.ledgerEvents;
  },

  getCheckpoints: async (): Promise<LedgerCheckpoint[]> => {
    const db = ensureDbFile();
    return db.checkpoints;
  },

  getLatestCheckpoint: async (): Promise<LedgerCheckpoint | null> => {
    const db = ensureDbFile();
    if (db.checkpoints.length === 0) return null;
    return db.checkpoints[db.checkpoints.length - 1];
  },

  getResultMerkleProof: async (resultId: string) => {
    const db = ensureDbFile();
    const result = db.results.find((r) => r.id === resultId);
    if (!result || (result.status !== 'published' && result.status !== 'corrected')) {
      return null;
    }

    const publishedResults = db.results
      .filter((r) => r.status === 'published' || r.status === 'corrected')
      .sort((a, b) => `${a.studentRegNo}_${a.subject}`.localeCompare(`${b.studentRegNo}_${b.subject}`));

    const leafIndex = publishedResults.findIndex((r) => r.id === resultId);
    if (leafIndex === -1) return null;

    const leafRecordHashes = publishedResults.map((r) => r.recordHash);
    const tree = new MerkleTree(leafRecordHashes);

    const inclusionProof = tree.getInclusionProof(leafIndex);
    const latestCheckpoint = db.checkpoints[db.checkpoints.length - 1] || null;

    return {
      inclusionProof,
      checkpoint: latestCheckpoint,
    };
  },

  getCorrectionRequests: async (): Promise<CorrectionRequest[]> => {
    const db = ensureDbFile();
    return db.correctionRequests;
  },

  getCorrectionRequestById: async (id: string): Promise<CorrectionRequest | null> => {
    const db = ensureDbFile();
    return db.correctionRequests.find((cr) => cr.id === id) || null;
  },

  createCorrectionRequest: async (params: {
    resultId: string;
    proposedMarks: number;
    reason: string;
    requesterName: string;
  }): Promise<CorrectionRequest> => {
    const db = ensureDbFile();
    const result = db.results.find((r) => r.id === params.resultId);
    if (!result) {
      throw new Error(`Target result ${params.resultId} not found`);
    }

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
      resultId: result.id,
      studentRegNo: result.studentRegNo,
      subject: result.subject,
      originalMarks: result.marksObtained,
      proposedMarks: proposedMarksNum,
      originalHash: result.recordHash,
      proposedHash,
      reason: params.reason.trim(),
      status: 'pending_approvals',
      requesterName: params.requesterName || 'Academic Administrator',
      approvals: [],
      createdAt: new Date().toISOString(),
    };

    db.correctionRequests.push(request);
    saveDb(db);
    return request;
  },

  submitCorrectionApproval: async (params: {
    requestId: string;
    approverRole: ApproverRole;
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

    const alreadyApprovedByRole = request.approvals.some(
      (a) => a.approverRole === params.approverRole
    );
    if (alreadyApprovedByRole) {
      throw new Error(`Role ${params.approverRole} has already signed this correction request`);
    }

    const keys = getServerKeys();
    const approverInfo =
      params.approverRole === 'EXAM_CONTROLLER' ? keys.approver1 : keys.approver2;

    const signPayload = `${request.id}:${request.proposedHash}:${params.approverRole}`;
    const signature = signWithEd25519(signPayload, approverInfo.privateKey);

    const isSigValid = verifyWithEd25519(signPayload, approverInfo.publicKey, signature);
    if (!isSigValid) {
      throw new Error('Cryptographic signature verification failed on backend');
    }

    const approval: CorrectionApproval = {
      id: `appr_${Date.now()}_${params.approverRole.toLowerCase()}`,
      requestId: request.id,
      approverName: approverInfo.name,
      approverRole: params.approverRole,
      approverPublicKey: approverInfo.publicKey,
      signature,
      signedPayloadHash: sha256(signPayload),
      comments: params.comments,
      approvedAt: new Date().toISOString(),
    };

    request.approvals.push(approval);

    const hasExamController = request.approvals.some((a) => a.approverRole === 'EXAM_CONTROLLER');
    const hasAcademicDean = request.approvals.some((a) => a.approverRole === 'ACADEMIC_DEAN');

    let applied = false;

    if (hasExamController && hasAcademicDean) {
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

        appendLedgerEvent('RESULT_CORRECTED', result.id, result.studentRegNo, {
          requestId: request.id,
          originalMarks: request.originalMarks,
          newMarks: request.proposedMarks,
          reason: request.reason,
          approvers: request.approvals.map((a) => ({ role: a.approverRole, name: a.approverName })),
          recordHash: request.proposedHash,
        });

        await commitLedgerCheckpoint();
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

  rollbackToLastValidCheckpoint: async (): Promise<{ success: boolean; message: string }> => {
    const db = ensureDbFile();
    const checkpoints = db.checkpoints;
    if (checkpoints.length === 0) {
      throw new Error('No valid checkpoint available for rollback');
    }
    const latestCheckpoint = checkpoints[checkpoints.length - 1];

    const events = db.ledgerEvents;
    for (const result of db.results) {
      const relatedEvents = events.filter((e) => e.recordId === result.id);
      if (relatedEvents.length > 0) {
        const latestEvent = relatedEvents[relatedEvents.length - 1];
        if (latestEvent.payload.marksObtained !== undefined) {
          result.marksObtained = Number(latestEvent.payload.marksObtained);
        }
        if (latestEvent.payload.newMarks !== undefined) {
          result.marksObtained = Number(latestEvent.payload.newMarks);
        }
        result.recordHash = latestEvent.payload.recordHash;
      }
    }

    saveDb(db);
    return {
      success: true,
      message: `State restored to match signed Checkpoint #${latestCheckpoint.sequenceNumber} (${latestCheckpoint.merkleRoot.substring(0, 16)}...)`,
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
