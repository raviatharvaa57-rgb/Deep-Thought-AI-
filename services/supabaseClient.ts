import { createClient } from '@supabase/supabase-js';

// --- IMPORTANT ---
// To enable backend features like user login and persistent chat history,
// you must provide your own Supabase project credentials as environment variables.
//
// 1. Go to your Supabase project dashboard.
// 2. Navigate to 'Project Settings' > 'API'.
// 3. Copy the 'Project URL' and 'anon' 'public' key.
// 4. Set them as environment variables in your deployment environment:
//    - SUPABASE_URL
//    - SUPABASE_ANON_KEY
//
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  const errorMessage = `
    ********************************************************************************
    *                                                                              *
    *  WARNING: Supabase credentials are not set in environment variables.         *
    *  The application will load, but backend features like login, signup, and     *
    *  chat history will not work until you provide your own credentials.          *
    *                                                                              *
    *  Please set the SUPABASE_URL and SUPABASE_ANON_KEY environment variables.    *
    *                                                                              *
    ********************************************************************************
  `;
  
  console.warn(errorMessage);
}

// Provide placeholder values if environment variables are not set to allow the app to initialize,
// although Supabase functionality will not work.
export const supabase = createClient(
  supabaseUrl || 'https://example.supabase.co', 
  supabaseAnonKey || 'example-anon-key'
);
