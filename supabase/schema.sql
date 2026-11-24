-- ==============================================================================
-- VERIMARK COMMERCIAL SAAS – PRODUCTION DATABASE SCHEMA
-- Multi-Tenant PostgreSQL / Supabase Schema Definition
-- Version: 2.0.0
-- ==============================================================================

-- Enable UUID extension if available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. INSTITUTIONS (Tenants)
CREATE TABLE IF NOT EXISTS institutions (
    id VARCHAR(64) PRIMARY KEY,
    code VARCHAR(32) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) UNIQUE NOT NULL,
    logo_url TEXT,
    theme_color VARCHAR(32) DEFAULT '#0284c7',
    status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. USERS (Platform Admins, Institutional Staff, Faculty, Students)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    institution_id VARCHAR(64) REFERENCES institutions(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN (
        'SUPER_ADMIN',
        'INSTITUTION_ADMIN',
        'EXAM_CONTROLLER',
        'ACADEMIC_DEAN',
        'AUDITOR',
        'FACULTY',
        'STUDENT'
    )),
    password_hash TEXT NOT NULL,
    salt VARCHAR(64) NOT NULL,
    student_reg_no VARCHAR(64),
    must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    public_key VARCHAR(128),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_inst_id ON users(institution_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_reg_no ON users(student_reg_no);

-- 3. STUDENTS (Institutional Student Directory)
CREATE TABLE IF NOT EXISTS students (
    id VARCHAR(64) PRIMARY KEY,
    institution_id VARCHAR(64) NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    reg_no VARCHAR(64) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    course VARCHAR(128) NOT NULL,
    department VARCHAR(128) NOT NULL,
    batch_year VARCHAR(32) NOT NULL DEFAULT '2022-2026',
    status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'graduated', 'suspended')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_inst_student_reg UNIQUE (institution_id, reg_no)
);

CREATE INDEX IF NOT EXISTS idx_students_inst_id ON students(institution_id);
CREATE INDEX IF NOT EXISTS idx_students_reg_no ON students(reg_no);

-- 4. EXAMINATIONS
CREATE TABLE IF NOT EXISTS examinations (
    id VARCHAR(64) PRIMARY KEY,
    institution_id VARCHAR(64) NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    exam_code VARCHAR(64) NOT NULL,
    exam_name VARCHAR(255) NOT NULL,
    semester VARCHAR(32) NOT NULL,
    academic_year VARCHAR(32) NOT NULL,
    department VARCHAR(128),
    status VARCHAR(32) NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'scheduled', 'completed', 'published', 'archived')),
    conducted_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_inst_exam_code UNIQUE (institution_id, exam_code)
);

CREATE INDEX IF NOT EXISTS idx_exams_inst_id ON examinations(institution_id);

-- 5. SUBJECTS / COURSES
CREATE TABLE IF NOT EXISTS subjects (
    id VARCHAR(64) PRIMARY KEY,
    institution_id VARCHAR(64) NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    subject_code VARCHAR(32) NOT NULL,
    subject_name VARCHAR(128) NOT NULL,
    department VARCHAR(128) NOT NULL,
    credits INTEGER DEFAULT 4,
    max_marks NUMERIC(5,2) DEFAULT 100.00,
    passing_marks NUMERIC(5,2) DEFAULT 40.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_inst_subject_code UNIQUE (institution_id, subject_code)
);

CREATE INDEX IF NOT EXISTS idx_subjects_inst_id ON subjects(institution_id);

-- 6. RESULTS (Student Examination Records with Cryptographic Hashes)
CREATE TABLE IF NOT EXISTS results (
    id VARCHAR(64) PRIMARY KEY,
    institution_id VARCHAR(64) NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    examination_id VARCHAR(64),
    student_reg_no VARCHAR(64) NOT NULL,
    student_name VARCHAR(255) NOT NULL,
    course VARCHAR(128) NOT NULL,
    subject VARCHAR(128) NOT NULL,
    exam_name VARCHAR(255) NOT NULL,
    marks_obtained NUMERIC(5,2) NOT NULL,
    max_marks NUMERIC(5,2) NOT NULL DEFAULT 100.00,
    publication_date TIMESTAMPTZ NOT NULL,
    record_hash VARCHAR(64) NOT NULL,
    merkle_leaf_hash VARCHAR(64),
    merkle_index INTEGER,
    checkpoint_id VARCHAR(64),
    status VARCHAR(32) NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'corrected', 'revoked')),
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_results_inst_id ON results(institution_id);
CREATE INDEX IF NOT EXISTS idx_results_reg_no ON results(student_reg_no);
CREATE INDEX IF NOT EXISTS idx_results_record_hash ON results(record_hash);

