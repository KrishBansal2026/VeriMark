import { NextResponse } from 'next/server';
import { dbService } from '@/lib/storage/db';
import { getServerKeys } from '@/lib/server/keys';
import { inspectStorageHealth } from '@/lib/storage';

export async function GET() {
  try {
    const keys = getServerKeys();
    const storageHealth = await inspectStorageHealth();
    const checkpoints = await dbService.getCheckpoints();
    const results = await dbService.getResults();

    const isHealthy = storageHealth.status === 'HEALTHY';

    return NextResponse.json(
      {
        status: isHealthy ? 'healthy' : storageHealth.status.toLowerCase(),
        service: 'VeriMark SaaS Academic Ledger Platform',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        storage: {
          engine: storageHealth.engine,
          isPersistent: storageHealth.isPersistent,
          status: storageHealth.status,
          latencyMs: storageHealth.latencyMs,
          tableCounts: storageHealth.tableCounts,
          warnings: storageHealth.warnings,
        },
        cryptography: {
          status: 'OPERATIONAL',
          specification: 'Ed25519 (RFC 8032) + SHA-256 (RFC 6962 Merkle Tree)',
          ledgerAuthorityKeyConfigured: Boolean(keys.ledgerAuthority.publicKey),
          approver1KeyConfigured: Boolean(keys.approver1.publicKey),
          approver2KeyConfigured: Boolean(keys.approver2.publicKey),
        },
      },
      { status: isHealthy ? 200 : 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        status: 'degraded',
        error: err.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
