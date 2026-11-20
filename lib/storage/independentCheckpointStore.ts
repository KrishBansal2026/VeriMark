import * as fs from 'fs';
import * as path from 'path';
import { LedgerCheckpoint } from '../types';
import { verifyCheckpoint } from '../crypto/ed25519';

const VAULT_DIR = path.join(process.cwd(), '.verimark_vault');
const CHECKPOINTS_STORE_FILE = path.join(VAULT_DIR, 'independent_checkpoints.json');

function ensureVaultDir() {
  if (!fs.existsSync(VAULT_DIR)) {
    fs.mkdirSync(VAULT_DIR, { recursive: true });
  }
}

export function resetIndependentStoreForTesting(): void {
  ensureVaultDir();
  if (fs.existsSync(CHECKPOINTS_STORE_FILE)) {
    fs.unlinkSync(CHECKPOINTS_STORE_FILE);
  }
}

export async function getIndependentCheckpoints(): Promise<LedgerCheckpoint[]> {
  ensureVaultDir();
  if (!fs.existsSync(CHECKPOINTS_STORE_FILE)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(CHECKPOINTS_STORE_FILE, 'utf8');
    const checkpoints: LedgerCheckpoint[] = JSON.parse(raw);
    return checkpoints;
  } catch (err) {
    console.error('Error reading independent checkpoint store:', err);
    return [];
  }
}

export async function commitIndependentCheckpoint(checkpoint: LedgerCheckpoint): Promise<void> {
  ensureVaultDir();

  // Cryptographically verify signature before writing to independent store
  const verification = verifyCheckpoint(checkpoint);
  if (!verification.isValid) {
    throw new Error(`Rejected invalid checkpoint: ${verification.error}`);
  }

  const existing = await getIndependentCheckpoints();

  // Check monotonic sequence number
  if (existing.length > 0) {
    const latest = existing[existing.length - 1];
    if (checkpoint.sequenceNumber <= latest.sequenceNumber) {
      throw new Error(
        `Rollback or fork attack detected: new seq ${checkpoint.sequenceNumber} <= current seq ${latest.sequenceNumber}`
      );
    }
    if (checkpoint.prevCheckpointHash.toLowerCase() !== latest.checkpointHash.toLowerCase()) {
      throw new Error(
        `Checkpoint chain broken: prevCheckpointHash does not match latest checkpoint hash`
      );
    }
  }

  existing.push(checkpoint);
  fs.writeFileSync(CHECKPOINTS_STORE_FILE, JSON.stringify(existing, null, 2), { mode: 0o600 });
}

export async function getLatestIndependentCheckpoint(): Promise<LedgerCheckpoint | null> {
  const checkpoints = await getIndependentCheckpoints();
  if (checkpoints.length === 0) {
    return null;
  }
  const latest = checkpoints[checkpoints.length - 1];
  const verification = verifyCheckpoint(latest);
  if (!verification.isValid) {
    throw new Error(`Independent checkpoint store compromised: ${verification.error}`);
  }
  return latest;
}
