import * as fs from 'fs';
import * as path from 'path';
import { createHmac, scryptSync, randomBytes } from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { UserRole, UserRecord, SafeUserRecord } from '../types';

const VAULT_DIR = path.join(process.cwd(), '.verimark_vault');
const DB_FILE = path.join(VAULT_DIR, 'database.json');

/**
 * Computes deterministic scrypt password hash with unique salt
 */
export function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString('hex');
}

/**
 * Validates password strength according to statutory requirements:
 * - Minimum 12 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one digit
 * - At least one special character
 */
export function validatePasswordStrength(password: string): { valid: boolean; error?: string } {
  if (!password || password.length < 12) {
    return {
      valid: false,
      error: 'New password must be at least 12 characters long (at least 8 characters minimum required).',
    };
  }
  if (!/[A-Z]/.test(password)) {
    return {
      valid: false,
      error: 'New password must contain at least one uppercase letter.',
    };
  }
  if (!/[a-z]/.test(password)) {
    return {
      valid: false,
      error: 'New password must contain at least one lowercase letter.',
    };
  }
  if (!/[0-9]/.test(password)) {
    return {
      valid: false,
      error: 'New password must contain at least one number.',
    };
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return {
      valid: false,
      error: 'New password must contain at least one special character (e.g. !@#$%^&*).',
    };
  }
  return { valid: true };
}

/**
 * Generates a random, high-entropy 16-character temporary password
 * fulfilling all uppercase, lowercase, numeric, and special character policies.
 */
export function generateSecureTemporaryPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%^&*()_+~|}{[]:;?><,./-=';

  const parts = [
    upper[randomBytes(1)[0] % upper.length],
    upper[randomBytes(1)[0] % upper.length],
    lower[randomBytes(1)[0] % lower.length],
    lower[randomBytes(1)[0] % lower.length],
    digits[randomBytes(1)[0] % digits.length],
    digits[randomBytes(1)[0] % digits.length],
    symbols[randomBytes(1)[0] % symbols.length],
    symbols[randomBytes(1)[0] % symbols.length],
  ];

  const allChars = upper + lower + digits + symbols;
  while (parts.length < 16) {
    parts.push(allChars[randomBytes(1)[0] % allChars.length]);
  }

  // Cryptographic Fisher-Yates shuffle
  for (let i = parts.length - 1; i > 0; i--) {
    const j = randomBytes(1)[0] % (i + 1);
    [parts[i], parts[j]] = [parts[j], parts[i]];
  }

  return parts.join('');
}

/**
 * Strips password hash and salt before exposing user object to APIs or clients.
 */
