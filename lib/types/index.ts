// ==============================================================================
// VERIMARK – Core Type Definitions
// ==============================================================================

export type ResultStatus = 'draft' | 'published' | 'corrected' | 'revoked';

export type UserRole = 'ADMIN' | 'EXAM_CONTROLLER' | 'ACADEMIC_DEAN' | 'AUDITOR' | 'STUDENT';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  publicKey?: string;
  studentRegNo?: string;
  mustChangePassword?: boolean;
  isActive?: boolean;
  passwordVersion?: number;
}

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  studentRegNo?: string;
  passwordHash: string;
  passwordSalt: string;
  mustChangePassword: boolean;
  isActive: boolean;
  passwordVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface SafeUserRecord {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  studentRegNo?: string;
  mustChangePassword: boolean;
  isActive: boolean;
  passwordVersion: number;
  createdAt: string;
  updatedAt: string;
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

// ==============================================================================
// Academic Analytics Types
// ==============================================================================

export interface AnalyticsKpiCards {
  totalPublishedResults: number;
  verifiedRecordsCount: number;
  averageMarks: number;
  overallPercentage: number;
  totalExaminations: number;
  pendingCorrectionRequests: number;
  approvedCorrections: number;
  signedLedgerCheckpoints: number;
  ledgerIntegrityStatus: string;
}

export interface SubjectPerformance {
  subject: string;
  averageMarks: number;
  maxMarks: number;
  averagePercentage: number;
  highestMark: number;
  lowestMark: number;
  studentCount: number;
  passCount: number;
  failCount: number;
  passRate: number;
}

export interface ExaminationPerformance {
  examName: string;
  studentCount: number;
  averageMarks: number;
  averagePercentage: number;
  highestMark: number;
  lowestMark: number;
  passCount: number;
  failCount: number;
  passRate: number;
}

export interface GradeDistributionItem {
  grade: string;
  label: string;
  minPercentage: number;
  maxPercentage: number;
  count: number;
  percentageOfCohort: number;
  color: string;
}

export interface StudentPerformanceDistributionItem {
  bracket: string;
  min: number;
  max: number;
  count: number;
  percentage: number;
}

export interface HighestLowestRecord {
  mark: number;
  maxMarks: number;
  percentage: number;
  studentName: string;
  studentRegNo: string;
  subject: string;
  examName: string;
}

export interface PassFailDistribution {
  passThresholdPercentage: number;
  passedCount: number;
  failedCount: number;
  passRate: number;
  failRate: number;
}

export interface PublicationTimelineItem {
  date: string;
  publishedCount: number;
  averageMarks: number;
  subjects: string[];
}

export interface CryptographicAnalytics {
  totalLedgerEvents: number;
  signedCheckpoints: number;
  successfulVerificationCount: number;
  failedVerificationCount: number;
  detectedTamperingIncidents: number;
  correctionApprovalActivity: {
    totalRequests: number;
    pendingApprovals: number;
    approvedApplied: number;
    rejected: number;
  };
  ledgerIntegrity: {
    status: 'SECURE' | 'TAMPER_DETECTED' | 'CHECKPOINT_MISMATCH' | 'CORRUPTED';
    latestCheckpointSeq: number;
    merkleRoot: string;
    signerPublicKey: string;
    independentVaultSynced: boolean;
  };
}

export interface DetailedAnalyticsRecord {
  id: string;
  studentRegNo: string;
  studentName: string;
  subject: string;
  examName: string;
  marksObtained: number;
  maxMarks: number;
  percentage: number;
  status: ResultStatus;
  publicationDate: string;
  verificationStatus: 'VERIFIED' | 'TAMPERED' | 'UNAVAILABLE';
  recordHash: string;
  merkleLeafHash?: string;
  checkpointId?: string;
}

export interface AcademicAnalyticsResponse {
  success: boolean;
  userRole: UserRole;
  isDemoDataset: boolean;
  datasetNotice: string;
  kpis: AnalyticsKpiCards;
  academicPerformance: {
    subjectWise: SubjectPerformance[];
    examWise: ExaminationPerformance[];
    gradeDistribution: GradeDistributionItem[];
    studentDistribution: StudentPerformanceDistributionItem[];
    highestMark: HighestLowestRecord | null;
    lowestMark: HighestLowestRecord | null;
    passFail: PassFailDistribution;
  };
  academicTrends: {
    timeline: PublicationTimelineItem[];
    hasMultipleSemesters: boolean;
    semesterNotice: string;
  };
  cryptographicAnalytics: CryptographicAnalytics;
  detailedRecords: DetailedAnalyticsRecord[];
  filterOptions: {
    examinations: string[];
    subjects: string[];
    dateRange: {
      earliest: string;
      latest: string;
    };
  };
}

// ==============================================================================
// Personal Student Analytics Types (Per-Student Dashboard Graphs)
// ==============================================================================

export interface StudentMidEndTermComparison {
  subject: string;
  midTermMarks: number | null;
  endTermMarks: number | null;
  maxMarks: number;
  hasMidTerm: boolean;
  hasEndTerm: boolean;
}

export interface StudentTrendPoint {
  examName: string;
  publicationDate: string;
  marksObtained: number;
  maxMarks: number;
  percentage: number;
}

export interface StudentDiagnosticAlert {
  subject: string;
  marksObtained: number;
  maxMarks: number;
  percentage: number;
  benchmark: number;
  deficit: number;
  status: 'BELOW_BENCHMARK' | 'SATISFACTORY' | 'HONORS';
}

export interface StudentSubjectAverage {
  subject: string;
  marksObtained: number;
  maxMarks: number;
  percentage: number;
  grade: string;
  status: string;
}

export interface StudentPassFailDistribution {
  passedCount: number;
  failedCount: number;
  passRate: number;
  failRate: number;
  benchmark: number;
}

export interface StudentExtremes {
  highest: {
    subject: string;
    marksObtained: number;
    maxMarks: number;
    percentage: number;
    examName: string;
  } | null;
  lowest: {
    subject: string;
    marksObtained: number;
    maxMarks: number;
    percentage: number;
    examName: string;
  } | null;
  variance: number;
  isSingleSubject: boolean;
}

export interface StudentComparisonTableRow {
  id: string;
  subject: string;
  examName: string;
  midTermMarks: number | null;
  endTermMarks: number | null;
  totalMarks: number;
  maxMarks: number;
  percentage: number;
  grade: string;
  status: 'PASS' | 'FAIL';
  merkleIndex?: number;
  recordHash: string;
  verificationStatus: 'VERIFIED' | 'TAMPERED';
}

export interface PersonalStudentAnalyticsResponse {
  success: boolean;
  studentRegNo: string;
  studentName: string;
  course: string;
  benchmark: number;
  isSingleExam: boolean;
  examCount: number;
  subjectCount: number;
  midVsEndTerm: StudentMidEndTermComparison[];
  trends: StudentTrendPoint[];
  diagnosticAlerts: {
    alerts: StudentDiagnosticAlert[];
    allClear: boolean;
    benchmark: number;
    message: string;
  };
  subjectAverages: StudentSubjectAverage[];
  passFail: StudentPassFailDistribution;
  extremes: StudentExtremes;
  comparisonTable: StudentComparisonTableRow[];
}
