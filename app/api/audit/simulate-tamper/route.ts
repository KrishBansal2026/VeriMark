import { NextResponse } from 'next/server';
import { dbService } from '@/lib/storage/db';
import { requireAuth, AuthError } from '@/lib/server/auth';

export async function POST(request: Request) {
  try {
    // Phase 1: Authentication & Authorization (Admin or Auditor)
    await requireAuth(request, ['ADMIN', 'AUDITOR']);

    const body = await request.json().catch(() => ({}));
    const results = await dbService.getPublishedResults();

    if (results.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No published results available to tamper' },
        { status: 400 }
      );
    }

    const target = body.resultId
      ? results.find((r) => r.id === body.resultId) || results[0]
      : results[0];

    const newMarks = body.newMarks !== undefined ? Number(body.newMarks) : 99.5;

    // Direct malicious database modification simulation
    const tampered = await dbService.directTamperResult(target.id, 'marksObtained', newMarks);

    return NextResponse.json({
      success: true,
      message: `Direct database tampering simulated on student ${tampered.studentName} (${tampered.studentRegNo})! Marks changed from previous value to ${newMarks} directly in DB without ledger authorization.`,
      tamperedRecord: tampered,
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
