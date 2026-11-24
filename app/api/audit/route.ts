import { NextResponse } from 'next/server';
import { performSystemAudit } from '@/lib/audit/tamperDetector';
import { dbService } from '@/lib/storage/db';
import { requireAuth, AuthError } from '@/lib/server/auth';

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request, [
      'ADMIN',
      'INSTITUTION_ADMIN',
      'SUPER_ADMIN',
      'AUDITOR',
    ]);

    const url = new URL(request.url);
    const requestedInst = url.searchParams.get('institutionId');
    const instId =
      user.role === 'SUPER_ADMIN' && requestedInst
        ? requestedInst
        : user.institutionId || 'inst_verimark_01';

    const report = await performSystemAudit();
    const logs = await dbService.getAuditLogs(instId);

    return NextResponse.json({
      success: true,
      report,
      logs: logs.slice(0, 50),
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
