"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type UpdateItem = {
  id: number;
  category: string;
  title: string;
  message: string;
  image_url: string | null;
  published_at: string;
  hospitalization_id: number;
  hospitals: any;
  pets: any;
};

type HospitalizationItem = {
  id: number;
  status: string;
  admission_reason: string | null;
  admitted_at: string;
  expected_discharge_at: string | null;
  discharged_at: string | null;
  updated_at: string | null;
  hospital: {
    name: string;
    phone: string | null;
    address: string | null;
  } | null;
  pet: {
    id: number | null;
    name: string;
    species: string | null;
    breed: string | null;
  } | null;
  update_count: number;
  latest_update_at: string | null;
};

const categoryLabel: Record<string, string> = {
  general: "입원 경과",
  meal: "식사",
  medication: "투약",
  condition: "상태",
  procedure: "처치",
  discharge: "퇴원 안내",
};

const activeStatuses = new Set([
  "planned",
  "admitted",
  "in_treatment",
  "recovering",
  "ready_for_discharge",
]);

const statusLabel: Record<string, string> = {
  planned: "입원 예정",
  admitted: "입원 중",
  in_treatment: "치료 중",
  recovering: "회복 중",
  ready_for_discharge: "퇴원 준비",
  discharged: "퇴원 완료",
  cancelled: "입원 취소",
};

function one(value: any) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString("ko-KR");
}

