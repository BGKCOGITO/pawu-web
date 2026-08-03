"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const PRIMARY_ROUTES = ["/", "/map", "/pets", "/my-reservations", "/account"] as const;
const SECONDARY_ROUTES = ["/chat", "/notifications"] as const;

type NetworkInformationLike = {
  saveData?: boolean;
  effectiveType?: string;
};

export default function RoutePrefetcher() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const connection = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
    const constrainedNetwork =
      connection?.saveData === true || connection?.effectiveType === "slow-2g" || connection?.effectiveType === "2g";

    if (constrainedNetwork) return;

    const run = (routes: readonly string[]) => {
      if (cancelled || document.visibilityState !== "visible") return;
      for (const route of routes) router.prefetch(route);
    };

    const windowWithIdle = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    let primaryHandle: number | undefined;
    let secondaryTimer: number | undefined;

    if (windowWithIdle.requestIdleCallback) {
      primaryHandle = windowWithIdle.requestIdleCallback(() => run(PRIMARY_ROUTES), { timeout: 1_800 });
    } else {
      primaryHandle = window.setTimeout(() => run(PRIMARY_ROUTES), 700);
    }

    secondaryTimer = window.setTimeout(() => run(SECONDARY_ROUTES), 3_500);

    return () => {
      cancelled = true;
      if (primaryHandle !== undefined) {
        if (windowWithIdle.cancelIdleCallback && windowWithIdle.requestIdleCallback) {
          windowWithIdle.cancelIdleCallback(primaryHandle);
        } else {
          window.clearTimeout(primaryHandle);
        }
      }
      if (secondaryTimer !== undefined) window.clearTimeout(secondaryTimer);
    };
  }, [router]);

  return null;
}
