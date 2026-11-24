import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/server/auth';
import { dbService } from '@/lib/storage/db';
import { sha256 } from '@/lib/crypto/sha256';

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(/verimark_session=([^;]+)/);
    const token = match ? decodeURIComponent(match[1].trim()) : null;

    if (token && user) {
      const tokenHash = sha256(token);
      const expiresAt = new Date(Date.now() + 86400 * 1000).toISOString();
      await dbService.revokeToken(tokenHash, user.id, expiresAt);
      await dbService.recordAuditLog({
        institutionId: user.institutionId,
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        action: 'USER_LOGOUT',
        entityType: 'SESSION',
      });
    }

    const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
    response.cookies.set('verimark_session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    return response;
  } catch (err: any) {
    const response = NextResponse.json({ success: true, message: 'Logged out' });
    response.cookies.set('verimark_session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    return response;
  }
}
