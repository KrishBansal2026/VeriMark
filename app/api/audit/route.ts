import { NextResponse } from 'next/server';
import { performSystemAudit } from '@/lib/audit/tamperDetector';
import { requireAuth, AuthError } from '@/lib/server/auth';

export async function GET(request: Request) {
  try {
    // Phase 1: Authentication & Authorization (Admin or Auditor)
    await requireAuth(request, ['ADMIN', 'AUDITOR']);

    const report = await performSystemAudit();
    return NextResponse.json({ success: true, report });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
