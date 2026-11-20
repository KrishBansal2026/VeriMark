import { NextResponse } from 'next/server';
import { dbService } from '@/lib/storage/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
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

    // Direct malicious database modification: modifies the marks without updating hash or ledger
    const tampered = await dbService.directTamperResult(target.id, 'marksObtained', newMarks);

    return NextResponse.json({
      success: true,
      message: `Direct database tampering simulated on student ${tampered.studentName} (${tampered.studentRegNo})! Marks changed from previous value to ${newMarks} directly in DB without ledger authorization.`,
      tamperedRecord: tampered,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
