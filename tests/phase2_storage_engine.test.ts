import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { dbService } from '@/lib/storage/db';
import {
  LocalVaultStorageAdapter,
  SupabaseStorageAdapter,
  getActiveStorageAdapter,
  inspectStorageHealth,
} from '@/lib/storage';
import { computeResultRecordHash } from '@/lib/crypto/sha256';
import { verifyCheckpoint } from '@/lib/crypto/ed25519';
import { MerkleTree } from '@/lib/crypto/merkle';
import { GET as healthRoute } from '@/app/api/health/route';

describe('Phase 2: Production Database and Storage Engine Verification', () => {
  beforeEach(async () => {
    dbService.resetForTesting();
    await dbService.seedInitialData();
  });

  describe('1. Backup & Original Record Preservation', () => {
    it('verifies that Phase 2 data backup exists on disk', () => {
      const backupDir = path.join(process.cwd(), '.verimark_vault', 'backups', 'phase2_database_engine_backup');
      expect(fs.existsSync(backupDir)).toBe(true);

      const dbBackup = path.join(backupDir, 'database.json');
      const chkBackup = path.join(backupDir, 'independent_checkpoints.json');
      const keyBackup = path.join(backupDir, 'keystore.json');

      expect(fs.existsSync(dbBackup)).toBe(true);
      expect(fs.existsSync(chkBackup)).toBe(true);
      expect(fs.existsSync(keyBackup)).toBe(true);
    });

    it('preserves all five original student records with exact marks and details', async () => {
      const results = await dbService.getResults();
      expect(results.length).toBeGreaterThanOrEqual(5);

      const expectedStudents = [
        { regNo: 'CF2026-CSE-101', name: 'Aarav Sharma', marks: 88, maxMarks: 100, subject: 'Cryptography & Network Security' },
        { regNo: 'CF2026-CSE-102', name: 'Bhavna Reddy', marks: 94, maxMarks: 100, subject: 'Distributed Ledger Technologies' },
        { regNo: 'CF2026-CSE-103', name: 'Chetan Verma', marks: 76, maxMarks: 100, subject: 'Database Systems Architecture' },
        { regNo: 'CF2026-CSE-104', name: 'Divya Nair', marks: 91, maxMarks: 100, subject: 'Operating Systems & Security' },
        { regNo: 'CF2026-CSE-105', name: 'Eshan Roy', marks: 83, maxMarks: 100, subject: 'Algorithm Design & Analysis' },
      ];

      for (const exp of expectedStudents) {
        const found = results.find((r) => r.studentRegNo === exp.regNo);
        expect(found).toBeDefined();
        expect(found!.studentName).toBe(exp.name);
        expect(found!.marksObtained).toBe(exp.marks);
        expect(found!.maxMarks).toBe(exp.maxMarks);
        expect(found!.subject).toBe(exp.subject);
        expect(found!.status).toBe('published');
      }
    });

    it('verifies canonical SHA-256 record hashes match deterministic payload recomputation', async () => {
      const results = await dbService.getResults();
      const originalFive = results.filter((r) => r.studentRegNo.startsWith('CF2026-CSE-10'));

      for (const record of originalFive) {
        const { recordHash } = computeResultRecordHash({
          studentRegNo: record.studentRegNo,
          studentName: record.studentName,
          course: record.course,
          subject: record.subject,
          examName: record.examName,
          marksObtained: record.marksObtained,
          maxMarks: record.maxMarks,
          publicationDate: record.publicationDate,
        });

        expect(record.recordHash.toLowerCase()).toBe(recordHash.toLowerCase());
      }
    });
  });

  describe('2. Ledger Event Chain & Checkpoint Signature Verification', () => {
    it('verifies that the ledger event chain is contiguous and unbroken', async () => {
      const events = await dbService.getLedgerEvents();
      expect(events.length).toBeGreaterThanOrEqual(5);

      for (let i = 1; i < events.length; i++) {
        const prev = events[i - 1];
        const current = events[i];
        expect(current.prevEventHash).toBe(prev.eventHash);
        expect(current.sequenceNumber).toBe(prev.sequenceNumber + 1);
      }
    });

    it('verifies all signed checkpoints have valid Ed25519 signatures', async () => {
      const checkpoints = await dbService.getCheckpoints();
      expect(checkpoints.length).toBeGreaterThanOrEqual(5);

      for (const chk of checkpoints) {
        const check = verifyCheckpoint(chk);
        expect(check.isValid).toBe(true);
        expect(chk.signature).toBeDefined();
        expect(chk.signature.length).toBe(128); // 64-byte Ed25519 signature in hex
        expect(chk.signerPublicKey.length).toBe(64); // 32-byte Ed25519 public key in hex
      }
    });

    it('verifies Merkle root of published records matches the latest active checkpoint', async () => {
      const results = await dbService.getResults();
      const published = results.filter((r) => r.status === 'published' || r.status === 'corrected');
      published.sort((a, b) => `${a.studentRegNo}_${a.subject}`.localeCompare(`${b.studentRegNo}_${b.subject}`));

      const leafHashes = published.map((r) => r.recordHash);
      const tree = new MerkleTree(leafHashes);
      const computedRoot = tree.getRoot();

      const checkpoints = await dbService.getCheckpoints();
      const latestCheckpoint = checkpoints[checkpoints.length - 1];

      expect(computedRoot.toLowerCase()).toBe(latestCheckpoint.merkleRoot.toLowerCase());
    });
  });

  describe('3. Storage Adapter Architecture & Health Inspection', () => {
    it('instantiates LocalVaultStorageAdapter conforming to StorageAdapter interface', async () => {
      const adapter = new LocalVaultStorageAdapter();
      expect(adapter.name).toContain('Local');
      expect(adapter.engine).toBe('local_vault');
      expect(typeof adapter.getResults).toBe('function');
      expect(typeof adapter.checkHealth).toBe('function');

      const health = await adapter.checkHealth();
      expect(health.engine).toBe('local_vault');
      expect(health.tableCounts.results).toBeGreaterThanOrEqual(5);
      expect(health.tableCounts.checkpoints).toBeGreaterThanOrEqual(5);
    });

    it('instantiates SupabaseStorageAdapter conforming to StorageAdapter interface', () => {
      const adapter = new SupabaseStorageAdapter();
      expect(adapter.name).toContain('Supabase');
      expect(adapter.engine).toBe('supabase_postgres');
      expect(typeof adapter.getResults).toBe('function');
      expect(typeof adapter.checkHealth).toBe('function');
    });

    it('resolves active adapter through getActiveStorageAdapter factory', () => {
      const adapter = getActiveStorageAdapter();
      expect(adapter).toBeDefined();
      expect(['local_vault', 'supabase_postgres']).toContain(adapter.engine);
    });

    it('provides comprehensive health status via /api/health endpoint', async () => {
      const res = await healthRoute();
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.service).toContain('VeriMark');
      expect(json.version).toBe('2.0.0');
      expect(json.storage).toBeDefined();
      expect(json.storage.tableCounts.results).toBeGreaterThanOrEqual(5);
      expect(json.cryptography.status).toBe('OPERATIONAL');
      expect(json.cryptography.ledgerAuthorityKeyConfigured).toBe(true);
    });
  });

  describe('4. Safe Database Migrations Verification', () => {
    it('verifies that SQL schema migrations define all required multi-tenant tables', () => {
      const schemaPath = path.join(process.cwd(), 'supabase', 'schema.sql');
      const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '001_saas_schema.sql');

      expect(fs.existsSync(schemaPath)).toBe(true);
      expect(fs.existsSync(migrationPath)).toBe(true);

      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      const requiredTables = [
        'institutions',
        'users',
        'students',
        'examinations',
        'subjects',
        'results',
        'ledger_events',
        'ledger_checkpoints',
        'correction_requests',
        'audit_logs',
        'revoked_tokens',
      ];

      for (const table of requiredTables) {
        expect(schemaSql).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS (public\\.)?${table}`, 'i'));
      }

      // Verify foreign key integrity and RLS enablement
      expect(schemaSql).toMatch(/ALTER TABLE.*ENABLE ROW LEVEL SECURITY/i);
      expect(schemaSql).toMatch(/REFERENCES institutions\(id\)/i);
    });
  });

  describe('5. Anti-Empty-Database & Fail-Secure Protection', () => {
    it('guarantees that database initialization never serves empty records', async () => {
      const db = await dbService.getResults();
      expect(db.length).toBeGreaterThan(0);
      expect(db.some((r) => r.studentRegNo === 'CF2026-CSE-101')).toBe(true);
    });
  });
});
