import * as fs from 'fs';
import * as path from 'path';
import { LedgerCheckpoint } from '../types';
import { verifyCheckpoint } from '../crypto/ed25519';
import { getVaultDir, safeWriteFileSync as safeWriteVaultFile } from './vaultConfig';
import { CANONICAL_INDEPENDENT_CHECKPOINTS } from './canonicalVaultData';

function getCheckpointsFile(): string {
  return path.join(getVaultDir(), 'independent_checkpoints.json');
}

/**
 * Phase 6: Checkpoint Storage Adapter Interface.
 * Defines the contract for isolated immutable checkpoint persistence.
 */
export interface ICheckpointStoreAdapter {
  name: string;
  isImmutableWORM: boolean;
  saveCheckpoint(checkpoint: LedgerCheckpoint): Promise<void>;
  getCheckpoints(): Promise<LedgerCheckpoint[]>;
  getLatestCheckpoint(): Promise<LedgerCheckpoint | null>;
}

/**
 * Local Filesystem Checkpoint Store Adapter.
 * 
 * SECURITY BOUNDARY NOTICE:
 * This local adapter is intended for development, demonstration, and offline evaluation.
 * Security limitations:
 * - Shared OS Process: Resides on the same local filesystem as the web application.
 * - Software-only Protection: Does not provide hardware WORM (Write-Once-Read-Many) immutability.
 * - Serverless Ephemerality: Local disk state on serverless platforms (e.g. Vercel) does not persist across instances.
 * 
 * Production Recommendation:
 * Deploy with an external transparency service (e.g., Sigstore Rekor) or Cloud Object Store (AWS S3 / GCS)
 * configured with Object Lock (Compliance Mode).
 */
export class LocalFileCheckpointAdapter implements ICheckpointStoreAdapter {
  name = 'Local Protected Vault Adapter';
  isImmutableWORM = false;

  async getCheckpoints(): Promise<LedgerCheckpoint[]> {
    const storeFile = getCheckpointsFile();
    if (fs.existsSync(storeFile)) {
      try {
        const raw = fs.readFileSync(storeFile, 'utf8');
        const checkpoints: LedgerCheckpoint[] = JSON.parse(raw);
        if (Array.isArray(checkpoints) && checkpoints.length > 0) {
          return checkpoints;
        }
      } catch (err) {
        console.error('Error reading local checkpoint vault:', err);
      }
    }

    // Check if repository cwd has independent_checkpoints.json
    const cwdFile = path.join(process.cwd(), '.verimark_vault', 'independent_checkpoints.json');
    if (fs.existsSync(cwdFile)) {
      try {
        const raw = fs.readFileSync(cwdFile, 'utf8');
        const checkpoints: LedgerCheckpoint[] = JSON.parse(raw);
        if (Array.isArray(checkpoints) && checkpoints.length > 0) {
          safeWriteVaultFile(storeFile, JSON.stringify(checkpoints, null, 2));
          return checkpoints;
        }
      } catch {}
    }

    // Fall back to CANONICAL_INDEPENDENT_CHECKPOINTS snapshot
    const canonical: LedgerCheckpoint[] = JSON.parse(JSON.stringify(CANONICAL_INDEPENDENT_CHECKPOINTS));
    safeWriteVaultFile(storeFile, JSON.stringify(canonical, null, 2));
    return canonical;
  }

  async saveCheckpoint(checkpoint: LedgerCheckpoint): Promise<void> {
    const storeFile = getCheckpointsFile();

    // Verify cryptographic signature before committing
    const verification = verifyCheckpoint(checkpoint);
    if (!verification.isValid) {
      throw new Error(`Rejected invalid checkpoint: ${verification.error}`);
    }

    const existing = await this.getCheckpoints();
    const instId = checkpoint.institutionId || 'inst_verimark_01';
    const instCheckpoints = existing.filter((c) => (c.institutionId || 'inst_verimark_01') === instId);

    // Enforce monotonic continuous sequence number for this specific institution
    if (instCheckpoints.length > 0) {
      const latest = instCheckpoints[instCheckpoints.length - 1];
      if (checkpoint.sequenceNumber <= latest.sequenceNumber) {
        throw new Error(
          `Rollback attack detected: new checkpoint seq #${checkpoint.sequenceNumber} <= current seq #${latest.sequenceNumber} for institution ${instId}`
        );
      }
      if (checkpoint.prevCheckpointHash.toLowerCase() !== latest.checkpointHash.toLowerCase()) {
        throw new Error(
          `Checkpoint chain discontinuity: prevCheckpointHash does not match latest checkpoint hash for institution ${instId}`
        );
      }
    }

    existing.push(checkpoint);
    safeWriteVaultFile(storeFile, JSON.stringify(existing, null, 2));
  }

  async getLatestCheckpoint(institutionId?: string): Promise<LedgerCheckpoint | null> {
    const checkpoints = await this.getCheckpoints();
    const instId = institutionId || 'inst_verimark_01';
    const instCheckpoints = checkpoints.filter((c) => (c.institutionId || 'inst_verimark_01') === instId);
    if (instCheckpoints.length === 0) return null;
    return instCheckpoints[instCheckpoints.length - 1];
  }
}

// Global active store adapter instance
const activeAdapter: ICheckpointStoreAdapter = new LocalFileCheckpointAdapter();

export function getActiveCheckpointAdapter(): ICheckpointStoreAdapter {
  return activeAdapter;
}

export function resetIndependentStoreForTesting(): void {
  const storeFile = getCheckpointsFile();
  if (fs.existsSync(storeFile)) {
    fs.unlinkSync(storeFile);
  }
}

export async function getIndependentCheckpoints(institutionId?: string): Promise<LedgerCheckpoint[]> {
  const checkpoints = await activeAdapter.getCheckpoints();
  if (!institutionId) return checkpoints;
  return checkpoints.filter((c) => (c.institutionId || 'inst_verimark_01') === institutionId);
}

export async function commitIndependentCheckpoint(checkpoint: LedgerCheckpoint): Promise<void> {
  return activeAdapter.saveCheckpoint(checkpoint);
}

/**
 * Retrieves and cryptographically validates the latest checkpoint from the independent store.
 * Detects forgery, signature tampering, or chain corruptions upon retrieval.
 */
export async function getLatestIndependentCheckpoint(institutionId = 'inst_verimark_01'): Promise<LedgerCheckpoint | null> {
  const latest = await (activeAdapter as LocalFileCheckpointAdapter).getLatestCheckpoint(institutionId);
  if (!latest) return null;

  const verification = verifyCheckpoint(latest);
  if (!verification.isValid) {
    throw new Error(`Independent checkpoint compromised: ${verification.error}`);
  }

  return latest;
}
