import { NextResponse } from 'next/server';
import { dbService } from '@/lib/storage/db';
import { getPublicKeys } from '@/lib/server/keys';
import { getIndependentCheckpoints } from '@/lib/storage/independentCheckpointStore';

export async function GET() {
  try {
    await dbService.seedInitialData();
    const events = await dbService.getLedgerEvents();
    const checkpoints = await dbService.getCheckpoints();
    const independentCheckpoints = await getIndependentCheckpoints();
    const publishedResults = await dbService.getPublishedResults();
    const publicKeys = getPublicKeys();

    return NextResponse.json({
      success: true,
      events,
      checkpoints,
      independentCheckpoints,
      publishedResultsCount: publishedResults.length,
      publicKeys,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
