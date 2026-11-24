// ==============================================================================
// VERIMARK – Production Storage & Supabase Connectivity Verification Script
// ==============================================================================

import { getActiveStorageAdapter, inspectStorageHealth } from '../lib/storage';
import { isSupabaseConfigured, getSupabaseAdmin } from '../lib/storage/supabaseClient';
import { SupabaseStorageAdapter } from '../lib/storage/supabaseAdapter';
import { computeResultRecordHash } from '../lib/crypto/sha256';
import { verifyCheckpoint } from '../lib/crypto/ed25519';

async function main() {
  console.log('==============================================================================');
  console.log('VERIMARK — STORAGE ADAPTER & PRODUCTION DATABASE CONNECTIVITY VERIFICATION');
  console.log('==============================================================================\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('1. ENVIRONMENT CONFIGURATION CHECK:');
  console.log(`- NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? supabaseUrl : 'NOT CONFIGURED (Empty/Missing)'}`);
  console.log(`- SUPABASE_SERVICE_ROLE_KEY: ${serviceKey ? `CONFIGURED (${serviceKey.substring(0, 10)}... len: ${serviceKey.length})` : 'NOT CONFIGURED (Empty/Missing)'}`);
  console.log(`- isSupabaseConfigured(): ${isSupabaseConfigured()}\n`);

  console.log('2. ACTIVE STORAGE ADAPTER INSPECTION:');
  const activeAdapter = getActiveStorageAdapter();
  console.log(`- Active Adapter Class: ${activeAdapter.constructor.name}`);
  console.log(`- Adapter Name: ${activeAdapter.name}`);
  console.log(`- Engine: ${activeAdapter.engine}`);
  console.log(`- Persistent Storage: ${activeAdapter.isPersistent}\n`);

  console.log('3. ADAPTER HEALTH REPORT:');
  const health = await inspectStorageHealth();
  console.log(JSON.stringify(health, null, 2));
  console.log('');

  if (isSupabaseConfigured()) {
    console.log('4. DIRECT SUPABASE POSTGRESQL CONNECTIVITY & RECORD AUDIT:');
    try {
      const client = getSupabaseAdmin()!;
      const supabaseAdapter = new SupabaseStorageAdapter();

      // Check table connectivity
      console.log('Checking database tables in Supabase...');
      const [insts, students, results, events, checkpoints] = await Promise.all([
        supabaseAdapter.getInstitutions(),
        supabaseAdapter.getStudents(),
        supabaseAdapter.getResults(),
        supabaseAdapter.getLedgerEvents(),
        supabaseAdapter.getCheckpoints(),
      ]);

      console.log(`- Institutions found: ${insts.length}`);
      console.log(`- Students found: ${students.length}`);
      console.log(`- Results found: ${results.length}`);
      console.log(`- Ledger Events found: ${events.length}`);
      console.log(`- Checkpoints found: ${checkpoints.length}`);

      const expectedRegNos = [
        'CF2026-CSE-101',
        'CF2026-CSE-102',
        'CF2026-CSE-103',
        'CF2026-CSE-104',
        'CF2026-CSE-105',
      ];

      const allStudentsPresent = expectedRegNos.every((reg) =>
        students.some((s) => s.regNo === reg)
      );
      const allResultsPresent = expectedRegNos.every((reg) =>
        results.some((r) => r.studentRegNo === reg)
      );

      console.log(`- All 5 Original Students Present in Supabase: ${allStudentsPresent}`);
      console.log(`- All 5 Original Results Present in Supabase: ${allResultsPresent}`);
      console.log(`- At least 5 Ledger Events Present in Supabase: ${events.length >= 5}`);
      console.log(`- At least 5 Checkpoints Present in Supabase: ${checkpoints.length >= 5}`);
    } catch (err: any) {
      console.error('SUPABASE CONNECTION OR QUERY ERROR:', err.message);
    }
  } else {
    console.log('4. PRODUCTION STORAGE NOTICE:');
    console.log('NOTICE: External Supabase PostgreSQL credentials are not set in the local environment.');
    console.log('Verifying records through active Local Vault Adapter to confirm 100% data accessibility...\n');

    const students = await activeAdapter.getStudents();
    const results = await activeAdapter.getResults();
    const events = await activeAdapter.getLedgerEvents();
    const checkpoints = await activeAdapter.getCheckpoints();

    console.log(`- Students accessible: ${students.length}`);
    console.log(`- Results accessible: ${results.length}`);
    console.log(`- Ledger Events accessible: ${events.length}`);
    console.log(`- Checkpoints accessible: ${checkpoints.length}\n`);

    const expected = [
      { regNo: 'CF2026-CSE-101', name: 'Aarav Sharma', marks: 88 },
      { regNo: 'CF2026-CSE-102', name: 'Bhavna Reddy', marks: 94 },
      { regNo: 'CF2026-CSE-103', name: 'Chetan Verma', marks: 76 },
      { regNo: 'CF2026-CSE-104', name: 'Divya Nair', marks: 91 },
      { regNo: 'CF2026-CSE-105', name: 'Eshan Roy', marks: 83 },
    ];

    let allOk = true;
    for (const exp of expected) {
      const r = results.find((x) => x.studentRegNo === exp.regNo);
      if (!r) {
        console.error(`MISSING: ${exp.regNo}`);
        allOk = false;
        continue;
      }
      const { recordHash } = computeResultRecordHash({
        studentRegNo: r.studentRegNo,
        studentName: r.studentName,
        course: r.course,
        subject: r.subject,
        examName: r.examName,
        marksObtained: r.marksObtained,
        maxMarks: r.maxMarks,
        publicationDate: r.publicationDate,
      });
      const hashOk = recordHash.toLowerCase() === r.recordHash.toLowerCase();
      const marksOk = Number(r.marksObtained) === exp.marks;
      console.log(`- ${r.studentRegNo} (${r.studentName}): Marks=${r.marksObtained} (Expected ${exp.marks}: ${marksOk ? 'OK' : 'MISMATCH'}), Hash=${r.recordHash.substring(0, 16)}... (Hash: ${hashOk ? 'VALID' : 'INVALID'})`);
      if (!hashOk || !marksOk) allOk = false;
    }

    console.log(`\nAll 5 Academic Results Verified: ${allOk}`);

    let checkpointsOk = true;
    for (const chk of checkpoints) {
      const v = verifyCheckpoint(chk);
      console.log(`- Checkpoint #${chk.sequenceNumber} (${chk.id}): Valid=${v.isValid}, Root=${chk.merkleRoot.substring(0, 16)}...`);
      if (!v.isValid) checkpointsOk = false;
    }
    console.log(`All 5 Checkpoint Signatures Verified: ${checkpointsOk}`);
  }

  console.log('\n==============================================================================');
  console.log('STORAGE VERIFICATION COMPLETE');
  console.log('==============================================================================');
}

main().catch(console.error);
