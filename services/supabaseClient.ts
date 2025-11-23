
import { createClient } from '@supabase/supabase-js';

// --- IMPORTANT FOR SELF-HOSTING ---
// When deploying to Vercel/Netlify, accessing 'process.env' directly can cause the app to crash
// with "ReferenceError: process is not defined" if the build system doesn't polyfill it.
// Since we have removed Supabase functionality from the app, we are commenting this out
// to ensure your deployed site loads correctly.

/*
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

export const supabase = createClient(
  supabaseUrl || 'https://example.supabase.co', 
  supabaseAnonKey || 'example-anon-key'
);
*/

// Export a dummy object to satisfy any lingering imports, though none should exist.
export const supabase = {
    auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    }
} as any;
