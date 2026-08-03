"use client";

import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

const SESSION_CACHE_TTL_MS = 15_000;

let cachedSession: Session | null | undefined;
let cachedAt = 0;
let sessionRequest: Promise<Session | null> | null = null;
let authListenerReady = false;

function ensureAuthListener() {
  if (authListenerReady || typeof window === "undefined") return;
  authListenerReady = true;

  supabase.auth.onAuthStateChange((_event, session) => {
    cachedSession = session;
    cachedAt = Date.now();
    sessionRequest = null;
  });
}

export async function getCachedSession(options?: { force?: boolean }): Promise<Session | null> {
  ensureAuthListener();

  const force = options?.force === true;
  const now = Date.now();

  if (!force && cachedSession !== undefined && now - cachedAt < SESSION_CACHE_TTL_MS) {
    return cachedSession;
  }

  if (!force && sessionRequest) return sessionRequest;

  sessionRequest = supabase.auth
    .getSession()
    .then(({ data }) => {
      cachedSession = data.session;
      cachedAt = Date.now();
      return data.session;
    })
    .finally(() => {
      sessionRequest = null;
    });

  return sessionRequest;
}

export function clearCachedSession() {
  cachedSession = undefined;
  cachedAt = 0;
  sessionRequest = null;
}
