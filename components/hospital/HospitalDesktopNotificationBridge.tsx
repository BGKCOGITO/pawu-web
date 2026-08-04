"use client";

import { useEffect, useRef } from "react";
import { hospitalAuthFetch } from "@/lib/hospital-auth-fetch";
import { supabase } from "@/lib/supabase";

type TauriInvoke = (
  command: string,
  args?: Record<string, unknown>,
) => Promise<unknown>;

type ChatMessageRow = {
  id?: number;
  conversation_id?: number;
  sender_type?: string;
  content?: string | null;
};

type ReservationRow = {
  id?: number;
  hospital_id?: number;
  status?: string | null;
  guardian_name?: string | null;
  reservation_date?: string | null;
  reservation_time?: string | null;
  symptoms?: string | null;
  visit_reason?: string | null;
};

type ConversationItem = {
  id: number;
  unread_count?: number;
  last_message_preview?: string | null;
  reservation?: {
    guardian_name?: string | null;
  } | null;
  pet?: {
    name?: string | null;
  } | null;
};

function getTauriInvoke(): TauriInvoke | null {
  if (typeof window === "undefined") return null;

  const tauriWindow = window as Window & {
    __TAURI__?: {
      core?: {
        invoke?: TauriInvoke;
      };
    };
  };

  return tauriWindow.__TAURI__?.core?.invoke ?? null;
}

function compact(value: string | null | undefined, maxLength = 120) {
  const normalized = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return "";
  if (normalized.length <= maxLength) return normalized;

  return `${normalized.slice(0, maxLength - 1)}…`;
}

async function showDesktopNotification(
  title: string,
  body: string,
) {
  const safeTitle = compact(title, 80);
  const safeBody = compact(body, 160);

  if (!safeTitle || !safeBody) return;

  const invoke = getTauriInvoke();

  if (invoke) {
    try {
      await invoke("send_pawu_notification", {
        title: safeTitle,
        body: safeBody,
      });
      return;
    } catch (error) {
      console.warn(
        "PAWU Hospital Windows 알림 전송 실패:",
        error,
      );
    }
  }

  if (
    "Notification" in window &&
    Notification.permission === "granted"
  ) {
    new Notification(safeTitle, {
      body: safeBody,
      tag: `pawu-hospital-${Date.now()}`,
    });
  }
}

function isRequestedReservation(status: string | null | undefined) {
  const normalized = String(status ?? "").toLowerCase();

  return [
    "requested",
    "request",
    "pending",
    "예약요청",
    "요청",
  ].includes(normalized);
}

export default function HospitalDesktopNotificationBridge() {
  const notifiedKeysRef = useRef(new Set<string>());
  const hospitalIdRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    let chatChannel: ReturnType<typeof supabase.channel> | null = null;
    let reservationChannel: ReturnType<typeof supabase.channel> | null =
      null;

    function rememberOnce(key: string) {
      if (notifiedKeysRef.current.has(key)) return false;

      notifiedKeysRef.current.add(key);

      if (notifiedKeysRef.current.size > 300) {
        const first = notifiedKeysRef.current.values().next().value;

        if (first) {
          notifiedKeysRef.current.delete(first);
        }
      }

      return true;
    }

    async function notifyGuardianChat(row: ChatMessageRow) {
      if (
        row.sender_type !== "guardian" ||
        !row.conversation_id
      ) {
        return;
      }

      /*
       * 상세 채팅방에서는 기존 ConversationRoom 알림을 사용합니다.
       * 전역 알림과 중복되지 않도록 해당 경로만 제외합니다.
       */
      if (/^\/hospital-admin\/chat\/\d+/.test(window.location.pathname)) {
        return;
      }

      const key = `chat:${row.id ?? row.conversation_id}`;

      if (!rememberOnce(key)) return;

      try {
        const response = await hospitalAuthFetch(
          "/api/hospital/chat/conversations",
          { cache: "no-store" },
        );
        const result = await response.json();

        if (!response.ok || cancelled) return;

        const conversations = (
          result.conversations ?? []
        ) as ConversationItem[];

        const conversation = conversations.find(
          (item) => item.id === Number(row.conversation_id),
        );

        /*
         * 현재 로그인 병원의 대화가 아니면 목록 API에 포함되지 않습니다.
         * 다른 병원의 메시지 알림이 울리지 않도록 여기서 필터링합니다.
         */
        if (!conversation) return;

        const guardianName =
          conversation.reservation?.guardian_name?.trim() ||
          "보호자";
        const petName =
          conversation.pet?.name?.trim() || "반려동물";
        const message =
          compact(row.content) ||
          compact(conversation.last_message_preview) ||
          "보호자가 새 메시지를 보냈습니다.";

        await showDesktopNotification(
          "PAWU Hospital · 새 보호자 채팅",
          `${guardianName} · ${petName}\n${message}`,
        );
      } catch (error) {
        console.warn(
          "병원 채팅 Windows 알림 확인 실패:",
          error,
        );
      }
    }

    async function notifyReservation(row: ReservationRow) {
      if (
        !hospitalIdRef.current ||
        Number(row.hospital_id) !== hospitalIdRef.current ||
        !isRequestedReservation(row.status)
      ) {
        return;
      }

      const key = `reservation:${row.id ?? `${row.reservation_date}-${row.reservation_time}`}`;

      if (!rememberOnce(key)) return;

      const guardianName = row.guardian_name?.trim() || "보호자";
      const schedule = [
        row.reservation_date,
        String(row.reservation_time ?? "").slice(0, 5),
      ]
        .filter(Boolean)
        .join(" ");
      const reason =
        compact(row.visit_reason || row.symptoms, 80) ||
        "새 예약 요청이 접수되었습니다.";

      await showDesktopNotification(
        "PAWU Hospital · 새 예약 요청",
        `${guardianName}${schedule ? ` · ${schedule}` : ""}\n${reason}`,
      );
    }

    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session || cancelled) return;

      const { data: hospitalAdmin, error } = await supabase
        .from("hospital_admins")
        .select("hospital_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (
        error ||
        !hospitalAdmin?.hospital_id ||
        cancelled
      ) {
        if (error) {
          console.warn(
            "병원 Windows 알림용 병원 확인 실패:",
            error.message,
          );
        }
        return;
      }

      hospitalIdRef.current = Number(hospitalAdmin.hospital_id);

      chatChannel = supabase
        .channel(
          `pawu-hospital-desktop-chat-${session.user.id}-${crypto.randomUUID()}`,
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "chat_messages",
          },
          (payload) => {
            void notifyGuardianChat(
              payload.new as ChatMessageRow,
            );
          },
        )
        .subscribe();

      reservationChannel = supabase
        .channel(
          `pawu-hospital-desktop-reservation-${session.user.id}-${crypto.randomUUID()}`,
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "reservations",
            filter: `hospital_id=eq.${hospitalAdmin.hospital_id}`,
          },
          (payload) => {
            void notifyReservation(
              payload.new as ReservationRow,
            );
          },
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "reservations",
            filter: `hospital_id=eq.${hospitalAdmin.hospital_id}`,
          },
          (payload) => {
            const oldRow = payload.old as ReservationRow;
            const newRow = payload.new as ReservationRow;

            if (
              !isRequestedReservation(oldRow.status) &&
              isRequestedReservation(newRow.status)
            ) {
              void notifyReservation(newRow);
            }
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      hospitalIdRef.current = null;

      if (chatChannel) {
        void supabase.removeChannel(chatChannel);
      }

      if (reservationChannel) {
        void supabase.removeChannel(reservationChannel);
      }
    };
  }, []);

  return null;
}
