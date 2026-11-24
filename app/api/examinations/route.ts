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
      'FACULTY',
    ]);

    const url = new URL(request.url);
    const requestedInst = url.searchParams.get('institutionId');
    const instId =
      user.role === 'SUPER_ADMIN' && requestedInst
        ? requestedInst
        : user.institutionId || 'inst_verimark_01';

    const examinations = await dbService.getExaminations(instId);
    const subjects = await dbService.getSubjects(instId);

    return NextResponse.json({
      success: true,
      institutionId: instId,
      examinations,
      subjects,
      total: examinations.length,
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
    const user = await requireAuth(request, [
      'ADMIN',
      'INSTITUTION_ADMIN',
      'SUPER_ADMIN',
      'EXAM_CONTROLLER',
    ]);

    const body = await request.json();
    const instId =
      user.role === 'SUPER_ADMIN' && body.institutionId
        ? body.institutionId
        : user.institutionId || 'inst_verimark_01';

    if (!body.examCode || !body.examName || !body.semester || !body.academicYear || !body.conductedDate) {
      return NextResponse.json(
        { success: false, error: 'Exam code, exam name, semester, academic year, and conducted date are mandatory' },
        { status: 400 }
      );
    }

    const newExam = await dbService.createExamination({
      institutionId: instId,
      examCode: body.examCode.trim().toUpperCase(),
      examName: body.examName.trim(),
      semester: body.semester.trim(),
      academicYear: body.academicYear.trim(),
      department: body.department ? body.department.trim() : 'Computer Science & Engineering',
      status: body.status || 'published',
      conductedDate: body.conductedDate,
    });

    await dbService.recordAuditLog({
      institutionId: instId,
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: 'EXAM_CREATED',
      entityType: 'EXAMINATION',
      entityId: newExam.id,
      details: { examCode: newExam.examCode, examName: newExam.examName },
    });

    return NextResponse.json({ success: true, examination: newExam }, { status: 201 });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
