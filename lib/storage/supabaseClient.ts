import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseAdmin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (supabaseAdmin) {
    return supabaseAdmin;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (
    !supabaseUrl ||
    !serviceRoleKey ||
    supabaseUrl.includes('your-project.supabase.co') ||
    serviceRoleKey.includes('your-supabase-service-role-key')
  ) {
    return null;
  }

  try {
    supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    return supabaseAdmin;
  } catch (err) {
    console.warn('[VeriMark Supabase] Warning: Unable to initialize Supabase client:', err);
    return null;
  }
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseAdmin() !== null;
}
