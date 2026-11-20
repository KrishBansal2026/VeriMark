import { NextResponse } from 'next/server';
import { getAuthenticatedUser, getAvailableDemoAccounts } from '@/lib/server/auth';

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    const demoAccounts = getAvailableDemoAccounts();

    return NextResponse.json({
      success: true,
      authenticated: !!user,
      user: user || null,
      availableAccounts: demoAccounts,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
