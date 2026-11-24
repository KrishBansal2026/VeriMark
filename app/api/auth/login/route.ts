import { NextResponse } from 'next/server';
import { authenticateCredentials, getDemoTokenForRole } from '@/lib/server/auth';
import { UserRole } from '@/lib/types';
import { checkRateLimit, resetRateLimit } from '@/lib/server/rateLimiter';
import { dbService } from '@/lib/storage/db';

export async function POST(request: Request) {
  const clientIp = (request.headers.get('x-forwarded-for') || '127.0.0.1').split(',')[0].trim();

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

    // Rate limiting check
    const rateLimitKey = `login:${clientIp}:${body.email.trim().toLowerCase()}`;
    const rateCheck = checkRateLimit(rateLimitKey, 15, 900);
    if (!rateCheck.allowed) {
      await dbService.recordAuditLog({
        actorId: 'anonymous',
        actorName: body.email.trim(),
        actorRole: 'ANONYMOUS',
        action: 'RATE_LIMIT_EXCEEDED',
        entityType: 'AUTH',
        details: { resetInSeconds: rateCheck.resetInSeconds },
        ipAddress: clientIp,
      });

      return NextResponse.json(
        {
          success: false,
          error: `Too many consecutive failed login attempts. Account temporarily locked for security. Please try again in ${rateCheck.resetInSeconds} seconds.`,
        },
        { status: 429 }
      );
    }

    const { user, token } = await authenticateCredentials(body.email, body.password);

    // Reset rate limit on successful credentials
    resetRateLimit(rateLimitKey);

    await dbService.recordAuditLog({
      institutionId: user.institutionId,
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: 'LOGIN_SUCCESS',
      entityType: 'SESSION',
      ipAddress: clientIp,
    });

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

    await dbService.recordAuditLog({
      actorId: 'anonymous',
      actorName: 'unknown',
      actorRole: 'ANONYMOUS',
      action: 'LOGIN_FAILED',
      entityType: 'SESSION',
      details: { error: error.message },
      ipAddress: clientIp,
    });

    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
