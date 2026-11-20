import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_SECRET = process.env.ADMIN_SECRET_TOKEN || 'verimark_session_hmac_secret_key_cf2026_production';

/**
 * Validates HMAC-SHA256 session token using the Web Crypto API
 * Fully compatible with Next.js Edge Runtime and Node.js
 */
async function verifySessionTokenEdge(token: string): Promise<any | null> {
  if (!token || typeof token !== 'string') return null;
  const parts = token.trim().split('.');
  if (parts.length !== 2) return null;

  const [payloadB64, signature] = parts;

  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(SESSION_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify']
    );

    const sigBytes = await crypto.subtle.sign('HMAC', key, enc.encode(payloadB64));
    const bytes = new Uint8Array(sigBytes);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const expectedSig = btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    if (signature !== expectedSig) {
      return null;
    }

    const payloadStr = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(payloadStr);

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Unconditionally Public Endpoints & Assets
  if (
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/access-denied') ||
    pathname.startsWith('/verify') ||
    pathname.startsWith('/api/verify') ||
    pathname.includes('/qr') ||
    pathname === '/api/auth/login' ||
    pathname === '/api/auth/logout' ||
    pathname === '/api/auth/me'
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get('verimark_session')?.value;
  const sessionUser = token ? await verifySessionTokenEdge(token) : null;

  // 2. Login Page Handling
  if (pathname === '/login') {
    if (sessionUser) {
      const target = sessionUser.role === 'STUDENT' ? '/student' : '/';
      return NextResponse.redirect(new URL(target, request.url));
    }
    return NextResponse.next();
  }

  // 3. Unauthenticated Access Rejection
  if (!sessionUser) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Valid authentication session required' },
        { status: 401 }
      );
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 4. Role-Based Access Control (RBAC) Enforcement
  const role: string = sessionUser.role;

  // Rule A: STUDENT Role Isolation
  if (role === 'STUDENT') {
    // Prohibit student access to institutional admin pages
    const isInstitutionalPage =
      pathname === '/' ||
      pathname === '/results' ||
      pathname === '/analytics' ||
      pathname.startsWith('/analytics') ||
      pathname === '/ledger' ||
      pathname === '/corrections' ||
      pathname === '/audit';

    if (isInstitutionalPage) {
      const deniedUrl = new URL('/access-denied', request.url);
      deniedUrl.searchParams.set('reason', 'student_restricted');
      deniedUrl.searchParams.set('path', pathname);
      return NextResponse.redirect(deniedUrl);
    }

    // Prohibit student access to institutional admin APIs
    const isInstitutionalApi =
      pathname.startsWith('/api/results') ||
      pathname.startsWith('/api/analytics') ||
      pathname.startsWith('/api/corrections') ||
      pathname.startsWith('/api/audit') ||
      pathname.startsWith('/api/ledger');

    if (isInstitutionalApi && !pathname.includes('/qr')) {
      return NextResponse.json(
        {
          success: false,
          error: "Forbidden: Student accounts are strictly restricted from institutional administrative APIs under Problem Statement H8 bylaws.",
        },
        { status: 403 }
      );
    }

    return NextResponse.next();
  }

  // Rule B: Institutional Role Isolation
  // Prohibit institutional staff from student-specific operational pages
  if (pathname.startsWith('/student')) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Specific institutional page privilege gates
  if (pathname === '/audit' || pathname.startsWith('/api/audit')) {
    if (role !== 'ADMIN' && role !== 'AUDITOR') {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { success: false, error: `Forbidden: Role '${role}' lacks audit authority` },
          { status: 403 }
        );
      }
      const deniedUrl = new URL('/access-denied', request.url);
      deniedUrl.searchParams.set('reason', 'role_unauthorized');
      deniedUrl.searchParams.set('path', pathname);
      return NextResponse.redirect(deniedUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
