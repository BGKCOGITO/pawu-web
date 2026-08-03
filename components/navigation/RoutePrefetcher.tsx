"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const PRIMARY_ROUTES = [
  "/",
  "/map",
  "/pets",
  "/my-reservations",
  "/chat",
  "/account",
  "/notifications",
] as const;

export default function RoutePrefetcher() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const prefetch = () => {
      if (cancelled) return;
      for (const route of PRIMARY_ROUTES) router.prefetch(route);
    };

    const windowWithIdle = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    if (windowWithIdle.requestIdleCallback) {
      const handle = windowWithIdle.requestIdleCallback(prefetch, { timeout: 1_500 });
      return () => {
        cancelled = true;
        windowWithIdle.cancelIdleCallback?.(handle);
      };
    }

    const timer = window.setTimeout(prefetch, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [router]);

  return null;
}
