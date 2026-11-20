import * as fs from 'fs';
import * as path from 'path';
import { LedgerCheckpoint } from '../types';
import { verifyCheckpoint } from '../crypto/ed25519';

const VAULT_DIR = path.join(process.cwd(), '.verimark_vault');
const CHECKPOINTS_STORE_FILE = path.join(VAULT_DIR, 'independent_checkpoints.json');

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

function ensureVaultDir() {
  if (!fs.existsSync(VAULT_DIR)) {
    fs.mkdirSync(VAULT_DIR, { recursive: true });
  }
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
    ensureVaultDir();
    if (!fs.existsSync(CHECKPOINTS_STORE_FILE)) {
      return [];
    }
    try {
      const raw = fs.readFileSync(CHECKPOINTS_STORE_FILE, 'utf8');
      const checkpoints: LedgerCheckpoint[] = JSON.parse(raw);
      return checkpoints;
    } catch (err) {
      console.error('Error reading local checkpoint vault:', err);
      return [];
    }
  }

  async saveCheckpoint(checkpoint: LedgerCheckpoint): Promise<void> {
    ensureVaultDir();

    // Verify cryptographic signature before committing
    const verification = verifyCheckpoint(checkpoint);
    if (!verification.isValid) {
      throw new Error(`Rejected invalid checkpoint: ${verification.error}`);
    }

    const existing = await this.getCheckpoints();

    // Enforce monotonic continuous sequence number
    if (existing.length > 0) {
      const latest = existing[existing.length - 1];
      if (checkpoint.sequenceNumber <= latest.sequenceNumber) {
        throw new Error(
          `Rollback attack detected: new checkpoint seq #${checkpoint.sequenceNumber} <= current seq #${latest.sequenceNumber}`
        );
      }
      if (checkpoint.prevCheckpointHash.toLowerCase() !== latest.checkpointHash.toLowerCase()) {
        throw new Error(
          `Checkpoint chain discontinuity: prevCheckpointHash does not match latest checkpoint hash`
        );
      }
    }

    existing.push(checkpoint);
    const maxRetries = 10;
    for (let i = 0; i < maxRetries; i++) {
      try {
        fs.writeFileSync(CHECKPOINTS_STORE_FILE, JSON.stringify(existing, null, 2), { mode: 0o600 });
        break;
      } catch (err: any) {
        if (i === maxRetries - 1) throw err;
        const end = Date.now() + 25;
        while (Date.now() < end) {}
      }
    }
  }

  async getLatestCheckpoint(): Promise<LedgerCheckpoint | null> {
    const checkpoints = await this.getCheckpoints();
    if (checkpoints.length === 0) return null;
    return checkpoints[checkpoints.length - 1];
  }
}

// Global active store adapter instance
const activeAdapter: ICheckpointStoreAdapter = new LocalFileCheckpointAdapter();

export function getActiveCheckpointAdapter(): ICheckpointStoreAdapter {
  return activeAdapter;
}

export function resetIndependentStoreForTesting(): void {
  ensureVaultDir();
  if (fs.existsSync(CHECKPOINTS_STORE_FILE)) {
    fs.unlinkSync(CHECKPOINTS_STORE_FILE);
  }
}

export async function getIndependentCheckpoints(): Promise<LedgerCheckpoint[]> {
  return activeAdapter.getCheckpoints();
}

export async function commitIndependentCheckpoint(checkpoint: LedgerCheckpoint): Promise<void> {
  return activeAdapter.saveCheckpoint(checkpoint);
}

/**
 * Retrieves and cryptographically validates the latest checkpoint from the independent store.
 * Detects forgery, signature tampering, or chain corruptions upon retrieval.
 */
export async function getLatestIndependentCheckpoint(): Promise<LedgerCheckpoint | null> {
  const latest = await activeAdapter.getLatestCheckpoint();
  if (!latest) return null;

  const verification = verifyCheckpoint(latest);
  if (!verification.isValid) {
    throw new Error(`Independent checkpoint compromised: ${verification.error}`);
  }

  return latest;
}
