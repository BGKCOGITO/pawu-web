"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCachedSession } from "@/lib/client-auth-session-cache";
import { getOrLoadClientData, invalidateClientCache } from "@/lib/client-query-cache";

function NavIcon({ name }: { name: string }) {
  const p: Record<string, React.ReactNode> = {
    home: <><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></>,
    hospital: <><rect x="4" y="4" width="16" height="17" rx="3"/><path d="M12 8v6M9 11h6M9 21v-4h6v4"/></>,
    pets: <><circle cx="8" cy="8" r="2"/><circle cx="16" cy="8" r="2"/><circle cx="5.5" cy="13" r="1.8"/><circle cx="18.5" cy="13" r="1.8"/><path d="M8 19c0-3 2-5 4-5s4 2 4 5c0 1.7-1.8 2-4 2s-4-.3-4-2Z"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4.2 3.5-6 8-6s7.2 1.8 8 6"/></>,
    chat: <><path d="M21 12a8 8 0 0 1-8 8H7l-4 2 1.5-4A8 8 0 1 1 21 12Z"/><path d="M8 12h.01M12 12h.01M16 12h.01"/></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{p[name]}</svg>;
}

const items = [
  { href: "/", label: "홈", icon: "home" },
  { href: "/map", label: "병원", icon: "hospital" },
  { href: "/pets", label: "아이들", icon: "pets" },
  { href: "/my-reservations", label: "예약", icon: "calendar" },
  { href: "/account", label: "내 정보", icon: "user" },
];

export default function GuardianBottomNav() {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);
  const requestInFlightRef = useRef(false);

  useEffect(() => {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function loadUnread() {
      if (requestInFlightRef.current) return;
      requestInFlightRef.current = true;
      try {
        const session = await getCachedSession();
        const token = session?.access_token;
        if (!token) {
          if (active) setUnreadCount(0);
          return;
        }

        const result = await getOrLoadClientData<{ count?: number }>({
          key: `guardian-unread:${session.user.id}`,
          ttlMs: 15_000,
          load: async () => {
            const response = await fetch("/api/chat/unread-count", {
              headers: { authorization: `Bearer ${token}` },
              cache: "no-store",
            });
            return response.json().catch(() => ({ count: 0 }));
          },
        });
        if (active) setUnreadCount(Number(result.count) || 0);
      } finally {
        requestInFlightRef.current = false;
      }
    }

    async function connectRealtime() {
      const session = await getCachedSession();
      const userId = session?.user.id;
      if (!userId || !active) return;

      channel = supabase
        .channel(`pawu-guardian-notifications-${userId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
          (payload) => {
            const notification = payload.new as { type?: string };
            if (notification.type === "chat_message") {
              invalidateClientCache(`guardian-unread:${userId}`);
              setUnreadCount((count) => count + 1);
            }
          },
        )
        .subscribe();
    }

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void loadUnread();
    };

    void loadUnread();
    void connectRealtime();
    const handleChatRead = () => {
      invalidateClientCache("guardian-unread:");
      void loadUnread();
    };

    window.addEventListener("pawu:chat-read", handleChatRead);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("focus", refreshWhenVisible);

    return () => {
      active = false;
      window.removeEventListener("pawu:chat-read", handleChatRead);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("focus", refreshWhenVisible);
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);

  const hideFloatingChat =
    pathname.startsWith("/health-notebook") ||
    pathname.startsWith("/health-insights") ||
    /\/pets\/[^/]+\/events\/(new|[^/]+\/edit)/.test(pathname);

  return (
    <>
      {!hideFloatingChat && (
        <Link href="/chat" className={`guardian-chat-fab ${pathname.startsWith("/chat") ? "active" : ""}`} aria-label="병원 채팅" title="병원 채팅">
          <span className="guardian-chat-fab-icon"><NavIcon name="chat" /></span>
          <span className="sr-only">채팅</span>
          {unreadCount > 0 && <strong>{unreadCount > 99 ? "99+" : unreadCount}</strong>}
        </Link>
      )}

      <nav className="guardian-bottom-nav"><div className="guardian-bottom-nav-inner">{items.map((item) => {
        const active = item.href === "/" ? pathname === "/" || pathname === "/dashboard" : pathname.startsWith(item.href);
        return <Link key={item.href} href={item.href} className={active ? "active" : ""}><span className="nav-icon"><NavIcon name={item.icon}/></span><span>{item.label}</span></Link>;
      })}</div></nav>
    </>
  );
}
