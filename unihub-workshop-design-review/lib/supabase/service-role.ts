import { createClient } from '@supabase/supabase-js';

/**
 * Supabase client with Service Role Key for background tasks.
 * DANGER: This bypasses RLS. Use only in secure backend environments.
 */
export const supabaseServiceRole = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
