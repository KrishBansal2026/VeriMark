import { NextResponse } from 'next/server';
import { dbService } from '@/lib/storage/db';
import { requireAuth, AuthError } from '@/lib/server/auth';
import { resolveTenantContext } from '@/lib/server/tenantContext';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request);
    const instId = resolveTenantContext(user, params.id);

    const institution = await dbService.getInstitutionById(instId);
    if (!institution) {
      return NextResponse.json({ success: false, error: 'Institution not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, institution });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request, ['SUPER_ADMIN', 'INSTITUTION_ADMIN', 'ADMIN']);
    const targetInstId = resolveTenantContext(user, params.id);

    const institution = await dbService.getInstitutionById(targetInstId);
    if (!institution) {
      return NextResponse.json({ success: false, error: 'Institution not found' }, { status: 404 });
    }

    const body = await request.json();

    // Only SUPER_ADMIN can modify status or code
    if ((body.status || body.code) && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Only Platform Super Admins can alter institution status or code' },
        { status: 403 }
      );
    }

    if (body.name) institution.name = body.name.trim();
    if (body.domain) institution.domain = body.domain.trim().toLowerCase();
    if (body.logoUrl !== undefined) institution.logoUrl = body.logoUrl;
    if (body.themeColor) institution.themeColor = body.themeColor;
    if (body.status && user.role === 'SUPER_ADMIN') institution.status = body.status;
    institution.updatedAt = new Date().toISOString();

    await dbService.recordAuditLog({
      institutionId: institution.id,
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: 'INSTITUTION_UPDATED',
      entityType: 'INSTITUTION',
      entityId: institution.id,
      details: body,
    });

    return NextResponse.json({ success: true, institution });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
