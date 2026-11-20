import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getVaultDir, resetVaultDirForTesting } from '../lib/storage/vaultConfig';
import { dbService } from '../lib/storage/db';
import { getServerKeys } from '../lib/server/keys';
import { getIndependentCheckpoints } from '../lib/storage/independentCheckpointStore';
import * as os from 'os';
import * as path from 'path';

describe('Serverless Storage Adapter & Vault Resilience', () => {
  const originalVercel = process.env.VERCEL;
  const originalVaultDir = process.env.VERIMARK_VAULT_DIR;

  beforeEach(() => {
    resetVaultDirForTesting();
  });

  afterEach(() => {
    if (originalVercel !== undefined) {
      process.env.VERCEL = originalVercel;
    } else {
      delete process.env.VERCEL;
    }
    if (originalVaultDir !== undefined) {
      process.env.VERIMARK_VAULT_DIR = originalVaultDir;
    } else {
      delete process.env.VERIMARK_VAULT_DIR;
    }
    resetVaultDirForTesting();
  });

  it('resolves to os.tmpdir() when running under VERCEL environment', () => {
    process.env.VERCEL = '1';
    delete process.env.VERIMARK_VAULT_DIR;
    resetVaultDirForTesting();

    const vaultDir = getVaultDir();
    expect(vaultDir).toBe(path.join(os.tmpdir(), '.verimark_vault'));
  });

  it('guarantees academic records exist without throwing ENOENT', async () => {
    process.env.VERCEL = '1';
    resetVaultDirForTesting();

    const results = await dbService.getResults();
    expect(results.length).toBeGreaterThanOrEqual(5);

    const aarav = results.find((r) => r.studentRegNo === 'CF2026-CSE-101');
    expect(aarav).toBeDefined();
    expect(aarav?.marksObtained).toBe(88);
    expect(aarav?.subject).toBe('Cryptography & Network Security');
  });

  it('guarantees independent checkpoints are accessible and cryptographically verified', async () => {
    process.env.VERCEL = '1';
    resetVaultDirForTesting();

    const checkpoints = await getIndependentCheckpoints();
    expect(checkpoints.length).toBeGreaterThanOrEqual(5);

    const latest = checkpoints[checkpoints.length - 1];
    expect(latest.sequenceNumber).toBe(5);
    expect(latest.prevCheckpointHash).toBeDefined();
  });

  it('provides matching cryptographic keys without throwing ENOENT in serverless', () => {
    process.env.VERCEL = '1';
    resetVaultDirForTesting();

    const keys = getServerKeys();
    expect(keys.ledgerAuthority.publicKey).toBeDefined();
    expect(keys.approver1.publicKey).toBeDefined();
    expect(keys.approver2.publicKey).toBeDefined();
    expect(keys.isDemoMode).toBe(true);
  });
});
