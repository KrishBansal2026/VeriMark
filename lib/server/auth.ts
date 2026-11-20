import { createHmac, timingSafeEqual, scryptSync, randomBytes } from 'crypto';
import { AuthUser, UserRole, UserRecord } from '../types';
import { getServerKeys } from './keys';
import {
  userStore,
  loadLocalUsers,
  hashPassword as storeHashPassword,
  validatePasswordStrength,
  generateSecureTemporaryPassword,
} from '../storage/userStore';

export class AuthError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
  }
}

// Server-side session signing secret
const SESSION_SECRET = process.env.ADMIN_SECRET_TOKEN || 'verimark_session_hmac_secret_key_cf2026_production';

interface StoredUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  passwordHash: string;
  salt: string;
  studentRegNo?: string;
  mustChangePassword?: boolean;
  isActive?: boolean;
  passwordVersion?: number;
}

// Deterministically derive password hash with scrypt
export function hashPassword(password: string, salt: string): string {
  return storeHashPassword(password, salt);
}

// Re-export password utilities
export { validatePasswordStrength, generateSecureTemporaryPassword };

// Pre-seeded authorized institutional directory (maintained for backwards test compatibility)
export const INSTITUTIONAL_USERS: StoredUser[] = [
  {
    id: 'usr_admin_01',
    email: 'admin@verimark.edu',
    name: 'Chief Academic Officer',
    role: 'ADMIN',
    salt: 'salt_admin_cf2026',
    passwordHash: hashPassword('Admin@2026!', 'salt_admin_cf2026'),
  },
  {
    id: 'usr_controller_02',
    email: 'controller@verimark.edu',
    name: 'Dr. Robert Vance',
    role: 'EXAM_CONTROLLER',
    salt: 'salt_ctrl_cf2026',
    passwordHash: hashPassword('Controller@2026!', 'salt_ctrl_cf2026'),
  },
  {
    id: 'usr_dean_03',
    email: 'dean@verimark.edu',
    name: 'Prof. Margaret Hamilton',
    role: 'ACADEMIC_DEAN',
    salt: 'salt_dean_cf2026',
    passwordHash: hashPassword('Dean@2026!', 'salt_dean_cf2026'),
  },
  {
    id: 'usr_auditor_04',
    email: 'auditor@verimark.edu',
    name: 'Dr. Elena Rostova',
    role: 'AUDITOR',
    salt: 'salt_audit_cf2026',
    passwordHash: hashPassword('Auditor@2026!', 'salt_audit_cf2026'),
  },
];

// Pre-provisioned university student directory matching the 5 published records (maintained for backwards test compatibility)
export const STUDENT_USERS: StoredUser[] = [
  {
    id: 'usr_student_101',
    email: 'aarav.sharma@student.verimark.edu',
    name: 'Aarav Sharma',
    role: 'STUDENT',
    studentRegNo: 'CF2026-CSE-101',
    salt: 'salt_stud_101_cf2026',
    passwordHash: hashPassword('Act#Aarav$2026!', 'salt_stud_101_cf2026'),
    mustChangePassword: true,
  },
  {
    id: 'usr_student_102',
    email: 'bhavna.reddy@student.verimark.edu',
    name: 'Bhavna Reddy',
    role: 'STUDENT',
    studentRegNo: 'CF2026-CSE-102',
    salt: 'salt_stud_102_cf2026',
    passwordHash: hashPassword('Act#Bhavna$2026!', 'salt_stud_102_cf2026'),
    mustChangePassword: true,
  },
  {
    id: 'usr_student_103',
    email: 'chetan.verma@student.verimark.edu',
    name: 'Chetan Verma',
    role: 'STUDENT',
    studentRegNo: 'CF2026-CSE-103',
    salt: 'salt_stud_103_cf2026',
    passwordHash: hashPassword('Act#Chetan$2026!', 'salt_stud_103_cf2026'),
    mustChangePassword: true,
  },
  {
    id: 'usr_student_104',
    email: 'divya.nair@student.verimark.edu',
    name: 'Divya Nair',
    role: 'STUDENT',
    studentRegNo: 'CF2026-CSE-104',
    salt: 'salt_stud_104_cf2026',
    passwordHash: hashPassword('Act#Divya$2026!', 'salt_stud_104_cf2026'),
    mustChangePassword: true,
  },
  {
    id: 'usr_student_105',
    email: 'eshan.roy@student.verimark.edu',
    name: 'Eshan Roy',
    role: 'STUDENT',
    studentRegNo: 'CF2026-CSE-105',
    salt: 'salt_stud_105_cf2026',
    passwordHash: hashPassword('Act#Eshan$2026!', 'salt_stud_105_cf2026'),
    mustChangePassword: true,
  },
];