export function toSafeUser(user: UserRecord): SafeUserRecord {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    studentRegNo: user.studentRegNo,
    mustChangePassword: user.mustChangePassword,
    isActive: user.isActive,
    passwordVersion: user.passwordVersion,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/**
 * Canonical initial user directory seed
 */
function getInitialSeedUsers(): UserRecord[] {
  return [
    {
      id: 'usr_admin_01',
      email: 'admin@verimark.edu',
      name: 'Chief Academic Officer',
      role: 'ADMIN',
      passwordSalt: 'salt_admin_cf2026',
      passwordHash: hashPassword('Admin@2026!', 'salt_admin_cf2026'),
      mustChangePassword: false,
      isActive: true,
      passwordVersion: 1,
      createdAt: '2026-11-20T09:00:00.000Z',
      updatedAt: '2026-11-20T09:00:00.000Z',
    },
    {
      id: 'usr_controller_02',
      email: 'controller@verimark.edu',
      name: 'Dr. Robert Vance',
      role: 'EXAM_CONTROLLER',
      passwordSalt: 'salt_ctrl_cf2026',
      passwordHash: hashPassword('Controller@2026!', 'salt_ctrl_cf2026'),
      mustChangePassword: false,
      isActive: true,
      passwordVersion: 1,
      createdAt: '2026-11-20T09:00:00.000Z',
      updatedAt: '2026-11-20T09:00:00.000Z',
    },
    {
      id: 'usr_dean_03',
      email: 'dean@verimark.edu',
      name: 'Prof. Margaret Hamilton',
      role: 'ACADEMIC_DEAN',
      passwordSalt: 'salt_dean_cf2026',
      passwordHash: hashPassword('Dean@2026!', 'salt_dean_cf2026'),
      mustChangePassword: false,
      isActive: true,
      passwordVersion: 1,
      createdAt: '2026-11-20T09:00:00.000Z',
      updatedAt: '2026-11-20T09:00:00.000Z',
    },
    {
      id: 'usr_auditor_04',
      email: 'auditor@verimark.edu',
      name: 'Dr. Elena Rostova',
      role: 'AUDITOR',
      passwordSalt: 'salt_audit_cf2026',
      passwordHash: hashPassword('Auditor@2026!', 'salt_audit_cf2026'),
      mustChangePassword: false,
      isActive: true,
      passwordVersion: 1,
      createdAt: '2026-11-20T09:00:00.000Z',
      updatedAt: '2026-11-20T09:00:00.000Z',
    },
    {
      id: 'usr_student_101',
      email: 'aarav.sharma@student.verimark.edu',
      name: 'Aarav Sharma',
      role: 'STUDENT',
      studentRegNo: 'CF2026-CSE-101',
      passwordSalt: 'salt_stud_101_cf2026',
      passwordHash: hashPassword('Act#Aarav$2026!', 'salt_stud_101_cf2026'),
      mustChangePassword: true,
      isActive: true,
      passwordVersion: 1,
      createdAt: '2026-11-20T09:00:00.000Z',
      updatedAt: '2026-11-20T09:00:00.000Z',
    },
    {
      id: 'usr_student_102',
      email: 'bhavna.reddy@student.verimark.edu',
      name: 'Bhavna Reddy',
      role: 'STUDENT',
      studentRegNo: 'CF2026-CSE-102',
      passwordSalt: 'salt_stud_102_cf2026',
      passwordHash: hashPassword('Act#Bhavna$2026!', 'salt_stud_102_cf2026'),
      mustChangePassword: true,
      isActive: true,
      passwordVersion: 1,
      createdAt: '2026-11-20T09:00:00.000Z',
      updatedAt: '2026-11-20T09:00:00.000Z',
    },
    {
      id: 'usr_student_103',
      email: 'chetan.verma@student.verimark.edu',
      name: 'Chetan Verma',
      role: 'STUDENT',
      studentRegNo: 'CF2026-CSE-103',
      passwordSalt: 'salt_stud_103_cf2026',
      passwordHash: hashPassword('Act#Chetan$2026!', 'salt_stud_103_cf2026'),
      mustChangePassword: true,
      isActive: true,
      passwordVersion: 1,
      createdAt: '2026-11-20T09:00:00.000Z',
      updatedAt: '2026-11-20T09:00:00.000Z',
    },
    {
      id: 'usr_student_104',
      email: 'divya.nair@student.verimark.edu',
      name: 'Divya Nair',
      role: 'STUDENT',
      studentRegNo: 'CF2026-CSE-104',
      passwordSalt: 'salt_stud_104_cf2026',
      passwordHash: hashPassword('Act#Divya$2026!', 'salt_stud_104_cf2026'),
      mustChangePassword: true,
      isActive: true,
      passwordVersion: 1,
      createdAt: '2026-11-20T09:00:00.000Z',
      updatedAt: '2026-11-20T09:00:00.000Z',
    },
    {
      id: 'usr_student_105',
      email: 'eshan.roy@student.verimark.edu',
      name: 'Eshan Roy',
      role: 'STUDENT',
      studentRegNo: 'CF2026-CSE-105',
      passwordSalt: 'salt_stud_105_cf2026',
      passwordHash: hashPassword('Act#Eshan$2026!', 'salt_stud_105_cf2026'),
      mustChangePassword: true,
      isActive: true,
      passwordVersion: 1,
      createdAt: '2026-11-20T09:00:00.000Z',
      updatedAt: '2026-11-20T09:00:00.000Z',
    },
  ];
}

function safeWriteFileSync(filePath: string, data: string): void {
  const maxRetries = 10;
  for (let i = 0; i < maxRetries; i++) {
    try {
      fs.writeFileSync(filePath, data, { mode: 0o600 });
      return;
    } catch (err: any) {
      if (i === maxRetries - 1) throw err;
      const end = Date.now() + 25;
      while (Date.now() < end) {}
    }
  }
}

export function loadLocalUsers(): UserRecord[] {
  if (!fs.existsSync(VAULT_DIR)) {
    fs.mkdirSync(VAULT_DIR, { recursive: true });
  }

  if (fs.existsSync(DB_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      if (data && Array.isArray(data.users) && data.users.length > 0) {
        return data.users;
      }
    } catch {
      // Fall through to seed
    }
  }

  // Initialize and write seed users
  const seeds = getInitialSeedUsers();
  saveLocalUsers(seeds);
  return seeds;
}

function saveLocalUsers(users: UserRecord[]): void {
  if (!fs.existsSync(VAULT_DIR)) {
    fs.mkdirSync(VAULT_DIR, { recursive: true });
  }

  let dbData: any = {};
  if (fs.existsSync(DB_FILE)) {
    try {
      dbData = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch {
      dbData = {};
    }
  }

  dbData.users = users;
  safeWriteFileSync(DB_FILE, JSON.stringify(dbData, null, 2));
}

function getSupabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key && url.startsWith('http') && !url.includes('your-project')) {
    try {
      return createClient(url, key);
    } catch {
      return null;
    }
  }
  return null;
}

