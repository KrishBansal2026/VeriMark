// ==============================================================================
// VERIMARK – Core Type Definitions
// ==============================================================================

export type ResultStatus = 'draft' | 'published' | 'corrected' | 'revoked';

export type UserRole = 'ADMIN' | 'EXAM_CONTROLLER' | 'ACADEMIC_DEAN' | 'AUDITOR';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  publicKey?: string;
}

export interface StudentResult {
  id: string;
  studentRegNo: string;
  studentName: string;
  course: string;
  subject: string;
  examName: string;
  marksObtained: number;
  maxMarks: number;
  publicationDate: string; // ISO 8601 string
  recordHash: string;      // SHA-256 hex string of canonical payload
  merkleLeafHash?: string; // Domain-separated leaf hash
  merkleIndex?: number;    // Leaf position in the Merkle tree
  checkpointId?: string;   // Checkpoint sequence id
  status: ResultStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CanonicalResultPayload {
  course: string;
  exam_name: string;
  marks_obtained: string; // Formatted to 2 decimal places e.g. "85.00"
  max_marks: string;      // Formatted to 2 decimal places e.g. "100.00"
  publication_date: string;
  student_name: string;
  student_reg_no: string;
  subject: string;
}

export interface MerkleProofStep {
  position: 'left' | 'right';
  hash: string;
}

export interface MerkleInclusionProof {
  leafHash: string;
  leafIndex: number;
  proof: MerkleProofStep[];
  root: string;
}

export type LedgerEventType = 
  | 'RESULT_PUBLISHED' 
  | 'RESULT_CORRECTED' 
  | 'CHECKPOINT_COMMITTED';

export interface LedgerEvent {
  id: string;
  sequenceNumber: number;
  eventType: LedgerEventType;
  recordId: string;
  studentRegNo: string;
  payload: Record<string, any>;
  payloadHash: string;
  prevEventHash: string;
  eventHash: string;
  createdAt: string;
}

export interface LedgerCheckpoint {
  id: string;
  sequenceNumber: number;
  merkleRoot: string;
  eventCount: number;
  leafCount: number;
  prevCheckpointHash: string;
  checkpointHash: string;   // SHA-256 canonical hash of checkpoint properties
  signature: string;        // Ed25519 signature (hex)
  signerPublicKey: string;  // Ed25519 public key (hex)
  committedAt: string;
}

export type CorrectionRequestStatus = 
  | 'pending_approvals' 
  | 'partially_approved' 
  | 'approved_applied' 
  | 'rejected';

export type ApproverRole = 'EXAM_CONTROLLER' | 'ACADEMIC_DEAN';

export interface CorrectionApproval {
  id: string;
  requestId: string;
  approverUserId: string;   // Verified authenticated user ID
  approverName: string;
  approverRole: ApproverRole;
  approverPublicKey: string;
  signature: string;        // Ed25519 signature
  signedPayloadHash: string;
  comments?: string;
  approvedAt: string;
}

export interface CorrectionRequest {
  id: string;
  resultId: string;
  studentRegNo: string;
  subject: string;
  originalMarks: number;
  proposedMarks: number;
  originalHash: string;
  proposedHash: string;
  reason: string;
  status: CorrectionRequestStatus;
  requesterUserId: string;  // Verified user ID who requested correction
  requesterName: string;
  approvals: CorrectionApproval[];
  createdAt: string;
  resolvedAt?: string;
}

export type VerificationStatus = 
  | 'VERIFIED' 
  | 'TAMPERED' 
  | 'INVALID' 
  | 'UNAVAILABLE';

export interface VerificationResult {
  status: VerificationStatus;
  message: string;
  result?: StudentResult;
  recalculatedHash?: string;
  expectedHash?: string;
  isHashValid: boolean;
  merkleProof?: MerkleInclusionProof;
  isMerkleProofValid: boolean;
  checkpoint?: LedgerCheckpoint;
  isCheckpointSignatureValid: boolean;
  correctionHistory?: {
    originalMarks: number;
    proposedMarks: number;
    reason: string;
    resolvedAt?: string;
    approvals: {
      userId: string;
      role: ApproverRole;
      name: string;
      approvedAt: string;
      verified: boolean;
    }[];
  }[];
  timestamp: string;
}

export interface TamperAuditFinding {
  recordId: string;
  studentRegNo: string;
  studentName: string;
  subject: string;
  expectedHash: string;
  actualCalculatedHash: string;
  tamperedFields: string[];
  severity: 'CRITICAL' | 'WARNING' | 'OK';
  details: string;
}

export interface SystemAuditReport {
  overallStatus: 'SECURE' | 'TAMPER_DETECTED' | 'CHECKPOINT_MISMATCH' | 'CORRUPTED';
  totalResults: number;
  publishedCount: number;
  tamperedCount: number;
  ledgerIntegrity: boolean;
  eventChainIntegrity: boolean;
  independentCheckpointVerified: boolean;
  activeCheckpoint?: LedgerCheckpoint;
  findings: TamperAuditFinding[];
  auditedAt: string;
}
