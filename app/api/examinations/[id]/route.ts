import { NextResponse } from 'next/server';
import { dbService } from '@/lib/storage/db';
import { requireAuth, AuthError } from '@/lib/server/auth';

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

    const body = await request.json();
    const updated = await dbService.updateExamination(params.id, body);

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Examination not found' }, { status: 404 });
    }

    await dbService.recordAuditLog({
      institutionId: updated.institutionId,
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: 'EXAM_UPDATED',
      entityType: 'EXAMINATION',
      entityId: updated.id,
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
