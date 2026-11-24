import { NextResponse } from 'next/server';
import { dbService } from '@/lib/storage/db';
import { requireAuth, AuthError } from '@/lib/server/auth';
import { resolveTenantContext } from '@/lib/server/tenantContext';

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request, ['STUDENT', 'ADMIN', 'INSTITUTION_ADMIN', 'SUPER_ADMIN']);

    const url = new URL(request.url);
    const requestedRegNo = url.searchParams.get('regNo');
    const requestedInst = url.searchParams.get('institutionId');

    let targetRegNo = user.studentRegNo;
    const instId = user.role === 'SUPER_ADMIN' ? requestedInst || user.institutionId : resolveTenantContext(user, requestedInst);

    // Strict Backend Ownership Enforcement
    if (user.role === 'STUDENT') {
      if (!user.studentRegNo) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: Student session is not bound to a valid registration number' },
          { status: 403 }
        );
      }
      if (requestedRegNo && requestedRegNo.trim().toUpperCase() !== user.studentRegNo.trim().toUpperCase()) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: You are not authorized to access correction audit records of another student' },
          { status: 403 }
        );
      }
      targetRegNo = user.studentRegNo;
    } else {
      targetRegNo = requestedRegNo || user.studentRegNo || 'CF2026-CSE-101';
    }

    if (!targetRegNo) {
      return NextResponse.json({ success: false, error: 'Registration number required' }, { status: 400 });
    }

    const corrections = await dbService.getCorrectionHistoryByStudentRegNo(targetRegNo, instId || undefined);

    return NextResponse.json({
      success: true,
      studentRegNo: targetRegNo,
      corrections,
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
