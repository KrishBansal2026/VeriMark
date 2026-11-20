import { generateEd25519KeyPair } from '../crypto/ed25519';
import * as fs from 'fs';
import * as path from 'path';

export interface KeyRegistry {
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

/**
 * Initializes and retrieves server-side cryptographic keypairs.
 * Keys are loaded from environment variables if present, or securely persisted
 * in the server-only vault. Keys are NEVER exported to the client.
 */
export function getServerKeys(): KeyRegistry {
  // 1. Check environment variables
  if (
    process.env.LEDGER_SIGNING_PRIVATE_KEY &&
    process.env.APPROVER_1_PRIVATE_KEY &&
    process.env.APPROVER_2_PRIVATE_KEY
  ) {
    return {
      ledgerAuthority: {
        name: 'VeriMark Ledger Authority',
        publicKey: process.env.NEXT_PUBLIC_LEDGER_PUBLIC_KEY || '',
        privateKey: process.env.LEDGER_SIGNING_PRIVATE_KEY,
      },
      approver1: {
        name: 'Dr. Robert Vance',
        role: 'EXAM_CONTROLLER',
        publicKey: process.env.NEXT_PUBLIC_APPROVER_1_PUBLIC_KEY || '',
        privateKey: process.env.APPROVER_1_PRIVATE_KEY,
      },
      approver2: {
        name: 'Prof. Margaret Hamilton',
        role: 'ACADEMIC_DEAN',
        publicKey: process.env.NEXT_PUBLIC_APPROVER_2_PUBLIC_KEY || '',
        privateKey: process.env.APPROVER_2_PRIVATE_KEY,
      },
    };
  }

  // 2. Vault-stored keys for local/development/hackathon deployment
  if (!fs.existsSync(VAULT_DIR)) {
    fs.mkdirSync(VAULT_DIR, { recursive: true });
  }

  if (fs.existsSync(KEYS_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
      return data;
    } catch (err) {
      // Regenerate if corrupted
    }
  }

  // Generate fresh keys
  const ledgerKey = generateEd25519KeyPair();
  const app1Key = generateEd25519KeyPair();
  const app2Key = generateEd25519KeyPair();

  const registry: KeyRegistry = {
    ledgerAuthority: {
      name: 'VeriMark Central Examination Ledger Authority',
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
  return registry;
}

/**
 * Returns public keys safe for frontend verification display.
 */
export function getPublicKeys() {
  const keys = getServerKeys();
  return {
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
