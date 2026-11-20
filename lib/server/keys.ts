import { generateEd25519KeyPair } from '../crypto/ed25519';
import * as fs from 'fs';
import * as path from 'path';

export interface KeyRegistry {
  isDemoMode: boolean;
  ledgerAuthority: {
    name: string;
    publicKey: string;
    privateKey: string;
  };
  approver1: {
    name: string;
    role: 'EXAM_CONTROLLER';
    publicKey: string;
    privateKey: string;
  };
  approver2: {
    name: string;
    role: 'ACADEMIC_DEAN';
    publicKey: string;
    privateKey: string;
  };
}

const VAULT_DIR = path.join(process.cwd(), '.verimark_vault');
const KEYS_FILE = path.join(VAULT_DIR, 'keystore.json');

// In-memory key cache to prevent repeated filesystem access
let cachedKeys: KeyRegistry | null = null;

/**
 * Validates that an Ed25519 key string is a valid 64-character hex string.
 */
function isValidHexKey(key: string): boolean {
  if (!key || typeof key !== 'string') return false;
  const clean = key.trim().replace(/^0x/, '');
  return clean.length === 64 && /^[0-9a-fA-F]+$/.test(clean);
}

/**
 * Initializes and retrieves server-side cryptographic keypairs.
 * Phase 3 Remediation:
 * - Production strictly requires environment variables (fails securely if missing).
 * - Development/demo mode uses in-memory or protected local keystore.
 * - Private keys are NEVER exposed to client.
 */
export function getServerKeys(): KeyRegistry {
  if (cachedKeys) {
    return cachedKeys;
  }

  const isProduction = process.env.NODE_ENV === 'production';

  // 1. Production Mode: Environment Variables Mandatory
  const envLedgerPriv = process.env.LEDGER_SIGNING_PRIVATE_KEY;
  const envApp1Priv = process.env.APPROVER_1_PRIVATE_KEY;
  const envApp2Priv = process.env.APPROVER_2_PRIVATE_KEY;

  if (envLedgerPriv && envApp1Priv && envApp2Priv) {
    if (
      !isValidHexKey(envLedgerPriv) ||
      !isValidHexKey(envApp1Priv) ||
      !isValidHexKey(envApp2Priv)
    ) {
      throw new Error(
        'FATAL: Configured Ed25519 private keys must be valid 64-character hexadecimal strings (32 bytes).'
      );
    }

    cachedKeys = {
      isDemoMode: false,
      ledgerAuthority: {
        name: 'VeriMark Central Examination Authority (Production)',
        publicKey: process.env.NEXT_PUBLIC_LEDGER_PUBLIC_KEY || '',
        privateKey: envLedgerPriv,
      },
      approver1: {
        name: 'Dr. Robert Vance (Controller of Examinations)',
        role: 'EXAM_CONTROLLER',
        publicKey: process.env.NEXT_PUBLIC_APPROVER_1_PUBLIC_KEY || '',
        privateKey: envApp1Priv,
      },
      approver2: {
        name: 'Prof. Margaret Hamilton (Dean of Academic Affairs)',
        role: 'ACADEMIC_DEAN',
        publicKey: process.env.NEXT_PUBLIC_APPROVER_2_PUBLIC_KEY || '',
        privateKey: envApp2Priv,
      },
    };
    return cachedKeys;
  }

  // If in production without configured keys, FAIL SECURELY
  if (isProduction) {
    throw new Error(
      'FATAL SECURITY VIOLATION: Production environment requires LEDGER_SIGNING_PRIVATE_KEY, APPROVER_1_PRIVATE_KEY, and APPROVER_2_PRIVATE_KEY. Automatic unencrypted keystore generation is strictly disabled in production.'
    );
  }

  // 2. Development / Demo / Hackathon Fallback Mode
  if (!fs.existsSync(VAULT_DIR)) {
    fs.mkdirSync(VAULT_DIR, { recursive: true });
  }

  if (fs.existsSync(KEYS_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
      cachedKeys = { ...data, isDemoMode: true };
      return cachedKeys!;
    } catch (err) {
      // Regenerate if corrupted
    }
  }

  // Generate fresh keys for local evaluation
  const ledgerKey = generateEd25519KeyPair();
  const app1Key = generateEd25519KeyPair();
  const app2Key = generateEd25519KeyPair();

  const registry: KeyRegistry = {
    isDemoMode: true,
    ledgerAuthority: {
      name: 'VeriMark Central Examination Ledger Authority (Demo)',
      publicKey: ledgerKey.publicKeyHex,
      privateKey: ledgerKey.privateKeyHex,
    },
    approver1: {
      name: 'Dr. Robert Vance (Controller of Examinations)',
      role: 'EXAM_CONTROLLER',
      publicKey: app1Key.publicKeyHex,
      privateKey: app1Key.privateKeyHex,
    },
    approver2: {
      name: 'Prof. Margaret Hamilton (Dean of Academic Affairs)',
      role: 'ACADEMIC_DEAN',
      publicKey: app2Key.publicKeyHex,
      privateKey: app2Key.privateKeyHex,
    },
  };

  fs.writeFileSync(KEYS_FILE, JSON.stringify(registry, null, 2), { mode: 0o600 });
  cachedKeys = registry;
  return registry;
}

/**
 * Reset keys cache for automated testing.
 */
export function resetCachedKeysForTesting(): void {
  cachedKeys = null;
}

/**
 * Returns public keys safe for frontend verification display.
 * Private keys are filtered out.
 */
export function getPublicKeys() {
  const keys = getServerKeys();
  return {
    isDemoMode: keys.isDemoMode,
    ledgerAuthority: {
      name: keys.ledgerAuthority.name,
      publicKey: keys.ledgerAuthority.publicKey,
    },
    approver1: {
      name: keys.approver1.name,
      role: keys.approver1.role,
      publicKey: keys.approver1.publicKey,
    },
    approver2: {
      name: keys.approver2.name,
      role: keys.approver2.role,
      publicKey: keys.approver2.publicKey,
    },
  };
}
