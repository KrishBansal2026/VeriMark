import { NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/server/auth';
import { userStore, toSafeUser } from '@/lib/storage/userStore';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth(request, ['ADMIN']);
    const user = await userStore.getUserById(params.id);

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      user: toSafeUser(user),
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: error.message || 'Internal error' }, { status: 500 });
  }
}
