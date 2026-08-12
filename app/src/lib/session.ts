import type { User } from '@supabase/supabase-js';

export type SessionReader = {
  getSession(): Promise<{
    data: { session: { user: User } | null };
    error: { message: string } | null;
  }>;
};

/**
 * Read the browser's persisted session for routine workspace refreshes.
 * Database RLS remains the authority for every data request. Unlike getUser(),
 * this local read does not turn a brief Auth API outage into a visual sign-out.
 */
export async function persistedSessionUser(auth: SessionReader): Promise<User | null> {
  const { data, error } = await auth.getSession();
  if (error) throw new Error(`OJ could not read your saved session: ${error.message}`);
  return data.session?.user ?? null;
}
