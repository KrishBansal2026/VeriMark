import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { dbService } from '@/lib/storage/db';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const result = await dbService.getResultById(id);
    if (!result) {
      return NextResponse.json({ success: false, error: 'Result not found' }, { status: 404 });
    }

    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const verifyUrl = `${protocol}://${host}/verify/${id}`;

    // Generate high quality QR code data URL
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 320,
      color: {
        dark: '#070d1e',
        light: '#ffffff',
      },
    });

    return NextResponse.json({
      success: true,
      verifyUrl,
      qrDataUrl,
      resultId: id,
      recordHash: result.recordHash,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
