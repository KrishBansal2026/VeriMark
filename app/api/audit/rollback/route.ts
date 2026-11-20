import { NextResponse } from 'next/server';
import { dbService } from '@/lib/storage/db';

export async function POST() {
  try {
    const result = await dbService.rollbackToLastValidCheckpoint();
    return NextResponse.json({ success: true, message: result.message });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
