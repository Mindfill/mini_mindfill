import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "placeholder";

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
    console.warn(
        "⚠️ Supabase credentials missing. Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local"
    );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
