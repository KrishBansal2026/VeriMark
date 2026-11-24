import { NextResponse } from 'next/server';
import { dbService } from '@/lib/storage/db';
import { requireAuth, AuthError, hashPassword } from '@/lib/server/auth';
import { randomBytes } from 'crypto';

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request, ['ADMIN', 'INSTITUTION_ADMIN', 'SUPER_ADMIN']);

    const url = new URL(request.url);
    const requestedInst = url.searchParams.get('institutionId');
    const instId =
      user.role === 'SUPER_ADMIN' && requestedInst
        ? requestedInst
        : user.institutionId || 'inst_verimark_01';

    const users = await dbService.getUsers(instId);

    // Strictly never return password hashes or salts
    const sanitized = users.map((u) => ({
      id: u.id,
      institutionId: u.institutionId,
      email: u.email,
      name: u.name,
      role: u.role,
      studentRegNo: u.studentRegNo,
      mustChangePassword: u.mustChangePassword,
      isActive: u.isActive !== false,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));

    return NextResponse.json({
      success: true,
      institutionId: instId,
      users: sanitized,
      total: sanitized.length,
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const adminUser = await requireAuth(request, ['ADMIN', 'INSTITUTION_ADMIN', 'SUPER_ADMIN']);
    const body = await request.json();

    if (!body.email || !body.name || !body.role) {
      return NextResponse.json(
        { success: false, error: 'Email, full name, and role are mandatory' },
        { status: 400 }
      );
    }

    const instId =
      adminUser.role === 'SUPER_ADMIN' && body.institutionId
        ? body.institutionId
        : adminUser.institutionId || 'inst_verimark_01';

    const existing = await dbService.getUserByEmail(body.email);
    if (existing) {
      return NextResponse.json(
        { success: false, error: `User with email '${body.email}' already exists` },
        { status: 409 }
      );
    }

    // Generate secure temporary credential if not provided
    const tempPassword = body.initialPassword || `Act#${randomBytes(4).toString('hex')}2026!`;
    const salt = randomBytes(16).toString('hex');
    const passwordHash = hashPassword(tempPassword, salt);

    const newUser = await dbService.createUser({
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      institutionId: instId,
      email: body.email.trim().toLowerCase(),
      name: body.name.trim(),
      role: body.role,
      passwordHash,
      salt,
      studentRegNo: body.studentRegNo ? body.studentRegNo.trim().toUpperCase() : undefined,
      mustChangePassword: true,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await dbService.recordAuditLog({
      institutionId: instId,
      actorId: adminUser.id,
      actorName: adminUser.name,
      actorRole: adminUser.role,
      action: 'USER_PROVISIONED',
      entityType: 'USER',
      entityId: newUser.id,
      details: { email: newUser.email, role: newUser.role },
    });

    return NextResponse.json(
      {
        success: true,
        user: {
          id: newUser.id,
          institutionId: newUser.institutionId,
          email: newUser.email,
          name: newUser.name,
          role: newUser.role,
          studentRegNo: newUser.studentRegNo,
          mustChangePassword: newUser.mustChangePassword,
          isActive: newUser.isActive,
        },
        temporaryPassword: tempPassword,
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
