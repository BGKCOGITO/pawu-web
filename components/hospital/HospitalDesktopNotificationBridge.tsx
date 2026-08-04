"use client";

import { useEffect, useRef } from "react";
import { hospitalAuthFetch } from "@/lib/hospital-auth-fetch";

type TauriInvoke = (
  command: string,
  args?: Record<string, unknown>,
) => Promise<unknown>;

type ConversationItem = {
  id: number;
  unread_count?: number;
  last_message_at?: string | null;
  last_message_preview?: string | null;
  reservation?: {
    guardian_name?: string | null;
  } | null;
  pet?: {
    name?: string | null;
  } | null;
};

type ReservationItem = {
  id: number;
  status?: string | null;
  created_at?: string | null;
  guardian_name?: string | null;
  pet_name?: string | null;
  reservation_date?: string | null;
  reservation_time?: string | null;
  visit_reason?: string | null;
  symptoms?: string | null;
};

function getInvoke(): TauriInvoke | null {
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

function clean(value: unknown, max = 140) {
  const text = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

async function notify(title: string, body: string) {
  const invoke = getInvoke();

  if (invoke) {
    await invoke("send_pawu_notification", {
      title: clean(title, 80),
      body: clean(body, 180),
    });
    return;
  }

  if (
    "Notification" in window &&
    Notification.permission === "granted"
  ) {
    new Notification(title, { body });
  }
}

function isRequested(status: string | null | undefined) {
  return [
    "requested",
    "request",
    "pending",
    "요청",
    "예약요청",
  ].includes(String(status ?? "").toLowerCase());
}

export default function HospitalDesktopNotificationBridge() {
  const initializedRef = useRef(false);
  const chatStateRef = useRef(new Map<number, {
    unread: number;
    lastMessageAt: string;
  }>());
  const reservationStateRef = useRef(new Map<number, string>());

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      try {
        const [chatResponse, reservationResponse] =
          await Promise.all([
            hospitalAuthFetch(
              "/api/hospital/chat/conversations",
              { cache: "no-store" },
            ),
            hospitalAuthFetch(
              "/api/hospital/reservations?status=all",
              { cache: "no-store" },
            ),
          ]);

        if (
          !chatResponse.ok ||
          !reservationResponse.ok ||
          cancelled
        ) {
          return;
        }

        const chatPayload = await chatResponse.json();
        const reservationPayload =
          await reservationResponse.json();

        const conversations = (
          chatPayload.conversations ?? []
        ) as ConversationItem[];
        const reservations = (
          reservationPayload.reservations ?? []
        ) as ReservationItem[];

        if (!initializedRef.current) {
          for (const item of conversations) {
            chatStateRef.current.set(Number(item.id), {
              unread: Number(item.unread_count ?? 0),
              lastMessageAt: String(
                item.last_message_at ?? "",
              ),
            });
          }

          for (const item of reservations) {
            reservationStateRef.current.set(
              Number(item.id),
              String(item.status ?? ""),
            );
          }

          initializedRef.current = true;

          if (
            getInvoke() &&
            sessionStorage.getItem(
              "pawu-hospital-notification-ready-v2",
            ) !== "1"
          ) {
            sessionStorage.setItem(
              "pawu-hospital-notification-ready-v2",
              "1",
            );
            await notify(
              "PAWU Hospital",
              "Windows 알림 연결이 완료되었습니다.",
            );
          }

          return;
        }

        for (const item of conversations) {
          const id = Number(item.id);
          const current = {
            unread: Number(item.unread_count ?? 0),
            lastMessageAt: String(
              item.last_message_at ?? "",
            ),
          };
          const previous = chatStateRef.current.get(id);

          if (
            previous &&
            (
              current.unread > previous.unread ||
              (
                current.unread > 0 &&
                current.lastMessageAt !==
                  previous.lastMessageAt
              )
            )
          ) {
            const guardian =
              item.reservation?.guardian_name?.trim() ||
              "보호자";
            const pet =
              item.pet?.name?.trim() || "반려동물";
            const preview =
              clean(item.last_message_preview) ||
              "새 메시지가 도착했습니다.";

            await notify(
              "PAWU Hospital · 새 보호자 채팅",
              `${guardian} · ${pet}\n${preview}`,
            );
          }

          chatStateRef.current.set(id, current);
        }

        for (const item of reservations) {
          const id = Number(item.id);
          const currentStatus = String(
            item.status ?? "",
          );
          const previousStatus =
            reservationStateRef.current.get(id);

          if (
            (
              previousStatus === undefined ||
              !isRequested(previousStatus)
            ) &&
            isRequested(currentStatus)
          ) {
            const guardian =
              item.guardian_name?.trim() || "보호자";
            const pet =
              item.pet_name?.trim() || "반려동물";
            const schedule = [
              item.reservation_date,
              String(
                item.reservation_time ?? "",
              ).slice(0, 5),
            ]
              .filter(Boolean)
              .join(" ");
            const reason =
              clean(
                item.visit_reason || item.symptoms,
                90,
              ) || "새 예약 요청이 접수되었습니다.";

            await notify(
              "PAWU Hospital · 새 예약 요청",
              `${guardian} · ${pet}${
                schedule ? ` · ${schedule}` : ""
              }\n${reason}`,
            );
          }

          reservationStateRef.current.set(
            id,
            currentStatus,
          );
        }
      } catch (error) {
        console.warn(
          "PAWU Hospital 알림 확인 실패:",
          error,
        );
      } finally {
        if (!cancelled) {
          timer = setTimeout(poll, 3000);
        }
      }
    }

    void poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  return null;
}
