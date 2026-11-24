import { NextResponse } from 'next/server';
import { dbService } from '@/lib/storage/db';
import { requireAuth, AuthError } from '@/lib/server/auth';

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request, [
      'ADMIN',
      'INSTITUTION_ADMIN',
      'SUPER_ADMIN',
      'EXAM_CONTROLLER',
      'ACADEMIC_DEAN',
      'AUDITOR',
    ]);

    const url = new URL(request.url);
    const requestedInst = url.searchParams.get('institutionId');
    const instId =
      user.role === 'SUPER_ADMIN' && requestedInst
        ? requestedInst
        : user.institutionId || 'inst_verimark_01';

    const requests = await dbService.getCorrectionRequests(instId);
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
    const user = await requireAuth(request, [
      'ADMIN',
      'INSTITUTION_ADMIN',
      'SUPER_ADMIN',
      'EXAM_CONTROLLER',
      'ACADEMIC_DEAN',
    ]);

    const body = await request.json();

    if (!body.resultId || body.proposedMarks === undefined || !body.reason) {
      return NextResponse.json(
        { success: false, error: 'Result ID, proposed marks, and a mandatory reason are required' },
        { status: 400 }
      );
    }

    const instId = user.institutionId || 'inst_verimark_01';

    const newRequest = await dbService.createCorrectionRequest({
      resultId: body.resultId,
      proposedMarks: Number(body.proposedMarks),
      reason: body.reason,
      requester: user,
      institutionId: instId,
    });

    await dbService.recordAuditLog({
      institutionId: instId,
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: 'CORRECTION_REQUESTED',
      entityType: 'CORRECTION',
      entityId: newRequest.id,
      details: {
        resultId: newRequest.resultId,
        originalMarks: newRequest.originalMarks,
        proposedMarks: newRequest.proposedMarks,
        reason: newRequest.reason,
      },
    });

    return NextResponse.json({ success: true, request: newRequest }, { status: 201 });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
