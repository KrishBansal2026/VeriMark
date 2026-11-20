-- ==============================================================================
-- VERIMARK MIGRATION: 20261121_user_management.sql
-- Upgrades user storage to persistent authentication schema with scrypt/argon2id
-- parameters, session versioning, and activation lifecycle tracking.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('ADMIN', 'EXAM_CONTROLLER', 'ACADEMIC_DEAN', 'AUDITOR', 'STUDENT')),
    student_reg_no VARCHAR(64),
    password_hash VARCHAR(255) NOT NULL,
    password_salt VARCHAR(128) NOT NULL,
    must_change_password BOOLEAN NOT NULL DEFAULT true,
    is_active BOOLEAN NOT NULL DEFAULT true,
    password_version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fast lookup indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_student_reg_no ON users(student_reg_no);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- Comment metadata
COMMENT ON TABLE users IS 'VeriMark persistent authenticated user directory with session revocation counters';
COMMENT ON COLUMN users.password_version IS 'Incremented upon password reset or deactivation to invalidate prior JWT/HMAC sessions';
