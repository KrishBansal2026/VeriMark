import { NextResponse } from 'next/server';
import { dbService } from '@/lib/storage/db';
import { requireAuth, AuthError } from '@/lib/server/auth';

export async function GET(request: Request) {
  try {
    // Only authorized institutional staff can view the full correction request queue
    await requireAuth(request, ['ADMIN', 'EXAM_CONTROLLER', 'ACADEMIC_DEAN', 'AUDITOR']);
    const requests = await dbService.getCorrectionRequests();
    return NextResponse.json({ success: true, requests });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // Authenticated user (Admin or Institutional Officer)
    const user = await requireAuth(request, ['ADMIN', 'EXAM_CONTROLLER', 'ACADEMIC_DEAN']);

    const body = await request.json();

    if (!body.resultId || body.proposedMarks === undefined || !body.reason) {
      return NextResponse.json(
        { success: false, error: 'Result ID, proposed marks, and a mandatory reason are required' },
        { status: 400 }
      );
    }

    const newRequest = await dbService.createCorrectionRequest({
      resultId: body.resultId,
      proposedMarks: Number(body.proposedMarks),
      reason: body.reason,
      requester: user,
    });

    return NextResponse.json({ success: true, request: newRequest }, { status: 201 });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