/**
 * Creates a cryptographically signed session token:
 * format: base64url(payload).base64url(hmacSignature)
 */
export function createSessionToken(user: AuthUser, expiresInHours = 24): string {
  const payload = {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    studentRegNo: user.studentRegNo,
    mustChangePassword: user.mustChangePassword,
    passwordVersion: user.passwordVersion ?? 1,
    exp: Math.floor(Date.now() / 1000) + expiresInHours * 3600,
    iat: Math.floor(Date.now() / 1000),
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const hmac = createHmac('sha256', SESSION_SECRET).update(payloadB64).digest('base64url');
  return `${payloadB64}.${hmac}`;
}

/**
 * Cryptographically verifies session token signature and expiration.
 */
export function verifySessionToken(token: string): AuthUser | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.trim().split('.');
  if (parts.length !== 2) return null;

  const [payloadB64, signature] = parts;

  // Compute expected HMAC
  const expectedHmac = createHmac('sha256', SESSION_SECRET).update(payloadB64).digest('base64url');

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedHmac);

  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null; // Expired
    }

    return {
      id: payload.userId,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      studentRegNo: payload.studentRegNo,
      mustChangePassword: payload.mustChangePassword,
      passwordVersion: payload.passwordVersion,
    };
  } catch {
    return null;
  }
}

/**
 * Authenticates user credentials against the persistent backend userStore.
 * Enforces account active check and scrypt verification.
 */
export async function authenticateCredentials(
  email: string,
  password: string
): Promise<{ user: AuthUser; token: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  const stored = await userStore.getUserByEmail(normalizedEmail);

  if (!stored) {
    throw new AuthError(401, 'Invalid credentials');
  }

  if (!stored.isActive) {
    throw new AuthError(403, 'Account is deactivated. Please contact the administrator.');
  }

  const computedHash = hashPassword(password, stored.passwordSalt);
  const hashBuf = Buffer.from(computedHash, 'hex');
  const storedBuf = Buffer.from(stored.passwordHash, 'hex');

  if (hashBuf.length !== storedBuf.length || !timingSafeEqual(hashBuf, storedBuf)) {
    throw new AuthError(401, 'Invalid credentials');
  }

  let publicKey: string | undefined;
  if (stored.role === 'EXAM_CONTROLLER' || stored.role === 'ACADEMIC_DEAN') {
    const keys = getServerKeys();
    if (stored.role === 'EXAM_CONTROLLER') {
      publicKey = keys.approver1.publicKey;
    } else if (stored.role === 'ACADEMIC_DEAN') {
      publicKey = keys.approver2.publicKey;
    }
  }

  const user: AuthUser = {
    id: stored.id,
    email: stored.email,
    name: stored.name,
    role: stored.role,
    studentRegNo: stored.studentRegNo,
    mustChangePassword: stored.mustChangePassword,
    isActive: stored.isActive,
    passwordVersion: stored.passwordVersion,
    publicKey,
  };

  const token = createSessionToken(user);
  return { user, token };
}

/**
 * Changes a user's password securely in the persistent backend,
 * increments passwordVersion to invalidate any active sessions,
 * and clears mustChangePassword requirement.
 */
export async function changeUserPassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<{ user: AuthUser; token: string }> {
  const stored = await userStore.getUserById(userId);
  if (!stored) {
    throw new AuthError(404, 'User account not found');
  }

  if (!stored.isActive) {
    throw new AuthError(403, 'Account is deactivated');
  }

  // Verify current password
  const computedHash = hashPassword(currentPassword, stored.passwordSalt);
  const hashBuf = Buffer.from(computedHash, 'hex');
  const storedBuf = Buffer.from(stored.passwordHash, 'hex');

  if (hashBuf.length !== storedBuf.length || !timingSafeEqual(hashBuf, storedBuf)) {
    throw new AuthError(401, 'Current password is incorrect');
  }

  if (newPassword === currentPassword) {
    throw new AuthError(400, 'New password cannot be the same as current password');
  }

  // Enforce strong password policy (minimum 12 characters, uppercase, lowercase, number, symbol)
  const validation = validatePasswordStrength(newPassword);
  if (!validation.valid) {
    throw new AuthError(400, validation.error || 'Password does not meet complexity requirements');
  }

  // Update in persistent store (clearing mustChangePassword and incrementing passwordVersion)
  const updatedUser = await userStore.resetUserPassword(userId, newPassword, false);

  const authUser: AuthUser = {
    id: updatedUser.id,
    email: updatedUser.email,
    name: updatedUser.name,
    role: updatedUser.role,
    studentRegNo: updatedUser.studentRegNo,
    mustChangePassword: false,
    isActive: updatedUser.isActive,
    passwordVersion: updatedUser.passwordVersion,
  };

  const token = createSessionToken(authUser);
  return { user: authUser, token };
}

