import { describe, it, expect } from 'vitest';
import {
  sha256,
  canonicalizeJson,
  createCanonicalResultPayload,
  computeResultRecordHash,
  hashLeaf,
  hashInternalNode,
} from '../lib/crypto/sha256';
import { MerkleTree, verifyMerkleProof } from '../lib/crypto/merkle';
import {
  generateEd25519KeyPair,
  signWithEd25519,
  verifyWithEd25519,
  createSignedCheckpoint,
  verifyCheckpoint,
} from '../lib/crypto/ed25519';

describe('Phase 2 Cryptographic Engine', () => {
  describe('1. SHA-256 and Canonical Serialization', () => {
    it('produces standard SHA-256 hash for known vector', () => {
      const hash = sha256('hello world');
      expect(hash).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
    });

    it('enforces deterministic canonical JSON serialization regardless of key order', () => {
      const objA = { z: 1, a: 'test', m: { b: 2, a: 1 } };
      const objB = { m: { a: 1, b: 2 }, a: 'test', z: 1 };
      expect(canonicalizeJson(objA)).toBe(canonicalizeJson(objB));
      expect(sha256(canonicalizeJson(objA))).toBe(sha256(canonicalizeJson(objB)));
    });

    it('generates identical record hashes for logically identical student results', () => {
      const res1 = computeResultRecordHash({
        studentRegNo: 'CF-2026-001',
        studentName: 'Alice Smith',
        course: 'B.Tech CSE',
        subject: 'Cryptography',
        examName: 'Midterm 2026',
        marksObtained: 95,
        maxMarks: 100,
        publicationDate: '2026-11-20T10:00:00.000Z',
      });

      const res2 = computeResultRecordHash({
        course: '  B.Tech CSE  ',
        publicationDate: '2026-11-20T10:00:00.000Z',
        studentRegNo: 'CF-2026-001',
        examName: 'Midterm 2026',
        subject: 'Cryptography',
        studentName: 'Alice Smith',
        maxMarks: '100',
        marksObtained: '95.00',
      });

      expect(res1.recordHash).toBe(res2.recordHash);
      expect(res1.canonicalJson).toBe(res2.canonicalJson);
    });

    it('generates completely different hashes when marks or details are modified', () => {
      const resOriginal = computeResultRecordHash({
        studentRegNo: 'CF-2026-001',
        studentName: 'Alice Smith',
        course: 'B.Tech CSE',
        subject: 'Cryptography',
        examName: 'Midterm 2026',
        marksObtained: 75,
        maxMarks: 100,
        publicationDate: '2026-11-20T10:00:00.000Z',
      });

      const resTampered = computeResultRecordHash({
        studentRegNo: 'CF-2026-001',
        studentName: 'Alice Smith',
        course: 'B.Tech CSE',
        subject: 'Cryptography',
        examName: 'Midterm 2026',
        marksObtained: 99, // Altered marks
        maxMarks: 100,
        publicationDate: '2026-11-20T10:00:00.000Z',
      });

      expect(resOriginal.recordHash).not.toBe(resTampered.recordHash);
    });

    it('enforces RFC 6962 domain separation between leaves (0x00) and internal nodes (0x01)', () => {
      const data = 'sample_data_hash';
      const leafH = hashLeaf(data);
      const internalH = hashInternalNode(data.padEnd(64, '0'), data.padEnd(64, '0'));
      expect(leafH).not.toBe(internalH);
    });
  });

  describe('2. Merkle Tree & Inclusion Proofs', () => {
    const records = [
      computeResultRecordHash({ studentRegNo: 'S01', studentName: 'Alice', course: 'CSE', subject: 'Math', examName: 'Mid', marksObtained: 85, publicationDate: '2026-11-20T00:00:00Z' }).recordHash,
      computeResultRecordHash({ studentRegNo: 'S02', studentName: 'Bob', course: 'CSE', subject: 'Math', examName: 'Mid', marksObtained: 90, publicationDate: '2026-11-20T00:00:00Z' }).recordHash,
      computeResultRecordHash({ studentRegNo: 'S03', studentName: 'Charlie', course: 'CSE', subject: 'Math', examName: 'Mid', marksObtained: 78, publicationDate: '2026-11-20T00:00:00Z' }).recordHash,
      computeResultRecordHash({ studentRegNo: 'S04', studentName: 'David', course: 'CSE', subject: 'Math', examName: 'Mid', marksObtained: 92, publicationDate: '2026-11-20T00:00:00Z' }).recordHash,
      computeResultRecordHash({ studentRegNo: 'S05', studentName: 'Eve', course: 'CSE', subject: 'Math', examName: 'Mid', marksObtained: 88, publicationDate: '2026-11-20T00:00:00Z' }).recordHash, // Odd leaf count = 5
    ];

    it('constructs tree with odd number of leaves correctly', () => {
      const tree = new MerkleTree(records);
      const root = tree.getRoot();
      expect(root).toBeDefined();
      expect(root.length).toBe(64);
      expect(tree.getLeafCount()).toBe(5);
    });

    it('generates valid Merkle inclusion proof for every single leaf', () => {
      const tree = new MerkleTree(records);
      const root = tree.getRoot();

      for (let i = 0; i < records.length; i++) {
        const proof = tree.getProof(i);
        const isValid = verifyMerkleProof(records[i], proof, root);
        expect(isValid).toBe(true);
      }
    });

    it('fails verification if leaf hash has been tampered', () => {
      const tree = new MerkleTree(records);
      const root = tree.getRoot();
      const proof = tree.getProof(1); // Proof for Bob

      const fakeLeafHash = sha256('tampered_record');
      const isValid = verifyMerkleProof(fakeLeafHash, proof, root);
      expect(isValid).toBe(false);
    });

    it('fails verification if any sibling hash in the proof is modified', () => {
      const tree = new MerkleTree(records);
      const root = tree.getRoot();
      const proof = tree.getProof(2);

      // Corrupt first step in proof
      const tamperedProof = proof.map((step, idx) => {
        if (idx === 0) {
          return { ...step, hash: sha256('corrupted_sibling') };
        }
        return step;
      });

      const isValid = verifyMerkleProof(records[2], tamperedProof, root);
      expect(isValid).toBe(false);
    });

    it('fails verification if expected root is wrong', () => {
      const tree = new MerkleTree(records);
      const proof = tree.getProof(0);
      const fakeRoot = sha256('fake_merkle_root');

      const isValid = verifyMerkleProof(records[0], proof, fakeRoot);
      expect(isValid).toBe(false);
    });
  });

  describe('3. Ed25519 Digital Signatures and Checkpoints', () => {
    it('generates valid 32-byte Ed25519 keypair and signs/verifies messages', () => {
      const { publicKeyHex, privateKeyHex } = generateEd25519KeyPair();
      expect(publicKeyHex.length).toBe(64);
      expect(privateKeyHex.length).toBe(64);

      const message = 'VeriMark Ledger Checkpoint Root #1';
      const signature = signWithEd25519(message, privateKeyHex);
      expect(signature.length).toBe(128); // 64 bytes in hex

      const isValid = verifyWithEd25519(message, publicKeyHex, signature);
      expect(isValid).toBe(true);
    });

    it('rejects tampered messages with valid signature', () => {
      const { publicKeyHex, privateKeyHex } = generateEd25519KeyPair();
      const signature = signWithEd25519('Original Message', privateKeyHex);

      const isValid = verifyWithEd25519('Tampered Message', publicKeyHex, signature);
      expect(isValid).toBe(false);
    });

    it('rejects signature verified with the wrong public key', () => {
      const keypair1 = generateEd25519KeyPair();
      const keypair2 = generateEd25519KeyPair();

      const signature = signWithEd25519('Valid Message', keypair1.privateKeyHex);
      const isValid = verifyWithEd25519('Valid Message', keypair2.publicKeyHex, signature);
      expect(isValid).toBe(false);
    });

    it('creates and verifies cryptographically signed ledger checkpoints', () => {
      const { publicKeyHex, privateKeyHex } = generateEd25519KeyPair();

      const tree = new MerkleTree(['hash1', 'hash2', 'hash3']);
      const merkleRoot = tree.getRoot();

      const checkpoint = createSignedCheckpoint(
        {
          sequenceNumber: 1,
          merkleRoot,
          eventCount: 3,
          leafCount: 3,
          prevCheckpointHash: '0000000000000000000000000000000000000000000000000000000000000000',
        },
        privateKeyHex,
        publicKeyHex
      );

      expect(checkpoint.signature).toBeDefined();
      expect(checkpoint.checkpointHash).toBeDefined();

      const verification = verifyCheckpoint(checkpoint);
      expect(verification.isValid).toBe(true);
    });

    it('detects if a checkpoint merkle root was altered after signing', () => {
      const { publicKeyHex, privateKeyHex } = generateEd25519KeyPair();

      const checkpoint = createSignedCheckpoint(
        {
          sequenceNumber: 1,
          merkleRoot: sha256('original_root'),
          eventCount: 1,
          leafCount: 1,
          prevCheckpointHash: '0000000000000000000000000000000000000000000000000000000000000000',
        },
        privateKeyHex,
        publicKeyHex
      );

      // Malicious actor modifies merkleRoot in database
      const tamperedCheckpoint = {
        ...checkpoint,
        merkleRoot: sha256('forged_root'),
      };

      const verification = verifyCheckpoint(tamperedCheckpoint);
      expect(verification.isValid).toBe(false);
    });
  });
});
