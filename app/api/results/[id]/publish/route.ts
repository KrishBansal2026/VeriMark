import { NextResponse } from 'next/server';
import { dbService } from '@/lib/storage/db';
import { requireAuth, AuthError } from '@/lib/server/auth';
import { resolveTenantContext } from '@/lib/server/tenantContext';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request, ['ADMIN', 'INSTITUTION_ADMIN', 'SUPER_ADMIN']);

    const { id } = params;
    const target = await dbService.getResultById(id);
    if (!target) {
      return NextResponse.json({ success: false, error: 'Result not found' }, { status: 404 });
    }

    resolveTenantContext(user, target.institutionId);

    const { result, checkpoint } = await dbService.publishResult(id);
    return NextResponse.json({
      success: true,
      message: `Result for ${result.studentName} published and sealed in Checkpoint #${checkpoint.sequenceNumber}`,
      result,
      checkpoint,
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
