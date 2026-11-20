import { createHmac, timingSafeEqual, scryptSync, randomBytes } from 'crypto';
import { AuthUser, UserRole } from '../types';
import { getServerKeys } from './keys';

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
}

// Deterministically derive password hash with scrypt
export function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString('hex');
}

// Pre-seeded authorized institutional directory
const INSTITUTIONAL_USERS: StoredUser[] = [
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

// Pre-provisioned university student directory matching the 5 published records
// Each provisioned with a unique temporary activation credential and forced password change flag
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

// In-memory runtime store for updated passwords
const DYNAMIC_USER_OVERRIDES = new Map<string, { passwordHash: string; salt: string; mustChangePassword: boolean }>();

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
    };
  } catch (err) {
    return null;
  }
}

/**
 * Authenticates user credentials against institutional accounts or student directory.
 */
export async function authenticateCredentials(
  email: string,
  password: string
): Promise<{ user: AuthUser; token: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  const allUsers = [...INSTITUTIONAL_USERS, ...STUDENT_USERS];
  const stored = allUsers.find((u) => u.email.toLowerCase() === normalizedEmail);

  if (!stored) {
    throw new AuthError(401, 'Invalid credentials');
  }

  // Check for dynamic runtime password override
  const override = DYNAMIC_USER_OVERRIDES.get(stored.id);
  const activeSalt = override ? override.salt : stored.salt;
  const activeHash = override ? override.passwordHash : stored.passwordHash;
  const mustChangePassword = override ? override.mustChangePassword : (stored.mustChangePassword ?? false);

  const computedHash = hashPassword(password, activeSalt);
  const hashBuf = Buffer.from(computedHash, 'hex');
  const storedBuf = Buffer.from(activeHash, 'hex');

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
    mustChangePassword,
    publicKey,
  };

  const token = createSessionToken(user);
  return { user, token };
}

/**
 * Changes a user's password securely, clearing mustChangePassword requirement.
 */
export async function changeUserPassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<{ user: AuthUser; token: string }> {
  const allUsers = [...INSTITUTIONAL_USERS, ...STUDENT_USERS];
  const stored = allUsers.find((u) => u.id === userId);
  if (!stored) {
    throw new AuthError(404, 'User account not found');
  }

  // Verify current password
  const override = DYNAMIC_USER_OVERRIDES.get(stored.id);
  const activeSalt = override ? override.salt : stored.salt;
  const activeHash = override ? override.passwordHash : stored.passwordHash;

  const computedHash = hashPassword(currentPassword, activeSalt);
  const hashBuf = Buffer.from(computedHash, 'hex');
  const storedBuf = Buffer.from(activeHash, 'hex');

  if (hashBuf.length !== storedBuf.length || !timingSafeEqual(hashBuf, storedBuf)) {
    throw new AuthError(401, 'Current password is incorrect');
  }

  // Enforce strong password policy
  if (!newPassword || newPassword.length < 8) {
    throw new AuthError(400, 'New password must be at least 8 characters long');
  }
  if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
    throw new AuthError(400, 'New password must contain uppercase, lowercase, numbers, and special characters');
  }
  if (newPassword === currentPassword) {
    throw new AuthError(400, 'New password cannot be the same as current password');
  }

  // Generate fresh unique salt and hash
  const newSalt = randomBytes(16).toString('hex');
  const newHash = hashPassword(newPassword, newSalt);

  DYNAMIC_USER_OVERRIDES.set(stored.id, {
    passwordHash: newHash,
    salt: newSalt,
    mustChangePassword: false,
  });

  const updatedUser: AuthUser = {
    id: stored.id,
    email: stored.email,
    name: stored.name,
    role: stored.role,
    studentRegNo: stored.studentRegNo,
    mustChangePassword: false,
  };

  const token = createSessionToken(updatedUser);
  return { user: updatedUser, token };
}

/**
 * Extracts and verifies authenticated user from Request headers (Authorization or Cookie).
 */
export async function getAuthenticatedUser(request: Request): Promise<AuthUser | null> {
  // 1. Check Authorization: Bearer <token>
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    const user = verifySessionToken(token);
    if (user) return user;
  }

  // 2. Check Cookie header
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(/verimark_session=([^;]+)/);
  if (match) {
    const token = decodeURIComponent(match[1].trim());
    const user = verifySessionToken(token);
    if (user) return user;
  }

  return null;
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
  if (role === 'STUDENT') {
    const student = studentRegNo
      ? STUDENT_USERS.find((s) => s.studentRegNo === studentRegNo) || STUDENT_USERS[0]
      : STUDENT_USERS[0];
    const user: AuthUser = {
      id: student.id,
      email: student.email,
      name: student.name,
      role: 'STUDENT',
      studentRegNo: student.studentRegNo,
      mustChangePassword: student.mustChangePassword,
    };
    return { user, token: createSessionToken(user) };
  }

  const userRecord = INSTITUTIONAL_USERS.find((u) => u.role === role);
  if (!userRecord) {
    throw new Error(`Unknown role ${role}`);
  }
  const user: AuthUser = {
    id: userRecord.id,
    email: userRecord.email,
    name: userRecord.name,
    role: userRecord.role,
  };
  return { user, token: createSessionToken(user) };
}

/**
 * Returns list of public demo accounts for the UI switcher.
 */
export function getAvailableDemoAccounts(): {
  email: string;
  name: string;
  role: UserRole;
  studentRegNo?: string;
  type: 'INSTITUTIONAL' | 'STUDENT';
}[] {
  const inst = INSTITUTIONAL_USERS.map((u) => ({
    email: u.email,
    name: u.name,
    role: u.role,
    type: 'INSTITUTIONAL' as const,
  }));

  const stud = STUDENT_USERS.map((u) => ({
    email: u.email,
    name: `${u.name} (${u.studentRegNo})`,
    role: u.role,
    studentRegNo: u.studentRegNo,
    type: 'STUDENT' as const,
  }));

  return [...inst, ...stud];
}
