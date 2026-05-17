import { createClient } from '@supabase/supabase-js'

// This client uses the service role key — only used server-side in API routes
// NEVER import this in client components
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
