"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

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
  const previousUnreadRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;

    async function loadUnread() {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        if (active) setUnreadCount(0);
        return;
      }

      const response = await fetch("/api/chat/unread-count", {
        headers: { authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const result = await response.json().catch(() => ({ count: 0 }));
      const nextCount = Number(result.count) || 0;

      if (active && previousUnreadRef.current !== null && nextCount > previousUnreadRef.current) {
        try {
          if (typeof Notification !== "undefined" && Notification.permission === "granted" && "serviceWorker" in navigator) {
            const registration = await navigator.serviceWorker.ready;
            await registration.showNotification("PAWU 새 병원 메시지", {
              body: "병원에서 새 채팅 메시지를 보냈습니다.",
              icon: "/icons/pawu-v903-192.png",
              badge: "/icons/pawu-v903-192.png",
              tag: "pawu-chat-message",
              data: { url: "/chat" },
              vibrate: [180, 80, 180],
            } as NotificationOptions);
          }

          const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
          if (AudioContextClass) {
            const context = new AudioContextClass();
            const oscillator = context.createOscillator();
            const gain = context.createGain();
            oscillator.frequency.value = 880;
            gain.gain.setValueAtTime(0.08, context.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.3);
            oscillator.connect(gain);
            gain.connect(context.destination);
            oscillator.start();
            oscillator.stop(context.currentTime + 0.3);
          }
        } catch {
          // 알림/소리 재생이 차단되어도 배지 갱신은 계속합니다.
        }
      }

      previousUnreadRef.current = nextCount;
      if (active) setUnreadCount(nextCount);
    }

    void loadUnread();

    // 메시지 INSERT를 감지해 배지와 앱 알림을 즉시 갱신합니다.
    const channel = supabase
      .channel("guardian-chat-unread-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        () => {
          if (active) void loadUnread();
        },
      )
      .subscribe();

    // Realtime이 지연되거나 절전 상태에서 복귀하는 경우를 위한 보조 주기입니다.
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadUnread();
    }, 3000);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") void loadUnread();
    };
    window.addEventListener("focus", handleVisibility);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", handleVisibility);
      document.removeEventListener("visibilitychange", handleVisibility);
      void supabase.removeChannel(channel);
    };
  }, [pathname]);

  return (
    <>
      <Link href="/chat" className={`guardian-chat-fab ${pathname.startsWith("/chat") ? "active" : ""}`} aria-label="병원 채팅">
        <span className="guardian-chat-fab-icon"><NavIcon name="chat" /></span>
        <span>채팅</span>
        {unreadCount > 0 && <strong>{unreadCount > 99 ? "99+" : unreadCount}</strong>}
      </Link>

      <nav className="guardian-bottom-nav"><div className="guardian-bottom-nav-inner">{items.map((item) => {
        const active = item.href === "/" ? pathname === "/" || pathname === "/dashboard" : pathname.startsWith(item.href);
        return <Link key={item.href} href={item.href} className={active ? "active" : ""}><span className="nav-icon"><NavIcon name={item.icon}/></span><span>{item.label}</span></Link>;
      })}</div></nav>
    </>
  );
}
