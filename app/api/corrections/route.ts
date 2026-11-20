import { NextResponse } from 'next/server';
import { dbService } from '@/lib/storage/db';

export async function GET() {
  try {
    const requests = await dbService.getCorrectionRequests();
    return NextResponse.json({ success: true, requests });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.resultId || body.proposedMarks === undefined || !body.reason) {
      return NextResponse.json(
        { success: false, error: 'Result ID, proposed marks, and a mandatory reason are required' },
        { status: 400 }
      );
    }

    const newRequest = await dbService.createCorrectionRequest({
      resultId: body.resultId,
      proposedMarks: Number(body.proposedMarks),
      reason: body.reason,
      requesterName: body.requesterName || 'Academic Administrator',
    });

    return NextResponse.json({ success: true, request: newRequest }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
