import { describe, it, expect } from 'vitest';
import { authenticateCredentials, STUDENT_USERS, verifySessionToken } from '@/lib/server/auth';
import { POST as loginRoute } from '@/app/api/auth/login/route';
import { dbService } from '@/lib/storage/db';

describe('Student Credentials & Authentication Verification', () => {
  const credentials = [
    {
      email: 'aarav.sharma@student.verimark.edu',
      password: 'Act#Aarav$2026!',
      expectedRegNo: 'CF2026-CSE-101',
      expectedName: 'Aarav Sharma',
    },
    {
      email: 'bhavna.reddy@student.verimark.edu',
      password: 'Act#Bhavna$2026!',
      expectedRegNo: 'CF2026-CSE-102',
      expectedName: 'Bhavna Reddy',
    },
    {
      email: 'chetan.verma@student.verimark.edu',
      password: 'Act#Chetan$2026!',
      expectedRegNo: 'CF2026-CSE-103',
      expectedName: 'Chetan Verma',
    },
    {
      email: 'divya.nair@student.verimark.edu',
      password: 'Act#Divya$2026!',
      expectedRegNo: 'CF2026-CSE-104',
      expectedName: 'Divya Nair',
    },
    {
      email: 'eshan.roy@student.verimark.edu',
      password: 'Act#Eshan$2026!',
      expectedRegNo: 'CF2026-CSE-105',
      expectedName: 'Eshan Roy',
    },
  ];

  it('All 5 student accounts exist in pre-provisioned STUDENT_USERS', () => {
    expect(STUDENT_USERS.length).toBe(5);
    for (const cred of credentials) {
      const found = STUDENT_USERS.find((u) => u.email.toLowerCase() === cred.email.toLowerCase());
      expect(found).toBeDefined();
      expect(found?.studentRegNo).toBe(cred.expectedRegNo);
      expect(found?.name).toBe(cred.expectedName);
      expect(found?.role).toBe('STUDENT');
      expect(found?.mustChangePassword).toBe(true);
    }
  });

  for (const cred of credentials) {
    it(`Direct authentication succeeds for ${cred.email}`, async () => {
      const auth = await authenticateCredentials(cred.email, cred.password);
      expect(auth.user.email).toBe(cred.email);
      expect(auth.user.name).toBe(cred.expectedName);
      expect(auth.user.studentRegNo).toBe(cred.expectedRegNo);
      expect(auth.user.role).toBe('STUDENT');
      expect(auth.user.mustChangePassword).toBe(true);

      const verified = verifySessionToken(auth.token);
      expect(verified).not.toBeNull();
      expect(verified?.email).toBe(cred.email);
    });

    it(`HTTP API Login (/api/auth/login) succeeds for ${cred.email}`, async () => {
      const req = new Request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cred.email,
          password: cred.password,
        }),
      });

      const res = await loginRoute(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.user.email).toBe(cred.email);
      expect(data.user.role).toBe('STUDENT');
      expect(data.user.studentRegNo).toBe(cred.expectedRegNo);
      expect(data.user.mustChangePassword).toBe(true);
      expect(typeof data.token).toBe('string');

      // Check cookie
      const cookie = res.cookies.get('verimark_session');
      expect(cookie).toBeDefined();
      expect(cookie?.value).toBe(data.token);
    });
  }

  it('Verifies database integrity: student records match directory without modifications', async () => {
    const results = await dbService.getResults();
    expect(results.length).toBeGreaterThanOrEqual(5);

    for (const cred of credentials) {
      const studentRecord = results.find((r) => r.studentRegNo === cred.expectedRegNo);
      expect(studentRecord).toBeDefined();
      expect(studentRecord?.studentName).toBe(cred.expectedName);
      expect(studentRecord?.status).toBe('published');
    }
  });
});
