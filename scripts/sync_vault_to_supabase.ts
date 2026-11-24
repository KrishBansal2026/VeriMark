// ==============================================================================
// VERIMARK – Sync Vault Records to Supabase PostgreSQL Database Script
// ==============================================================================

import { getSupabaseAdmin, isSupabaseConfigured } from '../lib/storage/supabaseClient';
import { ensureDbFile } from '../lib/storage/db';

async function main() {
  console.log('==============================================================================');
  console.log('VERIMARK — SYNC CANONICAL VAULT RECORDS TO SUPABASE POSTGRESQL');
  console.log('==============================================================================\n');

  if (!isSupabaseConfigured()) {
    console.error('ERROR: Supabase is not configured.');
    console.error('Please configure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment to run sync.');
    process.exit(1);
  }

  const client = getSupabaseAdmin()!;
  const localDb = ensureDbFile();

  console.log('1. SYNCING INSTITUTION:');
  for (const inst of localDb.institutions) {
    const { error } = await client.from('institutions').upsert({
      id: inst.id,
      code: inst.code,
      name: inst.name,
      domain: inst.domain,
      logo_url: inst.logoUrl,
      theme_color: inst.themeColor,
      status: inst.status,
      created_at: inst.createdAt,
      updated_at: inst.updatedAt,
    });
    if (error) console.error(`Error syncing institution ${inst.id}:`, error.message);
    else console.log(`- Synced institution: ${inst.name} (${inst.code})`);
  }

  console.log('\n2. SYNCING EXAMINATIONS & SUBJECTS:');
  for (const exam of localDb.examinations) {
    const { error } = await client.from('examinations').upsert({
      id: exam.id,
      institution_id: exam.institutionId || 'inst_verimark_01',
      exam_code: exam.examCode,
      exam_name: exam.examName,
      semester: exam.semester,
      academic_year: exam.academicYear,
      department: exam.department,
      status: exam.status,
      conducted_date: exam.conductedDate,
      created_at: exam.createdAt,
    });
    if (error) console.error(`Error syncing exam ${exam.examCode}:`, error.message);
    else console.log(`- Synced exam: ${exam.examName}`);
  }

  for (const subj of localDb.subjects) {
    const { error } = await client.from('subjects').upsert({
      id: subj.id,
      institution_id: subj.institutionId || 'inst_verimark_01',
      subject_code: subj.subjectCode,
      subject_name: subj.subjectName,
      department: subj.department,
      credits: subj.credits,
      max_marks: subj.maxMarks,
      passing_marks: subj.passingMarks,
      created_at: subj.createdAt,
    });
    if (error) console.error(`Error syncing subject ${subj.subjectCode}:`, error.message);
    else console.log(`- Synced subject: ${subj.subjectName} (${subj.subjectCode})`);
  }

  console.log('\n3. SYNCING STUDENTS:');
  for (const stud of localDb.students) {
    const { error } = await client.from('students').upsert({
      id: stud.id,
      institution_id: stud.institutionId || 'inst_verimark_01',
      reg_no: stud.regNo,
      full_name: stud.fullName,
      email: stud.email,
      course: stud.course,
      department: stud.department,
      batch_year: stud.batchYear,
      status: stud.status,
      created_at: stud.createdAt,
      updated_at: stud.updatedAt,
    });
    if (error) console.error(`Error syncing student ${stud.regNo}:`, error.message);
    else console.log(`- Synced student: ${stud.fullName} (${stud.regNo})`);
  }

  console.log('\n4. SYNCING RESULTS & MERKLE HASHES:');
  for (const res of localDb.results) {
    const { error } = await client.from('results').upsert({
      id: res.id,
      institution_id: res.institutionId || 'inst_verimark_01',
      examination_id: res.examinationId,
      student_reg_no: res.studentRegNo,
      student_name: res.studentName,
      course: res.course,
      subject: res.subject,
      exam_name: res.examName,
      marks_obtained: res.marksObtained,
      max_marks: res.maxMarks,
      publication_date: res.publicationDate,
      record_hash: res.recordHash,
      status: res.status,
      version: res.version,
      created_at: res.createdAt,
      updated_at: res.updatedAt,
    });
    if (error) console.error(`Error syncing result ${res.id}:`, error.message);
    else console.log(`- Synced result: ${res.studentRegNo} - ${res.subject}: ${res.marksObtained} (Hash: ${res.recordHash.substring(0, 16)}...)`);
  }

  console.log('\n5. SYNCING LEDGER EVENTS:');
  for (const ev of localDb.ledgerEvents) {
    const { error } = await client.from('ledger_events').upsert({
      id: ev.id,
      institution_id: ev.institutionId || 'inst_verimark_01',
      sequence_number: ev.sequenceNumber,
      event_type: ev.eventType,
      record_id: ev.recordId,
      student_reg_no: ev.studentRegNo,
      payload: ev.payload,
      payload_hash: ev.payloadHash,
      prev_event_hash: ev.prevEventHash,
      event_hash: ev.eventHash,
      created_at: ev.createdAt,
    });
    if (error) console.error(`Error syncing event #${ev.sequenceNumber}:`, error.message);
    else console.log(`- Synced event #${ev.sequenceNumber}: ${ev.eventType} (${ev.eventHash.substring(0, 16)}...)`);
  }

  console.log('\n6. SYNCING CHECKPOINTS & ED25519 SIGNATURES:');
  for (const chk of localDb.checkpoints) {
    const { error } = await client.from('ledger_checkpoints').upsert({
      id: chk.id,
      institution_id: chk.institutionId || 'inst_verimark_01',
      sequence_number: chk.sequenceNumber,
      merkle_root: chk.merkleRoot,
      event_count: chk.eventCount,
      leaf_count: chk.leafCount,
      prev_checkpoint_hash: chk.prevCheckpointHash,
      checkpoint_hash: chk.checkpointHash,
      signature: chk.signature,
      signer_public_key: chk.signerPublicKey,
      committed_at: chk.committedAt,
    });
    if (error) console.error(`Error syncing checkpoint #${chk.sequenceNumber}:`, error.message);
    else console.log(`- Synced checkpoint #${chk.sequenceNumber} (${chk.id}): Root=${chk.merkleRoot.substring(0, 16)}...`);
  }

  console.log('\n==============================================================================');
  console.log('SYNC COMPLETE — ALL RECORDS PRESERVED IN SUPABASE');
  console.log('==============================================================================');
}

main().catch(console.error);
