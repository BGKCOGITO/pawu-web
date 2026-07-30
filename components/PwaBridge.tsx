"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

const WEB_ONLY_PREFIXES = ["/hospital-admin", "/admin", "/super-admin", "/platform"];

function isStandaloneMode() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari legacy standalone flag
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export default function PwaBridge() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
        console.warn("PAWU service worker registration failed", error);
      });
    }
  }, []);

  useEffect(() => {
    if (!isStandaloneMode()) return;
    if (WEB_ONLY_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
      router.replace("/?source=app");
    }
  }, [pathname, router]);

  return null;
}
