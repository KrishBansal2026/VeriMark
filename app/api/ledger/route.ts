import { NextResponse } from 'next/server';
import { dbService } from '@/lib/storage/db';
import { getPublicKeys } from '@/lib/server/keys';
import { getIndependentCheckpoints } from '@/lib/storage/independentCheckpointStore';
import { requireAuth, AuthError } from '@/lib/server/auth';

export async function GET(request: Request): Promise<NextResponse>;
export async function GET(): Promise<NextResponse>;
export async function GET(request?: Request): Promise<NextResponse> {
  try {
    let user = null;
    if (request) {
      user = await requireAuth(request, [
        'ADMIN',
        'INSTITUTION_ADMIN',
        'SUPER_ADMIN',
        'EXAM_CONTROLLER',
        'ACADEMIC_DEAN',
        'AUDITOR',
      ]);
    }

    await dbService.seedInitialData();

    const instId =
      user && user.role !== 'SUPER_ADMIN' ? user.institutionId || 'inst_verimark_01' : undefined;

    const events = await dbService.getLedgerEvents(instId);
    const checkpoints = await dbService.getCheckpoints(instId);
    const independentCheckpoints = await getIndependentCheckpoints();
    const publishedResults = await dbService.getPublishedResults(instId);
    const publicKeys = getPublicKeys();

    return NextResponse.json({
      success: true,
      institutionId: instId || 'ALL',
      events,
      checkpoints,
      independentCheckpoints,
      publishedResultsCount: publishedResults.length,
      publicKeys,
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