/**
 * Extracts and verifies authenticated user from Request headers (Authorization or Cookie),
 * checking against the persistent userStore to guarantee account is active and session
 * has not been invalidated by a password reset.
 */
export async function getAuthenticatedUser(request: Request): Promise<AuthUser | null> {
  let token: string | null = null;

  // 1. Check Authorization: Bearer <token>
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  }

  // 2. Check Cookie header
  if (!token) {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(/verimark_session=([^;]+)/);
    if (match) {
      token = decodeURIComponent(match[1].trim());
    }
  }

  if (!token) return null;

  const verified = verifySessionToken(token);
  if (!verified) return null;

  // Cross-verify against persistent database
  const user = await userStore.getUserById(verified.id);
  if (!user || !user.isActive) {
    return null; // Account deleted or deactivated
  }

  // Session invalidation check: if database passwordVersion > session passwordVersion, session is revoked
  if (verified.passwordVersion !== undefined && user.passwordVersion > verified.passwordVersion) {
    return null; // Session invalidated by password change or admin reset
  }

  let publicKey: string | undefined;
  if (user.role === 'EXAM_CONTROLLER' || user.role === 'ACADEMIC_DEAN') {
    const keys = getServerKeys();
    if (user.role === 'EXAM_CONTROLLER') {
      publicKey = keys.approver1.publicKey;
    } else if (user.role === 'ACADEMIC_DEAN') {
      publicKey = keys.approver2.publicKey;
    }
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    studentRegNo: user.studentRegNo,
    mustChangePassword: user.mustChangePassword,
    isActive: user.isActive,
    passwordVersion: user.passwordVersion,
    publicKey,
  };
}

/**
 * Enforces server-side authentication and role-based access control (RBAC).
 * Throws AuthError(401) if unauthenticated, AuthError(403) if role not permitted.
 */
export async function requireAuth(
  request: Request,
  allowedRoles?: UserRole[]
): Promise<AuthUser> {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    throw new AuthError(401, 'Authentication required. Please provide a valid session.');
  }

  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(user.role)) {
      throw new AuthError(
        403,
        `Access denied. Role '${user.role}' is not authorized for this action. Allowed: ${allowedRoles.join(', ')}`
      );
    }
  }

  return user;
}

/**
 * Helper to generate pre-authenticated demo tokens for testing and evaluation.
 */
export function getDemoTokenForRole(role: UserRole, studentRegNo?: string): { user: AuthUser; token: string } {
  const users = loadLocalUsers();
  if (role === 'STUDENT') {
    const student = studentRegNo
      ? users.find((s) => s.studentRegNo === studentRegNo && s.role === 'STUDENT') ||
        users.find((s) => s.role === 'STUDENT') ||
        STUDENT_USERS[0]
      : users.find((s) => s.role === 'STUDENT') || STUDENT_USERS[0];

    const user: AuthUser = {
      id: student.id,
      email: student.email,
      name: student.name,
      role: 'STUDENT',
      studentRegNo: student.studentRegNo,
      mustChangePassword: student.mustChangePassword,
      isActive: student.isActive ?? true,
      passwordVersion: student.passwordVersion ?? 1,
    };
    return { user, token: createSessionToken(user) };
  }

  const userRecord = users.find((u) => u.role === role) || INSTITUTIONAL_USERS.find((u) => u.role === role);
  if (!userRecord) {
    throw new Error(`Unknown role ${role}`);
  }
  const user: AuthUser = {
    id: userRecord.id,
    email: userRecord.email,
    name: userRecord.name,
    role: userRecord.role,
    isActive: userRecord.isActive ?? true,
    passwordVersion: userRecord.passwordVersion ?? 1,
  };
  return { user, token: createSessionToken(user) };
}

/**
 * Returns list of public demo accounts for the UI switcher.
 */
export async function getAvailableDemoAccounts(): Promise<{
  email: string;
  name: string;
  role: UserRole;
  studentRegNo?: string;
  type: 'INSTITUTIONAL' | 'STUDENT';
}[]> {
  const users = await userStore.getAllUsers();
  return users.map((u) => ({
    email: u.email,
    name: u.role === 'STUDENT' ? `${u.name} (${u.studentRegNo})` : u.name,
    role: u.role,
    studentRegNo: u.studentRegNo,
    type: u.role === 'STUDENT' ? 'STUDENT' : 'INSTITUTIONAL',
  }));
}
