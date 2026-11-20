import { NextResponse } from 'next/server';
import { authenticateCredentials, getDemoTokenForRole } from '@/lib/server/auth';
import { checkRateLimit } from '@/lib/server/rateLimiter';
import { UserRole } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Support quick demo role switch in local development mode only
    if (body.demoRole) {
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          {
            success: false,
            error: 'Forbidden: Demo role authentication is strictly disabled in production environments.',
          },
          { status: 403 }
        );
      }

      const demoAuth = getDemoTokenForRole(body.demoRole as UserRole, body.studentRegNo);
      const response = NextResponse.json({
        success: true,
        user: demoAuth.user,
        token: demoAuth.token,
      });

      // Set HTTP-Only session cookie
      response.cookies.set('verimark_session', demoAuth.token, {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/',
        maxAge: 86400, // 24 hours
      });

      return response;
    }

    if (!body.email || !body.password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1';
    const rateCheck = checkRateLimit(`login:${ip}:${body.email.toLowerCase().trim()}`, 5, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many login attempts. Please wait ${rateCheck.retryAfterSeconds} seconds before trying again.`,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(rateCheck.retryAfterSeconds) },
        }
      );
    }

    const { user, token } = await authenticateCredentials(body.email, body.password);

    const response = NextResponse.json({
      success: true,
      user,
      token,
    });

    response.cookies.set('verimark_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 86400,
    });

    return response;
  } catch (error: any) {
    const status = error.statusCode || 401;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
