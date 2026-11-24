import { NextResponse } from 'next/server';
import { dbService } from '@/lib/storage/db';
import { requireAuth, AuthError } from '@/lib/server/auth';

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);

    if (user.role === 'SUPER_ADMIN') {
      const institutions = await dbService.getInstitutions();
      return NextResponse.json({ success: true, institutions });
    }

    // Institutional users only see their own institution
    const instId = user.institutionId || 'inst_verimark_01';
    const institution = await dbService.getInstitutionById(instId);

    return NextResponse.json({
      success: true,
      institutions: institution ? [institution] : [],
      currentInstitution: institution,
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // Only Super Admin can provision new institutions on the SaaS platform
    const user = await requireAuth(request, ['SUPER_ADMIN']);
    const body = await request.json();

    if (!body.name || !body.code || !body.domain) {
      return NextResponse.json(
        { success: false, error: 'Institution name, unique code, and domain are mandatory' },
        { status: 400 }
      );
    }

    const newInst = await dbService.createInstitution({
      code: body.code.trim().toUpperCase(),
      name: body.name.trim(),
      domain: body.domain.trim().toLowerCase(),
      logoUrl: body.logoUrl,
      themeColor: body.themeColor || '#0284c7',
      status: 'active',
    });

    await dbService.recordAuditLog({
      institutionId: newInst.id,
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: 'INSTITUTION_CREATED',
      entityType: 'INSTITUTION',
      entityId: newInst.id,
      details: { code: newInst.code, name: newInst.name },
    });

    return NextResponse.json({ success: true, institution: newInst }, { status: 201 });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
