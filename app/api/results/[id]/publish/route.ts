import { NextResponse } from 'next/server';
import { dbService } from '@/lib/storage/db';
import { requireAuth, AuthError } from '@/lib/server/auth';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Phase 1: Authentication & Authorization (Admin only)
    await requireAuth(request, ['ADMIN']);

    const { id } = params;
    const { result, checkpoint } = await dbService.publishResult(id);
    return NextResponse.json({
      success: true,
      message: `Result for ${result.studentName} published and sealed in Checkpoint #${checkpoint.sequenceNumber}`,
      result,
      checkpoint,
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
