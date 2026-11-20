-- ==============================================================================
-- VERIMARK – TAMPER-PROOF ACADEMIC RESULT LEDGER
-- Supabase / PostgreSQL Schema Definition
-- ==============================================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS TABLE (Admins, Approvers, Auditors)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'approver1', 'approver2', 'auditor')),
    public_key VARCHAR(128), -- Ed25519 public key (hex)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. STUDENTS TABLE
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reg_no VARCHAR(64) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    course VARCHAR(128) NOT NULL,
    department VARCHAR(128) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. EXAMINATIONS TABLE
CREATE TABLE IF NOT EXISTS examinations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exam_code VARCHAR(64) UNIQUE NOT NULL,
    exam_name VARCHAR(255) NOT NULL,
    semester VARCHAR(32) NOT NULL,
    academic_year VARCHAR(32) NOT NULL,
    conducted_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. RESULTS TABLE (Student Examination Records)
CREATE TABLE IF NOT EXISTS results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_reg_no VARCHAR(64) NOT NULL,
    student_name VARCHAR(255) NOT NULL,
    course VARCHAR(128) NOT NULL,
    subject VARCHAR(128) NOT NULL,
    exam_name VARCHAR(255) NOT NULL,
    marks_obtained NUMERIC(5,2) NOT NULL,
    max_marks NUMERIC(5,2) NOT NULL DEFAULT 100.00,
    publication_date TIMESTAMPTZ NOT NULL,
    record_hash VARCHAR(64) NOT NULL, -- SHA-256 canonical payload hash
    merkle_leaf_hash VARCHAR(64),     -- Domain-separated leaf hash
    merkle_index INTEGER,             -- Leaf position in current Merkle tree
    checkpoint_id UUID,               -- Associated checkpoint
    status VARCHAR(32) NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'corrected', 'revoked')),
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_results_reg_no ON results(student_reg_no);
CREATE INDEX IF NOT EXISTS idx_results_record_hash ON results(record_hash);

-- 5. APPEND-ONLY LEDGER EVENTS (Verifiable event sequence)
CREATE TABLE IF NOT EXISTS ledger_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sequence_number BIGSERIAL UNIQUE NOT NULL,
    event_type VARCHAR(64) NOT NULL CHECK (event_type IN ('RESULT_PUBLISHED', 'RESULT_CORRECTED', 'CHECKPOINT_COMMITTED')),
    record_id UUID NOT NULL,
    student_reg_no VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL,
    payload_hash VARCHAR(64) NOT NULL,
    prev_event_hash VARCHAR(64) NOT NULL,
    event_hash VARCHAR(64) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_events_seq ON ledger_events(sequence_number);

-- 6. INDEPENDENTLY PROTECTED SIGNED CHECKPOINTS
CREATE TABLE IF NOT EXISTS ledger_checkpoints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sequence_number BIGINT UNIQUE NOT NULL,
    merkle_root VARCHAR(64) NOT NULL,
    event_count INTEGER NOT NULL,
    leaf_count INTEGER NOT NULL,
    prev_checkpoint_hash VARCHAR(64) NOT NULL,
    checkpoint_hash VARCHAR(64) UNIQUE NOT NULL,
    signature VARCHAR(128) NOT NULL, -- Ed25519 signature in hex
    signer_public_key VARCHAR(64) NOT NULL,
    committed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. TWO-PERSON CORRECTION REQUESTS
CREATE TABLE IF NOT EXISTS correction_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    result_id UUID NOT NULL REFERENCES results(id) ON DELETE RESTRICT,
    student_reg_no VARCHAR(64) NOT NULL,
    subject VARCHAR(128) NOT NULL,
    original_marks NUMERIC(5,2) NOT NULL,
    proposed_marks NUMERIC(5,2) NOT NULL,
    original_hash VARCHAR(64) NOT NULL,
    proposed_hash VARCHAR(64) NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending_approvals' 
        CHECK (status IN ('pending_approvals', 'partially_approved', 'approved_applied', 'rejected')),
    requester_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- 8. CORRECTION APPROVALS (Dual Ed25519 Signatures)
CREATE TABLE IF NOT EXISTS correction_approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES correction_requests(id) ON DELETE CASCADE,
    approver_name VARCHAR(255) NOT NULL,
    approver_role VARCHAR(64) NOT NULL CHECK (approver_role IN ('EXAM_CONTROLLER', 'ACADEMIC_DEAN')),
    approver_public_key VARCHAR(64) NOT NULL,
    signature VARCHAR(128) NOT NULL, -- Ed25519 signature
    signed_payload_hash VARCHAR(64) NOT NULL,
    comments TEXT,
    approved_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_request_approver_role UNIQUE (request_id, approver_role)
);

-- 9. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action_type VARCHAR(64) NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(64),
    actor VARCHAR(255) NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security (RLS) policies for Supabase
ALTER TABLE results ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE correction_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE correction_approvals ENABLE ROW LEVEL SECURITY;

-- Allow public read access to verify results and checkpoints
CREATE POLICY "Allow public read access to results" ON results FOR SELECT USING (true);
CREATE POLICY "Allow public read access to ledger checkpoints" ON ledger_checkpoints FOR SELECT USING (true);
CREATE POLICY "Allow public read access to ledger events" ON ledger_events FOR SELECT USING (true);
CREATE POLICY "Allow public read access to correction requests" ON correction_requests FOR SELECT USING (true);
CREATE POLICY "Allow public read access to correction approvals" ON correction_approvals FOR SELECT USING (true);
