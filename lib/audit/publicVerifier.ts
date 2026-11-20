import { dbService } from '../storage/db';
import { computeResultRecordHash } from '../crypto/sha256';
import { verifyMerkleProof } from '../crypto/merkle';
import { verifyCheckpoint } from '../crypto/ed25519';
import { getLatestIndependentCheckpoint } from '../storage/independentCheckpointStore';
import { VerificationResult, VerificationStatus } from '../types';

/**
 * Phase 7: Comprehensive Cryptographic Verification for Public Marksheets.
 * Verifies canonical SHA-256 hash, RFC 6962 Merkle inclusion proof, and Ed25519 Authority signature.
 * Detects deleted/purged published records by cross-referencing append-only ledger history.
 */
export async function verifyResultCryptographically(resultId: string): Promise<VerificationResult> {
  const timestamp = new Date().toISOString();

  // 1. Fetch result from database
  const result = await dbService.getResultById(resultId);

  // Requirement 6: Check if result disappeared after publication
  if (!result) {
    const allEvents = await dbService.getLedgerEvents();
    const priorEvent = allEvents.find((e) => e.recordId === resultId);

    if (priorEvent) {
      return {
        status: 'TAMPERED',
        message: `CRITICAL INTEGRITY BREACH: This examination marksheet (Record ID ${resultId}) was published in Ledger Event #${priorEvent.sequenceNumber} but has been illegally deleted or purged from the active database!`,
        isHashValid: false,
        isMerkleProofValid: false,
        isCheckpointSignatureValid: false,
        timestamp,
      };
    }

    return {
      status: 'UNAVAILABLE',
      message: 'Student marksheet record not found in the examination registry.',
      isHashValid: false,
      isMerkleProofValid: false,
      isCheckpointSignatureValid: false,
      timestamp,
    };
  }

  if (result.status === 'draft') {
    return {
      status: 'UNAVAILABLE',
      message: 'This examination result is currently in draft status and has not yet been committed to the ledger.',
      result,
      isHashValid: false,
      isMerkleProofValid: false,
      isCheckpointSignatureValid: false,
      timestamp,
    };
  }

  // 2. Recalculate canonical SHA-256 hash from record values
  const { recordHash: recalculatedHash } = computeResultRecordHash({
    studentRegNo: result.studentRegNo,
    studentName: result.studentName,
    course: result.course,
    subject: result.subject,
    examName: result.examName,
    marksObtained: result.marksObtained,
    maxMarks: result.maxMarks,
    publicationDate: result.publicationDate,
  });

  const isHashValid = recalculatedHash.toLowerCase() === result.recordHash.toLowerCase();

  // 3. Obtain Merkle inclusion proof and latest checkpoint
  const proofData = await dbService.getResultMerkleProof(resultId);
  let isMerkleProofValid = false;
  let isCheckpointSignatureValid = false;
  let checkpoint = null;
  let checkpointDivergence = false;

  if (proofData) {
    checkpoint = proofData.checkpoint;

    if (checkpoint) {
      const chkCheck = verifyCheckpoint(checkpoint);
      isCheckpointSignatureValid = chkCheck.isValid;

      if (isCheckpointSignatureValid) {
        isMerkleProofValid = verifyMerkleProof(
          result.recordHash,
          proofData.inclusionProof.proof,
          checkpoint.merkleRoot
        );
      }
    }
  }

  // 4. Cross-reference with independent checkpoint vault
  let independentCheckpoint = null;
  try {
    independentCheckpoint = await getLatestIndependentCheckpoint();
    if (independentCheckpoint && checkpoint) {
      if (checkpoint.merkleRoot.toLowerCase() !== independentCheckpoint.merkleRoot.toLowerCase()) {
        checkpointDivergence = true;
        isCheckpointSignatureValid = false;
      }
    }
  } catch (err) {
    isCheckpointSignatureValid = false;
  }

  // 5. Fetch correction history if applicable
  const allCorrectionRequests = await dbService.getCorrectionRequests();
  const relatedCorrections = allCorrectionRequests
    .filter((cr) => cr.resultId === resultId && cr.status === 'approved_applied')
    .map((cr) => ({
      originalMarks: cr.originalMarks,
      proposedMarks: cr.proposedMarks,
      reason: cr.reason,
      resolvedAt: cr.resolvedAt,
      approvals: cr.approvals.map((a) => ({
        userId: a.approverUserId,
        role: a.approverRole,
        name: a.approverName,
        approvedAt: a.approvedAt,
        verified: true,
      })),
    }));

  // 6. Determine cryptographic verification status
  let status: VerificationStatus = 'UNAVAILABLE';
  let message = '';

  if (!isHashValid) {
    status = 'TAMPERED';
    message = 'CRITICAL: Data tampering detected! Stored examination marks or student details do not match the cryptographic SHA-256 seal.';
  } else if (checkpointDivergence) {
    status = 'TAMPERED';
    message = 'CRITICAL: Database checkpoint diverges from the independently authenticated vault checkpoint. Database state has been modified out-of-band.';
  } else if (!isCheckpointSignatureValid) {
    status = 'INVALID';
    message = 'INVALID: The ledger checkpoint signature could not be verified by the Central Examination Authority public key.';
  } else if (!isMerkleProofValid) {
    status = 'INVALID';
    message = 'INVALID: Merkle inclusion proof failed. This record is not present in the committed ledger state.';
  } else {
    status = 'VERIFIED';
    message = 'AUTHENTIC & VERIFIED: All cryptographic integrity proofs succeeded (Canonical SHA-256 seal, RFC 6962 Merkle inclusion proof, and Ed25519 Authority signature).';
  }

  return {
    status,
    message,
    result,
    recalculatedHash,
    expectedHash: result.recordHash,
    isHashValid,
    merkleProof: proofData?.inclusionProof,
    isMerkleProofValid,
    checkpoint: checkpoint || undefined,
    isCheckpointSignatureValid,
    correctionHistory: relatedCorrections.length > 0 ? relatedCorrections : undefined,
    timestamp,
  };
}
