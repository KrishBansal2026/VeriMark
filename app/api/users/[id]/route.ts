import { NextResponse } from 'next/server';
import { dbService } from '@/lib/storage/db';
import { requireAuth, AuthError, hashPassword } from '@/lib/server/auth';
import { randomBytes } from 'crypto';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const adminUser = await requireAuth(request, ['ADMIN', 'INSTITUTION_ADMIN', 'SUPER_ADMIN']);
    const body = await request.json();

    const targetUser = await dbService.getUserById(params.id);
    if (!targetUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Toggle active status
    if (typeof body.isActive === 'boolean') {
      await dbService.updateUserStatus(targetUser.id, body.isActive);
      await dbService.recordAuditLog({
        institutionId: targetUser.institutionId,
        actorId: adminUser.id,
        actorName: adminUser.name,
        actorRole: adminUser.role,
        action: body.isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
        entityType: 'USER',
        entityId: targetUser.id,
      });
    }

    // Reset password administratively
    let newTempPassword: string | null = null;
    if (body.resetPassword) {
      newTempPassword = `Rst#${randomBytes(4).toString('hex')}2026!`;
      const newSalt = randomBytes(16).toString('hex');
      const newHash = hashPassword(newTempPassword, newSalt);

      await dbService.updateUserPassword(targetUser.id, newHash, newSalt);

      // Force change password on next login
      targetUser.mustChangePassword = true;

      await dbService.recordAuditLog({
        institutionId: targetUser.institutionId,
        actorId: adminUser.id,
        actorName: adminUser.name,
        actorRole: adminUser.role,
        action: 'USER_PASSWORD_RESET_ADMIN',
        entityType: 'USER',
        entityId: targetUser.id,
      });
    }

    const updatedUser = await dbService.getUserById(targetUser.id);

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser?.id,
        institutionId: updatedUser?.institutionId,
        email: updatedUser?.email,
        name: updatedUser?.name,
        role: updatedUser?.role,
        isActive: updatedUser?.isActive !== false,
        mustChangePassword: updatedUser?.mustChangePassword,
      },
      temporaryPassword: newTempPassword,
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
