import { NextResponse } from 'next/server';
import { dbService } from '@/lib/storage/db';

export async function GET() {
  try {
    await dbService.seedInitialData();
    const results = await dbService.getResults();
    const checkpoints = await dbService.getCheckpoints();
    const latestCheckpoint = checkpoints[checkpoints.length - 1] || null;

    return NextResponse.json({
      success: true,
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
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Server-side validation
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

    const newResult = await dbService.createResult({
      studentRegNo: body.studentRegNo,
      studentName: body.studentName,
      course: body.course,
      subject: body.subject,
      examName: body.examName,
      marksObtained: marksNum,
      maxMarks: maxMarksNum,
      publicationDate: body.publicationDate || new Date().toISOString(),
    });

    if (body.publishImmediately) {
      const { result, checkpoint } = await dbService.publishResult(newResult.id);
      return NextResponse.json({ success: true, result, checkpoint }, { status: 201 });
    }

    return NextResponse.json({ success: true, result: newResult }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
