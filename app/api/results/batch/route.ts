import { NextResponse } from 'next/server';
import { dbService } from '@/lib/storage/db';
import { requireAuth, AuthError } from '@/lib/server/auth';

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request, [
      'ADMIN',
      'INSTITUTION_ADMIN',
      'SUPER_ADMIN',
    ]);

    const body = await request.json();
    const items = body.items;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'A non-empty "items" array of student results is required' },
        { status: 400 }
      );
    }

    if (items.length > 500) {
      return NextResponse.json(
        { success: false, error: 'Batch limit exceeded. Maximum 500 records per upload.' },
        { status: 400 }
      );
    }

    const instId =
      user.role === 'SUPER_ADMIN' && body.institutionId
        ? body.institutionId
        : user.institutionId || 'inst_verimark_01';

    const createdResults = [];
    const errors: { index: number; regNo?: string; error: string }[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.studentRegNo || !item.studentName || !item.course || !item.subject || !item.examName) {
        errors.push({
          index: i,
          regNo: item.studentRegNo,
          error: 'Missing required student or examination fields',
        });
        continue;
      }

      const marksNum = Number(item.marksObtained);
      const maxMarksNum = Number(item.maxMarks ?? 100);

      if (isNaN(marksNum) || marksNum < 0 || marksNum > maxMarksNum) {
        errors.push({
          index: i,
          regNo: item.studentRegNo,
          error: `Marks obtained (${item.marksObtained}) must be between 0 and ${maxMarksNum}`,
        });
        continue;
      }

      try {
        const newResult = await dbService.createResult({
          institutionId: instId,
          examinationId: item.examinationId,
          studentRegNo: item.studentRegNo.trim(),
          studentName: item.studentName.trim(),
          course: item.course.trim(),
          subject: item.subject.trim(),
          examName: item.examName.trim(),
          marksObtained: marksNum,
          maxMarks: maxMarksNum,
          publicationDate: item.publicationDate || new Date().toISOString(),
        });

        if (item.publishImmediately !== false) {
          const { result } = await dbService.publishResult(newResult.id);
          createdResults.push(result);
        } else {
          createdResults.push(newResult);
        }
      } catch (err: any) {
        errors.push({
          index: i,
          regNo: item.studentRegNo,
          error: err.message || 'Failed to persist result record',
        });
      }
    }

    await dbService.recordAuditLog({
      institutionId: instId,
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: 'BATCH_RESULTS_IMPORTED',
      entityType: 'RESULT',
      details: {
        totalSubmitted: items.length,
        totalCreated: createdResults.length,
        totalErrors: errors.length,
      },
    });

    return NextResponse.json({
      success: true,
      count: createdResults.length,
      results: createdResults,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
