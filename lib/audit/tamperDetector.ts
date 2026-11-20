import { dbService } from '../storage/db';
import { getLatestIndependentCheckpoint } from '../storage/independentCheckpointStore';
import { computeResultRecordHash, hashLeaf } from '../crypto/sha256';
import { MerkleTree } from '../crypto/merkle';
import { verifyCheckpoint } from '../crypto/ed25519';
import { SystemAuditReport, TamperAuditFinding } from '../types';

/**
 * Performs a comprehensive cryptographic integrity audit of the entire database.
 * Recomputes all hashes from raw database records, verifies the Merkle tree,
 * checks Ed25519 signatures, and verifies against independently authenticated checkpoints.
 */
export async function performSystemAudit(): Promise<SystemAuditReport> {
  const auditedAt = new Date().toISOString();
  const allResults = await dbService.getResults();
  const publishedResults = allResults.filter(
    (r) => r.status === 'published' || r.status === 'corrected'
  );

  const findings: TamperAuditFinding[] = [];
  let databaseTamperDetected = false;

  // 1. Recalculate hash for each record and compare with stored record_hash
  for (const record of publishedResults) {
    const { recordHash: recalculatedHash } = computeResultRecordHash({
      studentRegNo: record.studentRegNo,
      studentName: record.studentName,
      course: record.course,
      subject: record.subject,
      examName: record.examName,
      marksObtained: record.marksObtained,
      maxMarks: record.maxMarks,
      publicationDate: record.publicationDate,
    });

    if (recalculatedHash.toLowerCase() !== record.recordHash.toLowerCase()) {
      databaseTamperDetected = true;
      findings.push({
        recordId: record.id,
        studentRegNo: record.studentRegNo,
        studentName: record.studentName,
        subject: record.subject,
        expectedHash: record.recordHash,
        actualCalculatedHash: recalculatedHash,
        tamperedFields: ['marksObtained or student details'],
        severity: 'CRITICAL',
        details: `Direct database alteration detected! The record contents in the database do not match its cryptographic record hash. Actual DB marks: ${record.marksObtained}. Expected Hash: ${record.recordHash.substring(0, 16)}..., Recalculated Hash: ${recalculatedHash.substring(0, 16)}...`,
      });
    }
  }

  // 2. Fetch latest independent checkpoint
  let independentCheckpoint = null;
  let independentCheckpointVerified = false;
  try {
    independentCheckpoint = await getLatestIndependentCheckpoint();
    if (independentCheckpoint) {
      const v = verifyCheckpoint(independentCheckpoint);
      independentCheckpointVerified = v.isValid;
      if (!v.isValid) {
        findings.push({
          recordId: 'checkpoint',
          studentRegNo: 'ALL',
          studentName: 'SYSTEM',
          subject: 'LEDGER',
          expectedHash: independentCheckpoint.checkpointHash,
          actualCalculatedHash: 'INVALID_SIGNATURE',
          tamperedFields: ['signature'],
          severity: 'CRITICAL',
          details: `Independent Checkpoint #${independentCheckpoint.sequenceNumber} has an invalid or forged Ed25519 signature!`,
        });
      }
    }
  } catch (err: any) {
    findings.push({
      recordId: 'checkpoint_store',
      studentRegNo: 'ALL',
      studentName: 'SYSTEM',
      subject: 'LEDGER',
      expectedHash: 'VALID_STORE',
      actualCalculatedHash: 'ERROR',
      tamperedFields: ['checkpoint_store'],
      severity: 'CRITICAL',
      details: `Independent checkpoint store verification failed: ${err.message}`,
    });
  }

  // 3. Reconstruct Merkle tree from published results
  publishedResults.sort((a, b) =>
    `${a.studentRegNo}_${a.subject}`.localeCompare(`${b.studentRegNo}_${b.subject}`)
  );

  const leafHashes = publishedResults.map((r) => r.recordHash);
  const reconstructedTree = new MerkleTree(leafHashes);
  const reconstructedRoot = reconstructedTree.getRoot();

  let ledgerIntegrity = true;
  if (independentCheckpoint) {
    if (reconstructedRoot.toLowerCase() !== independentCheckpoint.merkleRoot.toLowerCase()) {
      ledgerIntegrity = false;
      findings.push({
        recordId: 'merkle_tree_root',
        studentRegNo: 'ALL',
        studentName: 'SYSTEM',
        subject: 'MERKLE_ROOT',
        expectedHash: independentCheckpoint.merkleRoot,
        actualCalculatedHash: reconstructedRoot,
        tamperedFields: ['merkle_root'],
        severity: 'CRITICAL',
        details: `Reconstructed Merkle root (${reconstructedRoot.substring(0, 16)}...) diverges from the signed independent checkpoint (${independentCheckpoint.merkleRoot.substring(0, 16)}...). Database records have been added, removed, or altered!`,
      });
    }
  }

  // Overall status
  let overallStatus: SystemAuditReport['overallStatus'] = 'SECURE';
  if (databaseTamperDetected) {
    overallStatus = 'TAMPER_DETECTED';
  } else if (!ledgerIntegrity) {
    overallStatus = 'CHECKPOINT_MISMATCH';
  } else if (!independentCheckpointVerified && independentCheckpoint) {
    overallStatus = 'CORRUPTED';
  }

  return {
    overallStatus,
    totalResults: allResults.length,
    publishedCount: publishedResults.length,
    tamperedCount: findings.length,
    ledgerIntegrity,
    independentCheckpointVerified,
    activeCheckpoint: independentCheckpoint || undefined,
    findings,
    auditedAt,
  };
}
