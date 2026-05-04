import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

function cleanEnv(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === '""' || trimmed === "''") return undefined;
  return trimmed;
}

function firstNonEmptyEnv(...keys: string[]) {
  for (const key of keys) {
    const value = cleanEnv(process.env[key]);
    if (value) return value;
  }
  return undefined;
}

export const supabaseServerUrl = firstNonEmptyEnv(
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_URL'
);
export const supabaseAnonKey = firstNonEmptyEnv(
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_ANON_KEY',
  'SUPABASE_PUBLISHABLE_KEY'
);
export const supabaseServiceRoleKey = firstNonEmptyEnv(
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SECRET_KEY'
);

export const hasSupabaseServerEnv = Boolean(supabaseServerUrl && supabaseAnonKey);

export const hasSupabaseServiceEnv = Boolean(
  hasSupabaseServerEnv && supabaseServiceRoleKey
);

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    supabaseServerUrl!,
    supabaseAnonKey!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}

export async function createServiceClient() {
  return createSupabaseClient(
    supabaseServerUrl!,
    supabaseServiceRoleKey!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

export function createPublicServerClient() {
  return createSupabaseClient(
    supabaseServerUrl!,
    supabaseAnonKey!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
