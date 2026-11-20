import { NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/server/auth';
import { userStore, toSafeUser } from '@/lib/storage/userStore';

export async function GET(request: Request) {
  try {
    // 1. Strictly enforce ADMIN role
    const adminUser = await requireAuth(request, ['ADMIN']);

    const { searchParams } = new URL(request.url);
    const query = (searchParams.get('search') || '').trim().toLowerCase();
    const roleFilter = (searchParams.get('role') || '').trim().toUpperCase();
    const statusFilter = (searchParams.get('status') || '').trim().toLowerCase();

    const allUsers = await userStore.getAllUsers();

    // 2. Filter users
    let filtered = allUsers;

    if (query) {
      filtered = filtered.filter(
        (u) =>
          u.name.toLowerCase().includes(query) ||
          u.email.toLowerCase().includes(query) ||
          (u.studentRegNo && u.studentRegNo.toLowerCase().includes(query))
      );
    }

    if (roleFilter && roleFilter !== 'ALL') {
      filtered = filtered.filter((u) => u.role === roleFilter);
    }

    if (statusFilter === 'active') {
      filtered = filtered.filter((u) => u.isActive);
    } else if (statusFilter === 'inactive') {
      filtered = filtered.filter((u) => !u.isActive);
    } else if (statusFilter === 'must_change') {
      filtered = filtered.filter((u) => u.mustChangePassword);
    }

    // 3. Map to SafeUserRecord ensuring no passwordHash or salt is ever returned
    const safeUsers = filtered.map(toSafeUser);

    return NextResponse.json({
      success: true,
      count: safeUsers.length,
      users: safeUsers,
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: error.message || 'Internal error' }, { status: 500 });
  }
}
