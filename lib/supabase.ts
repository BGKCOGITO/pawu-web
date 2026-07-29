import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

function getSupabaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!value) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL 환경변수가 없습니다.",
    );
  }

  return value;
}

function getSupabasePublishableKey(): string {
  const value =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!value) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 또는 NEXT_PUBLIC_SUPABASE_ANON_KEY 환경변수가 없습니다.",
    );
  }

  return value;
}

const supabaseUrl: string = getSupabaseUrl();
const supabasePublishableKey: string =
  getSupabasePublishableKey();

declare global {
  var __pawuBrowserSupabase:
    | SupabaseClient
    | undefined;
}

function createBrowserSupabase(): SupabaseClient {
  return createClient(
    supabaseUrl,
    supabasePublishableKey,
    {
      auth: {
        flowType: "implicit",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "pawu-auth-session-v2",
      },
    },
  );
}

export const supabase =
  globalThis.__pawuBrowserSupabase ??
  createBrowserSupabase();

if (process.env.NODE_ENV !== "production") {
  globalThis.__pawuBrowserSupabase = supabase;
}
