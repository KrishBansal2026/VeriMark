import { NextResponse } from 'next/server';
import { getAuthenticatedUser, getAvailableDemoAccounts } from '@/lib/server/auth';

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    
    // In production, strictly never expose demo account directory
    const isDev = process.env.NODE_ENV !== 'production';
    const demoAccounts = isDev ? await getAvailableDemoAccounts() : [];

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
