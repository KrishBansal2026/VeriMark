import { describe, it, expect, beforeEach } from 'vitest';
import {
  authenticateCredentials,
  changeUserPassword,
  createSessionToken,
  getAuthenticatedUser,
  getDemoTokenForRole,
  requireAuth,
} from '@/lib/server/auth';
import {
  userStore,
  generateSecureTemporaryPassword,
  validatePasswordStrength,
} from '@/lib/storage/userStore';
import { resetRateLimiterForTesting } from '@/lib/server/rateLimiter';
import { dbService } from '@/lib/storage/db';
import { GET as adminUsersRoute } from '@/app/api/admin/users/route';
import { POST as resetPasswordRoute } from '@/app/api/admin/users/[id]/reset-password/route';
import { PATCH as toggleStatusRoute } from '@/app/api/admin/users/[id]/status/route';
import { POST as loginRoute } from '@/app/api/auth/login/route';
import { POST as changePasswordRoute } from '@/app/api/auth/change-password/route';

describe('VeriMark Comprehensive User & Password Management Tests', () => {
  beforeEach(() => {
    resetRateLimiterForTesting();
    userStore.resetUserStoreForTesting();
  });

  describe('1. Admin Password Reset Capabilities', () => {
    it('1.1: Admin can reset a student password and generate a temporary password', async () => {
      const adminToken = getDemoTokenForRole('ADMIN').token;
      const student = await userStore.getUserByEmail('aarav.sharma@student.verimark.edu');
      expect(student).not.toBeNull();

      const req = new Request(`http://localhost:3000/api/admin/users/${student!.id}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          generateTemporary: true,
          forceChangeOnNextLogin: true,
        }),
      });

      const res = await resetPasswordRoute(req, { params: { id: student!.id } });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.temporaryPassword).toBeDefined();
      expect(typeof data.temporaryPassword).toBe('string');
      expect(data.temporaryPassword.length).toBeGreaterThanOrEqual(12);
      expect(data.user.mustChangePassword).toBe(true);

      // Verify that old password stops working
      await expect(
        authenticateCredentials('aarav.sharma@student.verimark.edu', 'Act#Aarav$2026!')
      ).rejects.toThrow(/Invalid credentials/i);

      // Verify that new temporary password authenticates successfully
      const { user: authUser } = await authenticateCredentials(
        'aarav.sharma@student.verimark.edu',
        data.temporaryPassword
      );
      expect(authUser.id).toBe(student!.id);
      expect(authUser.mustChangePassword).toBe(true);
    });

    it('1.2: Admin can specify custom temporary password fulfilling complexity policy', async () => {
      const adminToken = getDemoTokenForRole('ADMIN').token;
      const student = await userStore.getUserByEmail('bhavna.reddy@student.verimark.edu');
      expect(student).not.toBeNull();

      const customPass = 'CustomTemp#2026!Sec';
      const req = new Request(`http://localhost:3000/api/admin/users/${student!.id}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          newPassword: customPass,
          forceChangeOnNextLogin: true,
        }),
      });

      const res = await resetPasswordRoute(req, { params: { id: student!.id } });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.temporaryPassword).toBe(customPass);

      // Check login with custom password
      const { user: authUser } = await authenticateCredentials(
        'bhavna.reddy@student.verimark.edu',
        customPass
      );
      expect(authUser.id).toBe(student!.id);
    });

    it('1.3: Rejects custom password that fails 12-character minimum complexity', async () => {
      const adminToken = getDemoTokenForRole('ADMIN').token;
      const student = await userStore.getUserByEmail('chetan.verma@student.verimark.edu');

      const req = new Request(`http://localhost:3000/api/admin/users/${student!.id}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          newPassword: 'Short1!pass', // < 12 characters
        }),
      });

      const res = await resetPasswordRoute(req, { params: { id: student!.id } });
      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toMatch(/at least 12 characters/i);
    });
  });

  describe('2. Student Password Change & Self-Service', () => {
    it('2.1: Student can change their own password via /api/auth/change-password', async () => {
      const student = await userStore.getUserByEmail('divya.nair@student.verimark.edu');
      expect(student).not.toBeNull();

      // Authenticate with temporary password
      const { token } = await authenticateCredentials(
        'divya.nair@student.verimark.edu',
        'Act#Divya$2026!'
      );

      const newSecurePassword = 'MyPermanentPassword#2026!';
      const req = new Request('http://localhost:3000/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword: 'Act#Divya$2026!',
          newPassword: newSecurePassword,
        }),
      });

      const res = await changePasswordRoute(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.user.mustChangePassword).toBe(false);

      // Verify that old password fails
      await expect(
        authenticateCredentials('divya.nair@student.verimark.edu', 'Act#Divya$2026!')
      ).rejects.toThrow(/Invalid credentials/i);

      // Verify that new password succeeds
      const { user: updatedAuth } = await authenticateCredentials(
        'divya.nair@student.verimark.edu',
        newSecurePassword
      );
      expect(updatedAuth.id).toBe(student!.id);
      expect(updatedAuth.mustChangePassword).toBe(false);
    });

    it('2.2: Student cannot reset another student password (RBAC isolation)', async () => {
      const studentToken = getDemoTokenForRole('STUDENT', 'CF2026-CSE-101').token;
      const otherStudent = await userStore.getUserByEmail('eshan.roy@student.verimark.edu');

      const req = new Request(`http://localhost:3000/api/admin/users/${otherStudent!.id}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`,
        },
        body: JSON.stringify({ generateTemporary: true }),
      });

      const res = await resetPasswordRoute(req, { params: { id: otherStudent!.id } });
      // Should reject with 403 Forbidden
      expect(res.status).toBe(403);

      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toMatch(/Access denied.*ADMIN/i);
    });

    it('2.3: Student cannot access Admin User Management directory (/api/admin/users)', async () => {
      const studentToken = getDemoTokenForRole('STUDENT', 'CF2026-CSE-101').token;

      const req = new Request('http://localhost:3000/api/admin/users', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${studentToken}`,
        },
      });

      const res = await adminUsersRoute(req);
      expect(res.status).toBe(403);

      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toMatch(/Access denied.*ADMIN/i);
    });
  });

  describe('3. Session Invalidation & Revocation', () => {
    it('3.1: Administrative password reset invalidates all existing user session tokens', async () => {
      // 1. Student authenticates and gets a session token
      const { user: initialUser, token: initialToken } = await authenticateCredentials(
        'eshan.roy@student.verimark.edu',
        'Act#Eshan$2026!'
      );
      expect(initialToken).toBeDefined();

      // Verify session token is valid initially
      const reqBefore = new Request('http://localhost:3000/api/auth/me', {
        headers: { Authorization: `Bearer ${initialToken}` },
      });
      const authUserBefore = await getAuthenticatedUser(reqBefore);
      expect(authUserBefore).not.toBeNull();
      expect(authUserBefore?.id).toBe(initialUser.id);

      // 2. Admin performs an administrative password reset
      const adminToken = getDemoTokenForRole('ADMIN').token;
      const resetReq = new Request(
        `http://localhost:3000/api/admin/users/${initialUser.id}/reset-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({ generateTemporary: true }),
        }
      );
      const resetRes = await resetPasswordRoute(resetReq, { params: { id: initialUser.id } });
      expect(resetRes.status).toBe(200);

      // 3. Old session token must now be rejected as INVALID / REVOKED
      const reqAfter = new Request('http://localhost:3000/api/auth/me', {
        headers: { Authorization: `Bearer ${initialToken}` },
      });
      const authUserAfter = await getAuthenticatedUser(reqAfter);
      expect(authUserAfter).toBeNull();
    });

    it('3.2: Deactivating a user prevents authentication and invalidates sessions', async () => {
      const student = await userStore.getUserByEmail('aarav.sharma@student.verimark.edu');
      const { token: studentToken } = await authenticateCredentials(
        'aarav.sharma@student.verimark.edu',
        'Act#Aarav$2026!'
      );

      const adminToken = getDemoTokenForRole('ADMIN').token;

      // Admin deactivates the user
      const toggleReq = new Request(`http://localhost:3000/api/admin/users/${student!.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ isActive: false }),
      });

      const toggleRes = await toggleStatusRoute(toggleReq, { params: { id: student!.id } });
      expect(toggleRes.status).toBe(200);

      // Existing session token is immediately revoked
      const req = new Request('http://localhost:3000/api/auth/me', {
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      const authUser = await getAuthenticatedUser(req);
      expect(authUser).toBeNull();

      // New login attempts fail
      await expect(
        authenticateCredentials('aarav.sharma@student.verimark.edu', 'Act#Aarav$2026!')
      ).rejects.toThrow(/deactivated/i);
    });
  });

  describe('4. Persistence & Data Integrity Across Restarts', () => {
    it('4.1: Password changes survive server restart (reading fresh from storage)', async () => {
      const student = await userStore.getUserByEmail('chetan.verma@student.verimark.edu');
      const newPassword = 'PersistentPass#2026!Check';

      await userStore.resetUserPassword(student!.id, newPassword, false);

      // Simulate a cold server restart by instantiating a fresh query to userStore
      const freshUser = await userStore.getUserByEmail('chetan.verma@student.verimark.edu');
      expect(freshUser).not.toBeNull();
      expect(freshUser?.mustChangePassword).toBe(false);
      expect(freshUser?.passwordVersion).toBeGreaterThan(1);

      // Verify authentication works using the persisted credentials
      const auth = await authenticateCredentials('chetan.verma@student.verimark.edu', newPassword);
      expect(auth.user.id).toBe(student!.id);
    });

    it('4.2: Academic results and ledger data remain completely unmodified', async () => {
      const results = await dbService.getResults();
      expect(results.length).toBeGreaterThanOrEqual(5);

      const published = await dbService.getPublishedResults();
      expect(published.length).toBeGreaterThanOrEqual(5);

      const studentResult = results.find((r) => r.studentRegNo === 'CF2026-CSE-101');
      expect(studentResult).toBeDefined();
      expect(studentResult?.marksObtained).toBe(88);
      expect(studentResult?.maxMarks).toBe(100);
      expect(studentResult?.subject).toBe('Cryptography & Network Security');
      expect(studentResult?.recordHash).toBe(
        '2df321ced340a17e191b5a8486e6502281f0565a0d872172abfb445bf418b1e9'
      );
    });
  });

  describe('5. Security Exposure & Rate Limiting Verification', () => {
    it('5.1: Password hashes and salts are never returned in Admin API responses', async () => {
      const adminToken = getDemoTokenForRole('ADMIN').token;
      const req = new Request('http://localhost:3000/api/admin/users', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      const res = await adminUsersRoute(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.users.length).toBeGreaterThanOrEqual(9);

      for (const u of data.users) {
        expect(u.passwordHash).toBeUndefined();
        expect(u.passwordSalt).toBeUndefined();
        expect(u.salt).toBeUndefined();
        expect(u.id).toBeDefined();
        expect(u.email).toBeDefined();
        expect(u.name).toBeDefined();
        expect(u.role).toBeDefined();
      }
    });

    it('5.2: Rate limiting throttles excessive login failures', async () => {
      const testEmail = 'aarav.sharma@student.verimark.edu';

      // 5 consecutive requests
      for (let i = 0; i < 5; i++) {
        const req = new Request('http://localhost:3000/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-forwarded-for': '192.168.1.100',
          },
          body: JSON.stringify({ email: testEmail, password: 'WrongPassword123!' }),
        });
        await loginRoute(req);
      }

      // 6th request must trigger HTTP 429
      const req6 = new Request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '192.168.1.100',
        },
        body: JSON.stringify({ email: testEmail, password: 'WrongPassword123!' }),
      });
      const res6 = await loginRoute(req6);
      expect(res6.status).toBe(429);

      const data6 = await res6.json();
      expect(data6.success).toBe(false);
      expect(data6.error).toMatch(/Too many login attempts/i);
    });
  });
});
