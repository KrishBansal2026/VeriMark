import { NextResponse } from 'next/server';
import { performSystemAudit } from '@/lib/audit/tamperDetector';

export async function GET() {
  try {
    const report = await performSystemAudit();
    return NextResponse.json({ success: true, report });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