-- 7. APPEND-ONLY LEDGER EVENTS (Verifiable Event Sequence)
CREATE TABLE IF NOT EXISTS ledger_events (
    id VARCHAR(64) PRIMARY KEY,
    institution_id VARCHAR(64) NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    sequence_number BIGINT NOT NULL,
    event_type VARCHAR(64) NOT NULL CHECK (event_type IN ('RESULT_PUBLISHED', 'RESULT_CORRECTED', 'CHECKPOINT_COMMITTED', 'RESULT_CREATED')),
    record_id VARCHAR(64) NOT NULL,
    student_reg_no VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL,
    payload_hash VARCHAR(64) NOT NULL,
    prev_event_hash VARCHAR(64) NOT NULL,
    event_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_inst_event_seq UNIQUE (institution_id, sequence_number),
    CONSTRAINT unique_inst_event_hash UNIQUE (institution_id, event_hash)
);

CREATE INDEX IF NOT EXISTS idx_ledger_inst_seq ON ledger_events(institution_id, sequence_number);

-- 8. INDEPENDENTLY PROTECTED SIGNED CHECKPOINTS
CREATE TABLE IF NOT EXISTS ledger_checkpoints (
    id VARCHAR(64) PRIMARY KEY,
    institution_id VARCHAR(64) NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    sequence_number BIGINT NOT NULL,
    merkle_root VARCHAR(64) NOT NULL,
    event_count INTEGER NOT NULL,
    leaf_count INTEGER NOT NULL,
    prev_checkpoint_hash VARCHAR(64) NOT NULL,
    checkpoint_hash VARCHAR(64) NOT NULL,
    signature VARCHAR(128) NOT NULL,
    signer_public_key VARCHAR(64) NOT NULL,
    committed_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_inst_chk_seq UNIQUE (institution_id, sequence_number),
    CONSTRAINT unique_inst_chk_hash UNIQUE (institution_id, checkpoint_hash)
);

CREATE INDEX IF NOT EXISTS idx_checkpoints_inst_seq ON ledger_checkpoints(institution_id, sequence_number);

-- 9. TWO-PERSON CORRECTION REQUESTS
CREATE TABLE IF NOT EXISTS correction_requests (
    id VARCHAR(64) PRIMARY KEY,
    institution_id VARCHAR(64) NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    result_id VARCHAR(64) NOT NULL,
    student_reg_no VARCHAR(64) NOT NULL,
    subject VARCHAR(128) NOT NULL,
    original_marks NUMERIC(5,2) NOT NULL,
    proposed_marks NUMERIC(5,2) NOT NULL,
    original_hash VARCHAR(64) NOT NULL,
    proposed_hash VARCHAR(64) NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending_approvals' CHECK (status IN ('pending_approvals', 'partially_approved', 'approved_applied', 'rejected')),
    requester_user_id VARCHAR(64) NOT NULL,
    requester_name VARCHAR(255) NOT NULL,
    approvals JSONB DEFAULT '[]'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_corrections_inst ON correction_requests(institution_id);

-- 10. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    institution_id VARCHAR(64),
    actor_id VARCHAR(64) NOT NULL,
    actor_name VARCHAR(255) NOT NULL,
    actor_role VARCHAR(64) NOT NULL,
    action VARCHAR(64) NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(64),
    details JSONB,
    ip_address VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_inst_created ON audit_logs(institution_id, created_at);

-- 11. REVOKED SESSIONS / TOKENS
CREATE TABLE IF NOT EXISTS revoked_tokens (
    token_hash VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    revoked_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

-- 12. RATE LIMIT TRACKING
CREATE TABLE IF NOT EXISTS rate_limits (
    key VARCHAR(128) PRIMARY KEY,
    attempts INTEGER NOT NULL DEFAULT 1,
    reset_at TIMESTAMPTZ NOT NULL
);

-- ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE correction_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Note on RLS: In server-side Next.js with SUPABASE_SERVICE_ROLE_KEY, queries bypass RLS.
-- For anon client keys, public read access is explicitly RESTRICTED to public checkpoints and verification.
CREATE POLICY "Public read verification checkpoints" ON ledger_checkpoints FOR SELECT USING (true);
