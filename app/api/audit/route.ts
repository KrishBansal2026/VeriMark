import { NextResponse } from 'next/server';
import { performSystemAudit } from '@/lib/audit/tamperDetector';
import { dbService } from '@/lib/storage/db';
import { requireAuth, AuthError } from '@/lib/server/auth';
import { resolveTenantContext } from '@/lib/server/tenantContext';

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
    const instId = resolveTenantContext(user, requestedInst);

    const report = await performSystemAudit(instId);
    const logs = await dbService.getAuditLogs(instId);

    return NextResponse.json({
      success: true,
      institutionId: instId,
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
