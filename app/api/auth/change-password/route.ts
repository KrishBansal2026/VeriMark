import { NextResponse } from 'next/server';
import { requireAuth, changeUserPassword, AuthError } from '@/lib/server/auth';
import { checkRateLimit } from '@/lib/server/rateLimiter';

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    
    // Rate limit password change requests per user
    const rateCheck = checkRateLimit(`pwd_change:${user.id}`, 5, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many password change attempts. Please wait ${rateCheck.retryAfterSeconds} seconds before trying again.`,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(rateCheck.retryAfterSeconds) },
        }
      );
    }

    const body = await request.json();

    if (!body.currentPassword || !body.newPassword) {
      return NextResponse.json(
        { success: false, error: 'Current password and new password are required' },
        { status: 400 }
      );
    }

    const { user: updatedUser, token } = await changeUserPassword(
      user.id,
      body.currentPassword,
      body.newPassword
    );

    const response = NextResponse.json({
      success: true,
      message: 'Password successfully changed and account verified.',
      user: updatedUser,
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
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