export const userStore = {
  /**
   * Retrieves all user records (local vault or Supabase sync)
   */
  async getAllUsers(): Promise<UserRecord[]> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase.from('users').select('*');
        if (!error && data && data.length > 0) {
          return data.map((d: any) => ({
            id: d.id,
            email: d.email,
            name: d.name,
            role: d.role as UserRole,
            studentRegNo: d.student_reg_no || undefined,
            passwordHash: d.password_hash,
            passwordSalt: d.password_salt,
            mustChangePassword: Boolean(d.must_change_password),
            isActive: Boolean(d.is_active ?? true),
            passwordVersion: d.password_version || 1,
            createdAt: d.created_at,
            updatedAt: d.updated_at,
          }));
        }
      } catch {
        // Fall back to local vault
      }
    }
    return loadLocalUsers();
  },

  /**
   * Retrieves a user by their unique identifier
   */
  async getUserById(id: string): Promise<UserRecord | null> {
    const users = await this.getAllUsers();
    return users.find((u) => u.id === id) || null;
  },

  /**
   * Retrieves a user by their email address (case-insensitive)
   */
  async getUserByEmail(email: string): Promise<UserRecord | null> {
    const normalized = email.trim().toLowerCase();
    const users = await this.getAllUsers();
    return users.find((u) => u.email.toLowerCase() === normalized) || null;
  },

  /**
   * Retrieves a user by their student registration number
   */
  async getUserByRegNo(regNo: string): Promise<UserRecord | null> {
    const clean = regNo.trim().toUpperCase();
    const users = await this.getAllUsers();
    return users.find((u) => u.studentRegNo?.toUpperCase() === clean) || null;
  },

  /**
   * Updates fields for an existing user record and persists to disk / database
   */
  async updateUser(id: string, updates: Partial<UserRecord>): Promise<UserRecord> {
    const users = loadLocalUsers();
    const index = users.findIndex((u) => u.id === id);
    if (index === -1) {
      throw new Error(`User with ID ${id} not found`);
    }

    const updated: UserRecord = {
      ...users[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    users[index] = updated;
    saveLocalUsers(users);

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase
          .from('users')
          .update({
            email: updated.email,
            name: updated.name,
            role: updated.role,
            student_reg_no: updated.studentRegNo,
            password_hash: updated.passwordHash,
            password_salt: updated.passwordSalt,
            must_change_password: updated.mustChangePassword,
            is_active: updated.isActive,
            password_version: updated.passwordVersion,
            updated_at: updated.updatedAt,
          })
          .eq('id', id);
      } catch {
        // Local vault remains authoritative fallback
      }
    }

    return updated;
  },

  /**
   * Resets a user's password, generating a new salt, updating the hash,
   * incrementing passwordVersion to immediately invalidate existing sessions,
   * and optionally setting mustChangePassword.
   */
  async resetUserPassword(
    userId: string,
    newPassword: string,
    forceChangeOnNextLogin: boolean = true
  ): Promise<UserRecord> {
    const validation = validatePasswordStrength(newPassword);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    const newSalt = randomBytes(16).toString('hex');
    const newHash = hashPassword(newPassword, newSalt);

    return this.updateUser(userId, {
      passwordSalt: newSalt,
      passwordHash: newHash,
      mustChangePassword: forceChangeOnNextLogin,
      passwordVersion: (user.passwordVersion || 1) + 1,
    });
  },

  /**
   * Toggles an account active/inactive.
   * If deactivating, increments passwordVersion to immediately revoke active sessions.
   */
  async toggleUserActive(userId: string, isActive: boolean): Promise<UserRecord> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    return this.updateUser(userId, {
      isActive,
      passwordVersion: isActive ? user.passwordVersion : (user.passwordVersion || 1) + 1,
    });
  },

  /**
   * Resets the user directory back to original seed credentials. Used for automated testing.
   */
  resetUserStoreForTesting(): void {
    const seeds = getInitialSeedUsers();
    saveLocalUsers(seeds);
  },
};
