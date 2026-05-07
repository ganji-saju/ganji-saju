import { createBrowserClient } from '@supabase/ssr';
import type { User } from '@supabase/supabase-js';

const supabaseBrowserUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseBrowserKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const hasSupabaseBrowserEnv = Boolean(
  supabaseBrowserUrl && supabaseBrowserKey
);

export function createClient() {
  if (!hasSupabaseBrowserEnv) {
    throw new Error(
      'Supabase browser env is missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.'
    );
  }

  return createBrowserClient(
    supabaseBrowserUrl!,
    supabaseBrowserKey!
  );
}

export async function getCurrentBrowserUser(
  supabase: ReturnType<typeof createClient> = createClient()
): Promise<User | null> {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) return null;
    return data.user ?? null;
  } catch {
    return null;
  }
}
