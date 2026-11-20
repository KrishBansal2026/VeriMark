import { NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/server/auth';
import { checkRateLimit } from '@/lib/server/rateLimiter';
import {
  userStore,
  toSafeUser,
  generateSecureTemporaryPassword,
  validatePasswordStrength,
} from '@/lib/storage/userStore';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Strictly enforce ADMIN authorization
    const adminUser = await requireAuth(request, ['ADMIN']);

    // 2. Rate limit administrative password resets (10 resets per 60 seconds per admin)
    const rateCheck = checkRateLimit(`admin_reset:${adminUser.id}`, 10, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many password reset requests. Please wait ${rateCheck.retryAfterSeconds} seconds before trying again.`,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(rateCheck.retryAfterSeconds) },
        }
      );
    }

    const targetUser = await userStore.getUserById(params.id);
    if (!targetUser) {
      return NextResponse.json({ success: false, error: 'Target user account not found' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    let finalPassword = '';

    if (body.generateTemporary || !body.newPassword) {
      finalPassword = generateSecureTemporaryPassword();
    } else {
      finalPassword = body.newPassword.trim();
      const validation = validatePasswordStrength(finalPassword);
      if (!validation.valid) {
        return NextResponse.json({ success: false, error: validation.error }, { status: 400 });
      }
    }

    const forceChange = body.forceChangeOnNextLogin !== false; // Default true

    // 3. Reset password in persistent store
    // Increments passwordVersion, which immediately invalidates all existing active sessions of this user
    const updatedUser = await userStore.resetUserPassword(targetUser.id, finalPassword, forceChange);

    return NextResponse.json({
      success: true,
      message: `Password successfully reset for ${updatedUser.name} (${updatedUser.email}). Existing sessions were invalidated.`,
      temporaryPassword: finalPassword,
      user: toSafeUser(updatedUser),
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: error.message || 'Password reset failed' }, { status: 400 });
  }
}
