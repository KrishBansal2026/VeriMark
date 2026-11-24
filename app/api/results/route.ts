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

    await dbService.seedInitialData();

    const url = new URL(request.url);
    const requestedInst = url.searchParams.get('institutionId');
    const instId = user.role === 'SUPER_ADMIN' && requestedInst ? requestedInst : user.institutionId || 'inst_verimark_01';

    const results = await dbService.getResults(instId);
    const checkpoints = await dbService.getCheckpoints(instId);
    const latestCheckpoint = checkpoints[checkpoints.length - 1] || null;

    return NextResponse.json({
      success: true,
      institutionId: instId,
      results,
      stats: {
        total: results.length,
        published: results.filter((r) => r.status === 'published' || r.status === 'corrected').length,
        draft: results.filter((r) => r.status === 'draft').length,
        corrected: results.filter((r) => r.status === 'corrected').length,
        latestCheckpointSeq: latestCheckpoint?.sequenceNumber || 0,
        merkleRoot: latestCheckpoint?.merkleRoot || '',
      },
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
    ]);

    const body = await request.json();

    if (!body.studentRegNo || !body.studentName || !body.course || !body.subject || !body.examName) {
      return NextResponse.json(
        { success: false, error: 'All student and examination fields are mandatory' },
        { status: 400 }
      );
    }

    const marksNum = Number(body.marksObtained);
    const maxMarksNum = Number(body.maxMarks ?? 100);

    if (isNaN(marksNum) || marksNum < 0 || marksNum > maxMarksNum) {
      return NextResponse.json(
        { success: false, error: `Marks obtained must be between 0 and ${maxMarksNum}` },
        { status: 400 }
      );
    }

    const instId =
      user.role === 'SUPER_ADMIN' && body.institutionId
        ? body.institutionId
        : user.institutionId || 'inst_verimark_01';

    const newResult = await dbService.createResult({
      institutionId: instId,
      examinationId: body.examinationId,
      studentRegNo: body.studentRegNo,
      studentName: body.studentName,
      course: body.course,
      subject: body.subject,
      examName: body.examName,
      marksObtained: marksNum,
      maxMarks: maxMarksNum,
      publicationDate: body.publicationDate || new Date().toISOString(),
    });

    await dbService.recordAuditLog({
      institutionId: instId,
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: 'RESULT_CREATED',
      entityType: 'RESULT',
      entityId: newResult.id,
      details: {
        studentRegNo: newResult.studentRegNo,
        subject: newResult.subject,
        marksObtained: newResult.marksObtained,
      },
    });

    if (body.publishImmediately) {
      const { result, checkpoint } = await dbService.publishResult(newResult.id);
      return NextResponse.json({ success: true, result, checkpoint }, { status: 201 });
    }

    return NextResponse.json({ success: true, result: newResult }, { status: 201 });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
