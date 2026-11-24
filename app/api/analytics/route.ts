import { NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/server/auth';
import { getAcademicAnalyticsData, AnalyticsFilterParams } from '@/lib/server/analytics';
import { resolveTenantContext } from '@/lib/server/tenantContext';

export async function GET(request: Request) {
  try {
    // 1. Enforce strict role-based access control (STUDENT strictly forbidden)
    const user = await requireAuth(request, [
      'ADMIN',
      'INSTITUTION_ADMIN',
      'SUPER_ADMIN',
      'EXAM_CONTROLLER',
      'ACADEMIC_DEAN',
      'AUDITOR',
    ]);

    // 2. Parse query parameters
    const url = new URL(request.url);
    const requestedInst = url.searchParams.get('institutionId');
    const instId = resolveTenantContext(user, requestedInst);

    const params: AnalyticsFilterParams = {
      exam: url.searchParams.get('exam') || undefined,
      subject: url.searchParams.get('subject') || undefined,
      startDate: url.searchParams.get('startDate') || undefined,
      endDate: url.searchParams.get('endDate') || undefined,
      search: url.searchParams.get('search') || undefined,
    };

    // 3. Compute analytics with genuine database and cryptographic verification scoped to tenant
    const data = await getAcademicAnalyticsData(params, user.role, instId);

    return NextResponse.json({
      ...data,
      institutionId: instId,
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error computing analytics' },
      { status: 500 }
    );
  }
}
