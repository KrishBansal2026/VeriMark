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
}

// Deterministically derive password hash with scrypt
function hashPassword(password: string, salt: string): string {
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
    };
  } catch (err) {
    return null;
  }
}

/**
 * Authenticates user credentials against institutional accounts.
 */
export async function authenticateCredentials(
  email: string,
  password: string
): Promise<{ user: AuthUser; token: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  const stored = INSTITUTIONAL_USERS.find((u) => u.email.toLowerCase() === normalizedEmail);

  if (!stored) {
    throw new AuthError(401, 'Invalid institutional credentials');
  }

  const computedHash = hashPassword(password, stored.salt);
  const hashBuf = Buffer.from(computedHash, 'hex');
  const storedBuf = Buffer.from(stored.passwordHash, 'hex');

  if (hashBuf.length !== storedBuf.length || !timingSafeEqual(hashBuf, storedBuf)) {
    throw new AuthError(401, 'Invalid institutional credentials');
  }

  const keys = getServerKeys();
  let publicKey: string | undefined;
  if (stored.role === 'EXAM_CONTROLLER') {
    publicKey = keys.approver1.publicKey;
  } else if (stored.role === 'ACADEMIC_DEAN') {
    publicKey = keys.approver2.publicKey;
  }

  const user: AuthUser = {
    id: stored.id,
    email: stored.email,
    name: stored.name,
    role: stored.role,
    publicKey,
  };

  const token = createSessionToken(user);
  return { user, token };
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
    throw new AuthError(401, 'Authentication required. Please provide a valid institutional session.');
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
export function getDemoTokenForRole(role: UserRole): { user: AuthUser; token: string } {
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
export function getAvailableDemoAccounts(): { email: string; name: string; role: UserRole }[] {
  return INSTITUTIONAL_USERS.map((u) => ({
    email: u.email,
    name: u.name,
    role: u.role,
  }));
}
