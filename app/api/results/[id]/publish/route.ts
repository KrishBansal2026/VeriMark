import { NextResponse } from 'next/server';
import { dbService } from '@/lib/storage/db';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { result, checkpoint } = await dbService.publishResult(id);
    return NextResponse.json({
      success: true,
      message: `Result for ${result.studentName} published and sealed in Checkpoint #${checkpoint.sequenceNumber}`,
      result,
      checkpoint,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
