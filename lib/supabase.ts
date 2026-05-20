import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Client-side — uses anon key (safe for browser)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Server-side — uses service role key (admin, never expose to browser)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)