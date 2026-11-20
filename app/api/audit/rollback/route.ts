import { NextResponse } from 'next/server';
import { dbService } from '@/lib/storage/db';
import { requireAuth, AuthError } from '@/lib/server/auth';

export async function POST(request: Request) {
  try {
    // Phase 1: Authentication & Authorization (Admin only)
    await requireAuth(request, ['ADMIN']);

    const result = await dbService.rollbackToLastValidCheckpoint();
    return NextResponse.json({ success: true, message: result.message });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
