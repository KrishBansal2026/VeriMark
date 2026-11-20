import { NextResponse } from 'next/server';
import { requireAuth, changeUserPassword, AuthError } from '@/lib/server/auth';

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
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