export default function InpatientUpdatesPage() {
  const [items, setItems] = useState<UpdateItem[]>([]);
  const [hospitalizations, setHospitalizations] = useState<HospitalizationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [liveNotice, setLiveNotice] = useState("");
  const accessTokenRef = useRef("");

  const load = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);

    try {
      const token = accessTokenRef.current;
      if (!token) return;

      const response = await fetch("/api/guardian/hospitalization-updates", {
        headers: { authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message ?? "입원 경과를 불러오지 못했습니다.");
      }

      setItems(result.updates ?? []);
      setHospitalizations(result.hospitalizations ?? []);
      setMessage("");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "입원 경과를 불러오지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) return;

      if (!session) {
        setMessage("로그인 후 확인할 수 있습니다.");
        setLoading(false);
        return;
      }

      accessTokenRef.current = session.access_token;
      await load(true);

      if (cancelled) return;

      const channelName = `guardian-inpatient-updates-${session.user.id}-${crypto.randomUUID()}`;

      channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "hospitalization_guardian_updates",
            filter: `guardian_user_id=eq.${session.user.id}`,
          },
          async (payload) => {
            await load(false);

            const row = payload.new as {
              title?: string;
              message?: string;
            };

            setLiveNotice(
              `새 입원 소식이 도착했습니다: ${row.title ?? "병원 소식"}`,
            );

            window.setTimeout(() => setLiveNotice(""), 5000);

            if (
              document.hidden &&
              "Notification" in window &&
              Notification.permission === "granted"
            ) {
              new Notification(row.title ?? "PAWU 입원 소식", {
                body:
                  row.message ??
                  "병원에서 새로운 입원 소식을 공유했습니다.",
              });
            }
          },
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "hospitalization_guardian_updates",
            filter: `guardian_user_id=eq.${session.user.id}`,
          },
          () => {
            void load(false);
          },
        );

      if (cancelled) {
        await supabase.removeChannel(channel);
        channel = null;
        return;
      }

      channel.subscribe();
    })();

    return () => {
      cancelled = true;

      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [load]);

  async function requestNotificationPermission() {
    if (!("Notification" in window)) {
      setLiveNotice("이 브라우저는 알림 기능을 지원하지 않습니다.");
      return;
    }

    const permission = await Notification.requestPermission();

    setLiveNotice(
      permission === "granted"
        ? "브라우저 알림이 켜졌습니다."
        : "브라우저 알림 권한이 허용되지 않았습니다.",
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-950">
      <div className="mx-auto max-w-3xl">
        <header className="mb-5">
          <Link href="/dashboard" className="text-sm font-bold text-slate-500">
            ← 홈으로
          </Link>

          <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black tracking-[0.18em] text-slate-500">
                PAWU LIVE INPATIENT UPDATES
              </p>
              <h1 className="mt-1 text-3xl font-black">입원 경과</h1>
              <p className="mt-2 text-sm text-slate-600">
                현재 입원 상태와 병원에서 공유한 식사·투약·처치·회복 소식을
                확인할 수 있습니다.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void requestNotificationPermission()}
              className="border border-slate-300 bg-white px-3 py-2 text-xs font-black"
            >
              브라우저 알림 켜기
            </button>
          </div>
        </header>

        {liveNotice && (
          <div className="mb-4 border border-cyan-300 bg-cyan-50 px-4 py-3 text-sm font-black text-cyan-900">
            {liveNotice}
          </div>
        )}

        {loading ? (
          <div className="border border-slate-300 bg-white p-12 text-center">
            불러오는 중입니다.
          </div>
        ) : message ? (
          <div className="border border-slate-300 bg-white p-8 text-center">
            {message}
          </div>
        ) : (
          <>
            <section className="mb-7">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-black tracking-[0.14em] text-slate-500">
                    HOSPITALIZATION STATUS
                  </p>
                  <h2 className="mt-1 text-xl font-black">입원 상태</h2>
                </div>
                <span className="text-xs font-bold text-slate-500">
                  총 {hospitalizations.length}건
                </span>
              </div>

              {hospitalizations.length === 0 ? (
                <div className="border border-slate-300 bg-white p-8 text-center text-slate-500">
                  확인할 수 있는 입원 기록이 없습니다.
                </div>
              ) : (
                <div className="space-y-3">
                  {hospitalizations.map((hospitalization) => {
                    const isActive = activeStatuses.has(hospitalization.status);
                    const isDischarged = hospitalization.status === "discharged";

                    return (
                      <article
                        key={hospitalization.id}
                        className={`border bg-white p-5 ${
                          isActive
                            ? "border-emerald-300"
                            : isDischarged
                              ? "border-blue-300"
                              : "border-slate-300"
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-black ${
                                isActive
                                  ? "bg-emerald-100 text-emerald-800"
                                  : isDischarged
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-slate-200 text-slate-700"
                              }`}
                            >
                              {statusLabel[hospitalization.status] ??
                                hospitalization.status}
                            </span>
                            <h3 className="mt-3 text-xl font-black">
                              {hospitalization.pet?.name ?? "반려동물"}
                            </h3>
                            <p className="mt-1 text-sm font-bold text-slate-600">
                              {hospitalization.hospital?.name ?? "동물병원"}
                            </p>
                          </div>

                          <div className="text-right text-xs text-slate-500">
                            <p>입원 {formatDate(hospitalization.admitted_at)}</p>
                            {hospitalization.discharged_at && (
                              <p className="mt-1 font-bold text-blue-700">
                                퇴원 {formatDate(hospitalization.discharged_at)}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 grid gap-2 border-t border-slate-200 pt-4 text-sm sm:grid-cols-2">
                          <p>
                            <span className="font-black">입원 사유</span>{" "}
                            <span className="text-slate-600">
                              {hospitalization.admission_reason ?? "-"}
                            </span>
                          </p>
                          <p>
                            <span className="font-black">공유된 경과</span>{" "}
                            <span className="text-slate-600">
                              {hospitalization.update_count}건
                            </span>
                          </p>
                          <p>
                            <span className="font-black">최근 소식</span>{" "}
                            <span className="text-slate-600">
                              {hospitalization.latest_update_at
                                ? formatDateTime(hospitalization.latest_update_at)
                                : "아직 공유된 경과가 없습니다."}
                            </span>
                          </p>
                          {hospitalization.expected_discharge_at && !isDischarged && (
                            <p>
                              <span className="font-black">퇴원 예정</span>{" "}
                              <span className="text-slate-600">
                                {formatDate(hospitalization.expected_discharge_at)}
                              </span>
                            </p>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <section>
              <div className="mb-3">
                <p className="text-xs font-black tracking-[0.14em] text-slate-500">
                  CARE TIMELINE
                </p>
                <h2 className="mt-1 text-xl font-black">병원 경과 타임라인</h2>
              </div>

              {items.length === 0 ? (
                <div className="border border-slate-300 bg-white p-12 text-center text-slate-500">
                  공개된 입원 경과가 없습니다.
                </div>
              ) : (
                <div className="space-y-4">
                  {items.map((item) => {
                    const hospital = one(item.hospitals);
                    const pet = one(item.pets);

                    return (
                      <article
                        key={item.id}
                        className="border border-slate-300 bg-white p-5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <span className="bg-cyan-100 px-2 py-1 text-[11px] font-black text-cyan-800">
                              {categoryLabel[item.category] ?? item.category}
                            </span>

                            <h3 className="mt-2 text-lg font-black">
                              {item.title}
                            </h3>

                            <p className="mt-1 text-xs text-slate-500">
                              {hospital?.name ?? "동물병원"} ·{" "}
                              {pet?.name ?? "반려동물"}
                            </p>
                          </div>

                          <time className="text-xs text-slate-500">
                            {formatDateTime(item.published_at)}
                          </time>
                        </div>

                        <p className="mt-4 whitespace-pre-wrap leading-7">
                          {item.message}
                        </p>

                        {item.image_url && (
                          <img
                            src={item.image_url}
                            alt="병원에서 공유한 입원 경과"
                            className="mt-4 max-h-[520px] w-full border border-slate-200 object-contain"
                          />
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
