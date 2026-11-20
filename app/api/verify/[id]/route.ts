import { NextResponse } from 'next/server';
import { verifyResultCryptographically } from '@/lib/audit/publicVerifier';
import { getPublicKeys } from '@/lib/server/keys';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const verification = await verifyResultCryptographically(id);
    const publicKeys = getPublicKeys();

    return NextResponse.json({
      success: true,
      verification,
      publicKeys,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
