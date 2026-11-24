import { NextResponse } from 'next/server';
import { dbService } from '@/lib/storage/db';
import { requireAuth, AuthError } from '@/lib/server/auth';
import { resolveTenantContext, enforceStudentOwnership } from '@/lib/server/tenantContext';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request);
    const student = await dbService.getStudentById(params.id);

    if (!student) {
      return NextResponse.json({ success: false, error: 'Student not found' }, { status: 404 });
    }

    // Cross-tenant guard
    resolveTenantContext(user, student.institutionId);

    // Student ownership guard
    if (user.role === 'STUDENT') {
      enforceStudentOwnership(user, student.regNo);
    }

    return NextResponse.json({ success: true, student });
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

    const student = await dbService.getStudentById(params.id);
    if (!student) {
      return NextResponse.json({ success: false, error: 'Student not found' }, { status: 404 });
    }

    // Cross-tenant boundary check
    resolveTenantContext(user, student.institutionId);

    const body = await request.json();
    const updated = await dbService.updateStudent(params.id, body);

    await dbService.recordAuditLog({
      institutionId: student.institutionId,
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: 'STUDENT_UPDATED',
      entityType: 'STUDENT',
      entityId: student.id,
      details: body,
    });

    return NextResponse.json({ success: true, student: updated });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
