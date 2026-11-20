import { NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/server/auth';
import { userStore, toSafeUser } from '@/lib/storage/userStore';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const adminUser = await requireAuth(request, ['ADMIN']);
    const targetUser = await userStore.getUserById(params.id);

    if (!targetUser) {
      return NextResponse.json({ success: false, error: 'Target user not found' }, { status: 404 });
    }

    const body = await request.json();
    if (typeof body.isActive !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'isActive boolean flag is required' },
        { status: 400 }
      );
    }

    // Safeguard: Prevent admin from deactivating their own account
    if (adminUser.id === targetUser.id && !body.isActive) {
      return NextResponse.json(
        { success: false, error: 'You cannot deactivate your own active Administrator account.' },
        { status: 400 }
      );
    }

    const updatedUser = await userStore.toggleUserActive(targetUser.id, body.isActive);

    return NextResponse.json({
      success: true,
      message: `Account for ${updatedUser.name} has been ${updatedUser.isActive ? 'activated' : 'deactivated'}.`,
      user: toSafeUser(updatedUser),
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: error.message || 'Status update failed' }, { status: 400 });
  }
}
