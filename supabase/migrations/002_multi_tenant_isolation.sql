-- ==============================================================================
-- VERIMARK COMMERCIAL SAAS – MIGRATION 002: MULTI-TENANT ISOLATION & RLS
-- Multi-Tenant Security & Tenant Isolation Policies
-- Up Migration
-- ==============================================================================

-- 1. Helper function for runtime institution context in Postgres
CREATE OR REPLACE FUNCTION current_institution_id() RETURNS VARCHAR(64) AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_institution_id', true), '');
END;
$$ LANGUAGE plpgsql STABLE;

-- 2. Helper function to check if current user is SUPER_ADMIN
CREATE OR REPLACE FUNCTION is_super_admin() RETURNS BOOLEAN AS $$
BEGIN
    RETURN COALESCE(
        current_setting('app.user_role', true) = 'SUPER_ADMIN' OR
        (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role') = 'SUPER_ADMIN',
        false
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. Procedure to set institution context for session/transaction
CREATE OR REPLACE FUNCTION set_tenant_context(p_inst_id VARCHAR(64), p_user_role VARCHAR(50) DEFAULT 'INSTITUTION_ADMIN') RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.current_institution_id', p_inst_id, false);
    PERFORM set_config('app.user_role', p_user_role, false);
END;
$$ LANGUAGE plpgsql;

-- 4. TENANT ISOLATION POLICIES

-- Institutions: Public can view active; SUPER_ADMIN can manage all; Tenant users view their own
DROP POLICY IF EXISTS "institutions_super_admin_all" ON institutions;
CREATE POLICY "institutions_super_admin_all" ON institutions
    FOR ALL
    USING (is_super_admin());

DROP POLICY IF EXISTS "institutions_tenant_view" ON institutions;
CREATE POLICY "institutions_tenant_view" ON institutions
    FOR SELECT
    USING (status = 'active' OR id = current_institution_id());

-- Users: SUPER_ADMIN full access; Tenant users isolated to own institution
DROP POLICY IF EXISTS "users_super_admin_all" ON users;
CREATE POLICY "users_super_admin_all" ON users
    FOR ALL
    USING (is_super_admin());

DROP POLICY IF EXISTS "users_tenant_isolation" ON users;
CREATE POLICY "users_tenant_isolation" ON users
    FOR ALL
    USING (institution_id = current_institution_id() OR (institution_id IS NULL AND is_super_admin()));

-- Students: Tenant-isolated
DROP POLICY IF EXISTS "students_super_admin_all" ON students;
CREATE POLICY "students_super_admin_all" ON students
    FOR ALL
    USING (is_super_admin());

DROP POLICY IF EXISTS "students_tenant_isolation" ON students;
CREATE POLICY "students_tenant_isolation" ON students
    FOR ALL
    USING (institution_id = current_institution_id());

-- Examinations & Subjects: Tenant-isolated
DROP POLICY IF EXISTS "examinations_tenant_isolation" ON examinations;
CREATE POLICY "examinations_tenant_isolation" ON examinations
    FOR ALL
    USING (is_super_admin() OR institution_id = current_institution_id());

DROP POLICY IF EXISTS "subjects_tenant_isolation" ON subjects;
CREATE POLICY "subjects_tenant_isolation" ON subjects
    FOR ALL
    USING (is_super_admin() OR institution_id = current_institution_id());

-- Results: Tenant-isolated; Public can read published for verification
DROP POLICY IF EXISTS "results_super_admin_all" ON results;
CREATE POLICY "results_super_admin_all" ON results
    FOR ALL
    USING (is_super_admin());

DROP POLICY IF EXISTS "results_tenant_isolation" ON results;
CREATE POLICY "results_tenant_isolation" ON results
    FOR ALL
    USING (institution_id = current_institution_id());

DROP POLICY IF EXISTS "results_public_verification" ON results;
CREATE POLICY "results_public_verification" ON results
    FOR SELECT
    USING (status IN ('published', 'corrected'));

-- Ledger Events: Strictly append-only, tenant-isolated
DROP POLICY IF EXISTS "ledger_events_tenant_isolation" ON ledger_events;
CREATE POLICY "ledger_events_tenant_isolation" ON ledger_events
    FOR ALL
    USING (is_super_admin() OR institution_id = current_institution_id());

-- Checkpoints: Tenant-isolated, public read for verification
DROP POLICY IF EXISTS "checkpoints_tenant_isolation" ON ledger_checkpoints;
CREATE POLICY "checkpoints_tenant_isolation" ON ledger_checkpoints
    FOR ALL
    USING (is_super_admin() OR institution_id = current_institution_id());

-- Correction Requests: Strictly isolated to institution
DROP POLICY IF EXISTS "corrections_tenant_isolation" ON correction_requests;
CREATE POLICY "corrections_tenant_isolation" ON correction_requests
    FOR ALL
    USING (is_super_admin() OR institution_id = current_institution_id());

-- Audit Logs: Strictly isolated to institution
DROP POLICY IF EXISTS "audit_logs_tenant_isolation" ON audit_logs;
CREATE POLICY "audit_logs_tenant_isolation" ON audit_logs
    FOR ALL
    USING (is_super_admin() OR institution_id = current_institution_id());

-- 5. Compound indexes for high-throughput multi-tenant queries
CREATE INDEX IF NOT EXISTS idx_results_inst_status ON results(institution_id, status);
CREATE INDEX IF NOT EXISTS idx_students_inst_status ON students(institution_id, status);
CREATE INDEX IF NOT EXISTS idx_exams_inst_status ON examinations(institution_id, status);
CREATE INDEX IF NOT EXISTS idx_corrections_inst_status ON correction_requests(institution_id, status);
