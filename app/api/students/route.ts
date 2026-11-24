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

    const search = (url.searchParams.get('search') || '').trim().toLowerCase();
    const department = url.searchParams.get('department') || '';
    const status = url.searchParams.get('status') || '';

    let students = await dbService.getStudents(instId);

    if (search) {
      students = students.filter(
        (s) =>
          s.fullName.toLowerCase().includes(search) ||
          s.regNo.toLowerCase().includes(search) ||
          s.email.toLowerCase().includes(search)
      );
    }

    if (department && department !== 'ALL') {
      students = students.filter((s) => s.department === department);
    }

    if (status && status !== 'ALL') {
      students = students.filter((s) => s.status === status);
    }

    return NextResponse.json({
      success: true,
      institutionId: instId,
      students,
      total: students.length,
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

    // Handle Bulk CSV/Batch Import
    if (Array.isArray(body.students)) {
      const results = [];
      const errors = [];

      for (let i = 0; i < body.students.length; i++) {
        const item = body.students[i];
        if (!item.regNo || !item.fullName || !item.email || !item.course) {
          errors.push(`Row ${i + 1}: Missing required fields (regNo, fullName, email, course)`);
          continue;
        }

        const existing = await dbService.getStudentByRegNo(item.regNo, instId);
        if (existing) {
          errors.push(`Row ${i + 1}: Student with Reg No ${item.regNo} already exists`);
          continue;
        }

        const created = await dbService.createStudent({
          institutionId: instId,
          regNo: item.regNo.trim().toUpperCase(),
          fullName: item.fullName.trim(),
          email: item.email.trim().toLowerCase(),
          course: item.course.trim(),
          department: item.department ? item.department.trim() : 'General Sciences',
          batchYear: item.batchYear ? item.batchYear.trim() : '2022-2026',
          status: 'active',
        });
        results.push(created);
      }

      await dbService.recordAuditLog({
        institutionId: instId,
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        action: 'STUDENTS_BULK_IMPORTED',
        entityType: 'STUDENT',
        details: { importedCount: results.length, errorsCount: errors.length },
      });

      return NextResponse.json({
        success: true,
        importedCount: results.length,
        errors,
        students: results,
      });
    }

    // Single student creation
    if (!body.regNo || !body.fullName || !body.email || !body.course || !body.department) {
      return NextResponse.json(
        { success: false, error: 'Registration number, full name, email, course, and department are mandatory' },
        { status: 400 }
      );
    }

    const existing = await dbService.getStudentByRegNo(body.regNo, instId);
    if (existing) {
      return NextResponse.json(
        { success: false, error: `Student with Registration No '${body.regNo}' already exists in this institution` },
        { status: 409 }
      );
    }

    const newStudent = await dbService.createStudent({
      institutionId: instId,
      regNo: body.regNo.trim().toUpperCase(),
      fullName: body.fullName.trim(),
      email: body.email.trim().toLowerCase(),
      course: body.course.trim(),
      department: body.department.trim(),
      batchYear: body.batchYear ? body.batchYear.trim() : '2022-2026',
      status: 'active',
    });

    await dbService.recordAuditLog({
      institutionId: instId,
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: 'STUDENT_CREATED',
      entityType: 'STUDENT',
      entityId: newStudent.id,
      details: { regNo: newStudent.regNo, name: newStudent.fullName },
    });

    return NextResponse.json({ success: true, student: newStudent }, { status: 201 });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
