// ==============================================================================
// VERIMARK – Multi-Tenant Context Resolution & Isolation Guard
// ==============================================================================

import { AuthUser } from '../types';
import { AuthError } from './auth';

/**
 * Resolves and strictly enforces tenant boundary for the authenticated user.
 * 
 * Rules:
 * 1. SUPER_ADMIN: Can act globally or scope to a specific institution.
 * 2. Tenant Users (INSTITUTION_ADMIN, EXAM_CONTROLLER, ACADEMIC_DEAN, AUDITOR, FACULTY, STUDENT):
 *    - Bound strictly to user.institutionId.
 *    - Attempting to access, query, create, or modify records for another institution throws HTTP 403.
 * 3. Students:
 *    - In addition to tenant isolation, students are restricted strictly to their own studentRegNo.
 */
export function resolveTenantContext(
  user: AuthUser,
  requestedInstitutionId?: string | null
): string {
  const userInst = user.institutionId || 'inst_verimark_01';

  if (user.role === 'SUPER_ADMIN') {
    return requestedInstitutionId || userInst;
  }

  // Cross-tenant access check
  if (requestedInstitutionId && requestedInstitutionId !== userInst) {
    throw new AuthError(
      403,
      `Cross-tenant access denied: User '${user.email}' (${user.role}) is bound to institution '${userInst}' and cannot access institution '${requestedInstitutionId}'.`
    );
  }

  return userInst;
}

/**
 * Enforces that a student user can only access their own registration number.
 */
export function enforceStudentOwnership(
  user: AuthUser,
  targetRegNo: string
): void {
  if (user.role === 'STUDENT') {
    const cleanUserReg = (user.studentRegNo || '').trim().toUpperCase();
    const cleanTargetReg = (targetRegNo || '').trim().toUpperCase();

    if (!cleanUserReg || cleanUserReg !== cleanTargetReg) {
      throw new AuthError(
        403,
        `Access denied: Student '${user.email}' is only authorized to access registration number '${user.studentRegNo}'.`
      );
    }
  }
}
