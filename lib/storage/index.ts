// ==============================================================================
// VERIMARK – Storage Engine Entrypoint & Adapter Factory (Phase 2)
// ==============================================================================

import { StorageAdapter, StorageHealthReport } from './adapter';
import { LocalVaultStorageAdapter } from './localVaultAdapter';
import { SupabaseStorageAdapter } from './supabaseAdapter';
import { isSupabaseConfigured } from './supabaseClient';

export * from './adapter';
export * from './localVaultAdapter';
export * from './supabaseAdapter';
export * from './supabaseClient';
export * from './db';
export * from './vaultConfig';
export * from './independentCheckpointStore';

let activeAdapter: StorageAdapter | null = null;

/**
 * Returns the currently active storage engine adapter based on configuration.
 * - In Production: Prefers Supabase/PostgreSQL when configured.
 * - In Development/Offline: Uses the Local Cryptographic Vault Adapter.
 */
export function getActiveStorageAdapter(): StorageAdapter {
  if (activeAdapter) {
    return activeAdapter;
  }

  const forceVault = process.env.STORAGE_ENGINE === 'vault';
  if (!forceVault && isSupabaseConfigured()) {
    activeAdapter = new SupabaseStorageAdapter();
  } else {
    activeAdapter = new LocalVaultStorageAdapter();
  }

  return activeAdapter;
}

/**
 * Resets the cached storage adapter instance (used in test suites).
 */
export function resetStorageAdapterForTesting(): void {
  activeAdapter = null;
}

/**
 * Performs a comprehensive storage health inspection.
 */
export async function inspectStorageHealth(): Promise<StorageHealthReport> {
  const adapter = getActiveStorageAdapter();
  return adapter.checkHealth();
}
