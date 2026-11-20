import { NextResponse } from 'next/server';
import { dbService } from '@/lib/storage/db';
import { ApproverRole } from '@/lib/types';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    const role = body.approverRole as ApproverRole;
    if (!role || (role !== 'EXAM_CONTROLLER' && role !== 'ACADEMIC_DEAN')) {
      return NextResponse.json(
        { success: false, error: 'Invalid approver role. Must be EXAM_CONTROLLER or ACADEMIC_DEAN' },
        { status: 400 }
      );
    }

    const { request: updatedRequest, applied } = await dbService.submitCorrectionApproval({
      requestId: id,
      approverRole: role,
      comments: body.comments,
    });

    return NextResponse.json({
      success: true,
      message: applied
        ? 'Both authorized signatures verified. Correction applied and sealed in a new signed checkpoint!'
        : `Approval from ${role} verified and signed. Awaiting second authorized approver.`,
      request: updatedRequest,
      applied,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
