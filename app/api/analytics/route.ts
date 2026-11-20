import { NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/server/auth';
import { getAcademicAnalyticsData, AnalyticsFilterParams } from '@/lib/server/analytics';

export async function GET(request: Request) {
  try {
    // 1. Enforce strict role-based access control (STUDENT strictly forbidden)
    const user = await requireAuth(request, [
      'ADMIN',
      'EXAM_CONTROLLER',
      'ACADEMIC_DEAN',
      'AUDITOR',
    ]);

    // 2. Parse query parameters
    const url = new URL(request.url);
    const params: AnalyticsFilterParams = {
      exam: url.searchParams.get('exam') || undefined,
      subject: url.searchParams.get('subject') || undefined,
      startDate: url.searchParams.get('startDate') || undefined,
      endDate: url.searchParams.get('endDate') || undefined,
      search: url.searchParams.get('search') || undefined,
    };

    // 3. Compute analytics with genuine database and cryptographic verification
    const data = await getAcademicAnalyticsData(params, user.role);

    return NextResponse.json(data);
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
