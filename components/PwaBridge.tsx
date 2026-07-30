"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const BLOCKED_APP_PATHS = ["/hospital-admin", "/admin", "/super-admin", "/platform"];

function isStandaloneMode() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export default function PwaBridge() {
  const pathname = usePathname();
  const router = useRouter();
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setInstalled(isStandaloneMode());

    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.error("PAWU service worker registration failed", error);
      });
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstallEvent(null);
      setInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    if (!installed || !BLOCKED_APP_PATHS.some((prefix) => pathname.startsWith(prefix))) return;
    router.replace("/");
  }, [installed, pathname, router]);

  if (installed || !installEvent || BLOCKED_APP_PATHS.some((prefix) => pathname.startsWith(prefix))) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={async () => {
        await installEvent.prompt();
        await installEvent.userChoice;
        setInstallEvent(null);
      }}
      className="fixed bottom-24 right-4 z-[80] rounded-full bg-[#174f45] px-5 py-3 text-sm font-bold text-white shadow-lg md:bottom-6"
      aria-label="PAWU 앱 설치"
    >
      PAWU 앱 설치
    </button>
  );
}
