import { NextResponse } from 'next/server';
import { dbService } from '@/lib/storage/db';
import { requireAuth, AuthError } from '@/lib/server/auth';
import { resolveTenantContext } from '@/lib/server/tenantContext';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Phase 1 & 2: Authenticated approver required. Identity derived strictly from session.
    const user = await requireAuth(request, ['EXAM_CONTROLLER', 'ACADEMIC_DEAN']);

    const { id } = params;
    const targetReq = await dbService.getCorrectionRequestById(id);
    if (!targetReq) {
      return NextResponse.json({ success: false, error: 'Correction request not found' }, { status: 404 });
    }

    // Strict cross-tenant check: approver must belong to the same institution
    resolveTenantContext(user, targetReq.institutionId);

    const body = await request.json().catch(() => ({}));

    // Server-enforced approval using verified session user
    const { request: updatedRequest, applied } = await dbService.submitCorrectionApproval({
      requestId: id,
      authUser: user,
      comments: body.comments,
    });

    return NextResponse.json({
      success: true,
      message: applied
        ? 'Both authorized signatures verified. Correction applied and sealed in a new signed checkpoint!'
        : `Approval from ${user.name} (${user.role}) verified and signed. Awaiting second authorized approver.`,
      request: updatedRequest,
      applied,
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
