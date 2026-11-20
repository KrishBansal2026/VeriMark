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
import { userStore } from './userStore';

const VAULT_DIR = path.join(process.cwd(), '.verimark_vault');
const DB_FILE = path.join(VAULT_DIR, 'database.json');

interface DatabaseSchema {
  users?: any[];
  results: StudentResult[];
  ledgerEvents: LedgerEvent[];
  checkpoints: LedgerCheckpoint[];
  correctionRequests: CorrectionRequest[];
}

function safeWriteFileSync(filePath: string, data: string): void {
  const maxRetries = 10;
  for (let i = 0; i < maxRetries; i++) {
    try {
      fs.writeFileSync(filePath, data, { mode: 0o600 });
      return;
    } catch (err: any) {
      if (i === maxRetries - 1) throw err;
      // Sleep synchronously for 25ms to let OneDrive / OS release the file lock
      const end = Date.now() + 25;
      while (Date.now() < end) {}
    }
  }
}

function ensureDbFile(): DatabaseSchema {
  if (!fs.existsSync(VAULT_DIR)) {
    fs.mkdirSync(VAULT_DIR, { recursive: true });
  }

  if (fs.existsSync(DB_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      if (data && Array.isArray(data.results)) {
        return data;
      }
    } catch (err) {
      // In case of transient read error
    }
  }

  const initialDb: DatabaseSchema = {
    results: [],
    ledgerEvents: [],
    checkpoints: [],
    correctionRequests: [],
  };

  safeWriteFileSync(DB_FILE, JSON.stringify(initialDb, null, 2));
  return initialDb;
}

function saveDb(data: DatabaseSchema): void {
  if (!fs.existsSync(VAULT_DIR)) {
    fs.mkdirSync(VAULT_DIR, { recursive: true });
  }
  safeWriteFileSync(DB_FILE, JSON.stringify(data, null, 2));
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
  const payloadHash = sha256(canonicalizeJson(payload));
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
    userStore.resetUserStoreForTesting();
    const cleanDb: DatabaseSchema = {
      users: undefined,
      results: [],
      ledgerEvents: [],
      checkpoints: [],
      correctionRequests: [],
    };
    saveDb(cleanDb);
    userStore.resetUserStoreForTesting();
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

  getResultsByStudentRegNo: async (studentRegNo: string): Promise<StudentResult[]> => {
    const db = ensureDbFile();
    const cleanRegNo = studentRegNo.trim().toUpperCase();
    return db.results.filter(
      (r) =>
        r.studentRegNo.trim().toUpperCase() === cleanRegNo &&
        (r.status === 'published' || r.status === 'corrected')
    );
  },

  getCorrectionHistoryByStudentRegNo: async (studentRegNo: string): Promise<CorrectionRequest[]> => {
    const db = ensureDbFile();
    const cleanRegNo = studentRegNo.trim().toUpperCase();
    return db.correctionRequests.filter(
      (cr) => cr.studentRegNo.trim().toUpperCase() === cleanRegNo
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
    requester: AuthUser;
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

    const alreadyApprovedRole = request.approvals.some(
      (a) => a.approverRole === approverRole
    );
    if (alreadyApprovedRole) {
      throw new Error(`Role '${approverRole}' has already been signed for this correction request`);
    }

    const keys = getServerKeys();
    const approverKeyInfo =
      approverRole === 'EXAM_CONTROLLER' ? keys.approver1 : keys.approver2;

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
      comments: params.comments,
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

        appendLedgerEvent('RESULT_CORRECTED', result.id, result.studentRegNo, {
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
