-- ==============================================================================
-- VERIMARK COMMERCIAL SAAS – MIGRATION 002 ROLLBACK: MULTI-TENANT ISOLATION
-- Down Migration (Reversible)
-- ==============================================================================

-- Drop compound multi-tenant indexes
DROP INDEX IF EXISTS idx_results_inst_status;
DROP INDEX IF EXISTS idx_students_inst_status;
DROP INDEX IF EXISTS idx_exams_inst_status;
DROP INDEX IF EXISTS idx_corrections_inst_status;

-- Drop RLS policies created in Migration 002
DROP POLICY IF EXISTS "institutions_super_admin_all" ON institutions;
DROP POLICY IF EXISTS "institutions_tenant_view" ON institutions;
DROP POLICY IF EXISTS "users_super_admin_all" ON users;
DROP POLICY IF EXISTS "users_tenant_isolation" ON users;
DROP POLICY IF EXISTS "students_super_admin_all" ON students;
DROP POLICY IF EXISTS "students_tenant_isolation" ON students;
DROP POLICY IF EXISTS "examinations_tenant_isolation" ON examinations;
DROP POLICY IF EXISTS "subjects_tenant_isolation" ON subjects;
DROP POLICY IF EXISTS "results_super_admin_all" ON results;
DROP POLICY IF EXISTS "results_tenant_isolation" ON results;
DROP POLICY IF EXISTS "results_public_verification" ON results;
DROP POLICY IF EXISTS "ledger_events_tenant_isolation" ON ledger_events;
DROP POLICY IF EXISTS "checkpoints_tenant_isolation" ON ledger_checkpoints;
DROP POLICY IF EXISTS "corrections_tenant_isolation" ON correction_requests;
DROP POLICY IF EXISTS "audit_logs_tenant_isolation" ON audit_logs;

-- Re-establish base baseline public policy
CREATE POLICY "Public read verification checkpoints" ON ledger_checkpoints FOR SELECT USING (true);

-- Drop context helper functions
DROP FUNCTION IF EXISTS set_tenant_context(VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS is_super_admin();
DROP FUNCTION IF EXISTS current_institution_id();
