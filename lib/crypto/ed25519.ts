import {
  generateKeyPairSync,
  createPrivateKey,
  createPublicKey,
  sign,
  verify,
  randomBytes,
} from 'crypto';
import { sha256, canonicalizeJson } from './sha256';
import { LedgerCheckpoint } from '../types';

// ASN.1 DER constants for RFC 8410 / Ed25519
const SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
const PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');

/**
 * Converts a 32-byte (64-char hex) raw public key to SPKI DER Buffer.
 */
function rawPublicKeyToDer(publicKeyHex: string): Buffer {
  const cleanHex = publicKeyHex.trim().replace(/^0x/, '');
  if (cleanHex.length !== 64) {
    throw new Error(`Invalid Ed25519 public key length: expected 64 hex characters, got ${cleanHex.length}`);
  }
  const rawBuf = Buffer.from(cleanHex, 'hex');
  return Buffer.concat([SPKI_PREFIX, rawBuf]);
}

/**
 * Converts a 32-byte (64-char hex) raw private seed to PKCS#8 DER Buffer.
 */
function rawPrivateKeyToDer(privateKeyHex: string): Buffer {
  const cleanHex = privateKeyHex.trim().replace(/^0x/, '');
  if (cleanHex.length !== 64) {
    throw new Error(`Invalid Ed25519 private key length: expected 64 hex characters, got ${cleanHex.length}`);
  }
  const rawBuf = Buffer.from(cleanHex, 'hex');
  return Buffer.concat([PKCS8_PREFIX, rawBuf]);
}

/**
 * Generates a fresh Ed25519 keypair in raw 32-byte hex format.
 */
export function generateEd25519KeyPair(): {
  publicKeyHex: string;
  privateKeyHex: string;
} {
  const rawSeed = randomBytes(32);
  const privDer = Buffer.concat([PKCS8_PREFIX, rawSeed]);
  const privKey = createPrivateKey({ key: privDer, format: 'der', type: 'pkcs8' });
  const pubKey = createPublicKey(privKey);
  const pubDer = pubKey.export({ type: 'spki', format: 'der' });
  const rawPub = pubDer.subarray(12);

  return {
    publicKeyHex: rawPub.toString('hex'),
    privateKeyHex: rawSeed.toString('hex'),
  };
}

/**
 * Signs data using an Ed25519 private key.
 * Returns 64-byte signature as a 128-character hex string.
 */
export function signWithEd25519(
  data: string | Buffer,
  privateKeyHex: string
): string {
  const privDer = rawPrivateKeyToDer(privateKeyHex);
  const privateKey = createPrivateKey({ key: privDer, format: 'der', type: 'pkcs8' });
  const dataBuf = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
  const signature = sign(null, dataBuf, privateKey);
  return signature.toString('hex');
}

/**
 * Verifies an Ed25519 digital signature against data and public key.
 */
export function verifyWithEd25519(
  data: string | Buffer,
  publicKeyHex: string,
  signatureHex: string
): boolean {
  try {
    const pubDer = rawPublicKeyToDer(publicKeyHex);
    const publicKey = createPublicKey({ key: pubDer, format: 'der', type: 'spki' });
    const dataBuf = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
    const sigBuf = Buffer.from(signatureHex.trim().replace(/^0x/, ''), 'hex');

    if (sigBuf.length !== 64) {
      return false;
    }

    return verify(null, dataBuf, publicKey, sigBuf);
  } catch (err) {
    return false;
  }
}

/**
 * Computes deterministic canonical hash of a checkpoint.
 */
export function computeCheckpointHash(data: {
  sequenceNumber: number;
  merkleRoot: string;
  eventCount: number;
  leafCount: number;
  prevCheckpointHash: string;
  committedAt: string;
}): string {
  const canonicalString = canonicalizeJson({
    committed_at: new Date(data.committedAt).toISOString(),
    event_count: Number(data.eventCount),
    leaf_count: Number(data.leafCount),
    merkle_root: data.merkleRoot.toLowerCase(),
    prev_checkpoint_hash: data.prevCheckpointHash.toLowerCase(),
    sequence_number: Number(data.sequenceNumber),
  });
  return sha256(canonicalString);
}

/**
 * Creates and cryptographically signs a ledger checkpoint.
 */
export function createSignedCheckpoint(
  params: {
    sequenceNumber: number;
    merkleRoot: string;
    eventCount: number;
    leafCount: number;
    prevCheckpointHash: string;
    committedAt?: string;
  },
  signerPrivateKeyHex: string,
  signerPublicKeyHex: string
): LedgerCheckpoint {
  const committedAt = params.committedAt || new Date().toISOString();
  const checkpointHash = computeCheckpointHash({
    ...params,
    committedAt,
  });

  const signature = signWithEd25519(checkpointHash, signerPrivateKeyHex);

  return {
    id: `chk_${params.sequenceNumber}_${checkpointHash.substring(0, 12)}`,
    sequenceNumber: params.sequenceNumber,
    merkleRoot: params.merkleRoot,
    eventCount: params.eventCount,
    leafCount: params.leafCount,
    prevCheckpointHash: params.prevCheckpointHash,
    checkpointHash,
    signature,
    signerPublicKey: signerPublicKeyHex,
    committedAt,
  };
}

/**
 * Validates a signed checkpoint's hash and Ed25519 signature.
 */
export function verifyCheckpoint(checkpoint: LedgerCheckpoint): {
  isValid: boolean;
  error?: string;
} {
  const expectedHash = computeCheckpointHash({
    sequenceNumber: checkpoint.sequenceNumber,
    merkleRoot: checkpoint.merkleRoot,
    eventCount: checkpoint.eventCount,
    leafCount: checkpoint.leafCount,
    prevCheckpointHash: checkpoint.prevCheckpointHash,
    committedAt: checkpoint.committedAt,
  });

  if (expectedHash.toLowerCase() !== checkpoint.checkpointHash.toLowerCase()) {
    return {
      isValid: false,
      error: `Checkpoint hash mismatch. Expected ${expectedHash}, got ${checkpoint.checkpointHash}`,
    };
  }

  const isSigValid = verifyWithEd25519(
    checkpoint.checkpointHash,
    checkpoint.signerPublicKey,
    checkpoint.signature
  );

  if (!isSigValid) {
    return {
      isValid: false,
      error: `Invalid Ed25519 signature on checkpoint ${checkpoint.sequenceNumber}`,
    };
  }

  return { isValid: true };
}
