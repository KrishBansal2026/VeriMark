import { NextResponse } from 'next/server';
import { dbService } from '@/lib/storage/db';
import { requireAuth, AuthError } from '@/lib/server/auth';
import { resolveTenantContext } from '@/lib/server/tenantContext';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request);
    const exam = await dbService.getExaminationById(params.id);

    if (!exam) {
      return NextResponse.json({ success: false, error: 'Examination not found' }, { status: 404 });
    }

    resolveTenantContext(user, exam.institutionId);

    return NextResponse.json({ success: true, examination: exam });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request, [
      'ADMIN',
      'INSTITUTION_ADMIN',
      'SUPER_ADMIN',
      'EXAM_CONTROLLER',
    ]);

    const exam = await dbService.getExaminationById(params.id);
    if (!exam) {
      return NextResponse.json({ success: false, error: 'Examination not found' }, { status: 404 });
    }

    resolveTenantContext(user, exam.institutionId);

    const body = await request.json();
    const updated = await dbService.updateExamination(params.id, body);

    await dbService.recordAuditLog({
      institutionId: exam.institutionId,
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: 'EXAM_UPDATED',
      entityType: 'EXAMINATION',
      entityId: exam.id,
      details: body,
    });

    return NextResponse.json({ success: true, examination: updated });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
