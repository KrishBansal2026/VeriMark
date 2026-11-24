import { NextResponse } from 'next/server';
import { dbService } from '@/lib/storage/db';
import { getServerKeys } from '@/lib/server/keys';
import { isSupabaseConfigured } from '@/lib/storage/supabaseClient';

export async function GET() {
  try {
    const keys = getServerKeys();
    const checkpoints = await dbService.getCheckpoints();
    const results = await dbService.getResults();

    return NextResponse.json({
      status: 'healthy',
      service: 'VeriMark SaaS Ledger Platform',
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      storage: {
        backend: isSupabaseConfigured() ? 'Supabase PostgreSQL' : 'Protected Vault Storage',
        isCloudPersistent: isSupabaseConfigured(),
        totalResults: results.length,
        totalCheckpoints: checkpoints.length,
      },
      cryptography: {
        status: 'OPERATIONAL',
        algorithm: 'Ed25519 + SHA-256 (RFC 6962 Merkle Tree)',
        ledgerAuthorityKeyConfigured: Boolean(keys.ledgerAuthority.publicKey),
        approver1KeyConfigured: Boolean(keys.approver1.publicKey),
        approver2KeyConfigured: Boolean(keys.approver2.publicKey),
      },
    });
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
