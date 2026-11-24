import { dbService } from '../storage/db';
import { getLatestIndependentCheckpoint } from '../storage/independentCheckpointStore';
import { computeResultRecordHash, hashLeaf, sha256, canonicalizeJson } from '../crypto/sha256';
import { MerkleTree } from '../crypto/merkle';
import { verifyCheckpoint } from '../crypto/ed25519';
import { SystemAuditReport, TamperAuditFinding } from '../types';

/**
 * Performs a comprehensive cryptographic integrity audit of the entire database.
 * Phase 5 Remediation:
 * - Recomputes all hashes from raw database records.
 * - Reconstructs the Merkle tree and cross-checks with signed checkpoints.
 * - Validates the complete append-only ledger event hash chain.
 * - Detects deleted, replaced, or modified events.
 */
export async function performSystemAudit(institutionId = 'inst_verimark_01'): Promise<SystemAuditReport> {
  const auditedAt = new Date().toISOString();
  const allResults = await dbService.getResults(institutionId);
  const publishedResults = allResults.filter(
    (r) => r.status === 'published' || r.status === 'corrected'
  );

  const findings: TamperAuditFinding[] = [];
  let databaseTamperDetected = false;
  let eventChainIntegrity = true;

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
    independentCheckpoint = await dbService.getLatestCheckpoint(institutionId);
    if (!independentCheckpoint && institutionId === 'inst_verimark_01') {
      independentCheckpoint = await getLatestIndependentCheckpoint();
    }
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

  // 4. Phase 5: Complete Ledger Event Chain Integrity Verification
  const events = await dbService.getLedgerEvents(institutionId);

  if (independentCheckpoint && events.length !== independentCheckpoint.eventCount) {
    eventChainIntegrity = false;
    findings.push({
      recordId: 'event_stream_count',
      studentRegNo: 'ALL',
      studentName: 'SYSTEM',
      subject: 'EVENT_CHAIN',
      expectedHash: `Count: ${independentCheckpoint.eventCount}`,
      actualCalculatedHash: `Count: ${events.length}`,
      tamperedFields: ['eventCount'],
      severity: 'CRITICAL',
      details: `Event count mismatch! Authenticated checkpoint expects ${independentCheckpoint.eventCount} events, but database has ${events.length} events. Events may have been deleted or inserted.`,
    });
  }

  let runningPrevHash = '0000000000000000000000000000000000000000000000000000000000000000';
  for (let i = 0; i < events.length; i++) {
    const e = events[i];

    // Monotonic continuous sequence check
    if (e.sequenceNumber !== i + 1) {
      eventChainIntegrity = false;
      findings.push({
        recordId: e.id,
        studentRegNo: e.studentRegNo,
        studentName: 'SYSTEM',
        subject: 'EVENT_SEQUENCE',
        expectedHash: `Seq #${i + 1}`,
        actualCalculatedHash: `Seq #${e.sequenceNumber}`,
        tamperedFields: ['sequenceNumber'],
        severity: 'CRITICAL',
        details: `Discontinuous event sequence at index ${i}! Expected #${i + 1}, found #${e.sequenceNumber}.`,
      });
    }

    // Previous event hash chaining check
    if (e.prevEventHash.toLowerCase() !== runningPrevHash.toLowerCase()) {
      eventChainIntegrity = false;
      findings.push({
        recordId: e.id,
        studentRegNo: e.studentRegNo,
        studentName: 'SYSTEM',
        subject: 'EVENT_HASH_CHAIN',
        expectedHash: runningPrevHash,
        actualCalculatedHash: e.prevEventHash,
        tamperedFields: ['prevEventHash'],
        severity: 'CRITICAL',
        details: `Broken ledger event hash chain at event #${e.sequenceNumber}! Previous event hash does not match preceding event hash.`,
      });
    }

    // Payload canonical hash check
    const expectedPayloadHash = sha256(canonicalizeJson(e.payload));
    if (e.payloadHash.toLowerCase() !== expectedPayloadHash.toLowerCase()) {
      eventChainIntegrity = false;
      findings.push({
        recordId: e.id,
        studentRegNo: e.studentRegNo,
        studentName: 'SYSTEM',
        subject: 'EVENT_PAYLOAD',
        expectedHash: expectedPayloadHash,
        actualCalculatedHash: e.payloadHash,
        tamperedFields: ['payloadHash'],
        severity: 'CRITICAL',
        details: `Tampered payload in ledger event #${e.sequenceNumber}! Computed payload hash does not match stored payloadHash.`,
      });
    }

    // Recomputed event hash check
    const expectedEventHash = sha256(
      `${e.sequenceNumber}:${e.eventType}:${e.recordId}:${e.payloadHash}:${e.prevEventHash}`
    );
    if (e.eventHash.toLowerCase() !== expectedEventHash.toLowerCase()) {
      eventChainIntegrity = false;
      findings.push({
        recordId: e.id,
        studentRegNo: e.studentRegNo,
        studentName: 'SYSTEM',
        subject: 'EVENT_HASH',
        expectedHash: expectedEventHash,
        actualCalculatedHash: e.eventHash,
        tamperedFields: ['eventHash'],
        severity: 'CRITICAL',
        details: `Corrupted ledger event hash at event #${e.sequenceNumber}!`,
      });
    }

    runningPrevHash = e.eventHash;
  }

  // Determine overall status
  let overallStatus: SystemAuditReport['overallStatus'] = 'SECURE';
  if (databaseTamperDetected || !eventChainIntegrity) {
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
    eventChainIntegrity,
    independentCheckpointVerified,
    activeCheckpoint: independentCheckpoint || undefined,
    findings,
    auditedAt,
  };
}
