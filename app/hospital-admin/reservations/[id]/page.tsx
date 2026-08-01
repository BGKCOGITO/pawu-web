"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { hospitalAuthFetch } from "@/lib/hospital-auth-fetch";

function one(value: any) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function speciesLabel(value: string | null) {
  if (value === "dog") return "강아지";
  if (value === "cat") return "고양이";
  if (value === "other") return "기타";
  return "미입력";
}

function genderLabel(value: string | null) {
  if (value === "male") return "수컷";
  if (value === "female") return "암컷";
  return "미입력";
}

function priorityLabel(value: string) {
  if (value === "emergency") return "응급";
  if (value === "high") return "높음";
  if (value === "reference") return "참고";
  return "보통";
}

export default function HospitalReservationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [reservation, setReservation] = useState<any>(null);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleReason, setScheduleReason] = useState("");
  const [showScheduleEditor, setShowScheduleEditor] = useState(false);
  const [startingChat, setStartingChat] = useState(false);

  async function load() {
    setLoading(true);
    setMessage("");

    try {
      const response = await hospitalAuthFetch(
        `/api/hospital/reservations/${params.id}`,
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setReservation(result.reservation);
      setAttachments(result.attachments ?? []);
      setScheduleDate(result.reservation?.reservation_date ?? "");
      setScheduleTime(String(result.reservation?.reservation_time ?? "").slice(0, 5));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "예약 조회 실패");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function startMedicalRecord() {
    if (!reservation) return;

    setSaving(true);
    setMessage("");

    try {
      const response = await hospitalAuthFetch("/api/hospital/medical-records", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reservation_id: reservation.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      router.push(`/hospital-admin/emr/${result.record_id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "전자차트 생성 실패");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(status: string) {
    if (!reservation) return;

    setSaving(true);
    setMessage("");

    try {
      const response = await hospitalAuthFetch(
        `/api/hospital/reservations/${reservation.id}/status`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      await load();
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "상태 변경 실패");
    } finally {
      setSaving(false);
    }
  }

  async function changeSchedule() {
    if (!reservation || !scheduleDate || !scheduleTime) return;

    const confirmed = window.confirm(
      `예약 시간을 ${scheduleDate} ${scheduleTime}으로 변경하시겠습니까?`,
    );
    if (!confirmed) return;

    setSaving(true);
    setMessage("");

    try {
      const response = await hospitalAuthFetch(
        `/api/hospital/reservations/${reservation.id}/schedule`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            reservation_date: scheduleDate,
            reservation_time: scheduleTime,
            reason: scheduleReason,
          }),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setShowScheduleEditor(false);
      setScheduleReason("");
      setMessage("예약 시간이 변경되었습니다. 연결된 채팅방이 있으면 보호자에게 변경 내용이 자동 안내됩니다.");
      await load();
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "예약 시간 변경 실패");
    } finally {
      setSaving(false);
    }
  }

  async function openGuardianChat() {
    if (!reservation) return;

    setStartingChat(true);
    setMessage("");

    try {
      const response = await hospitalAuthFetch(
        `/api/hospital/reservations/${reservation.id}/chat`,
        { method: "POST" },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      router.push(`/hospital-admin/chat/${result.conversationId}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "보호자 채팅 연결 실패");
      setStartingChat(false);
    }
  }

  const parsed = useMemo(() => {
    if (!reservation) return null;

    const pet = one(reservation.pets);
    const hospital = one(reservation.hospitals);
    const lifestyle = one(pet?.pet_lifestyle_profiles);
    const preparation = one(reservation.visit_preparations);
    const rows = [...(preparation?.visit_preparation_events ?? [])]
      .map((row: any) => ({
        sortOrder: row.sort_order,
        event: one(row.pet_health_events),
      }))
      .filter((row: any) => row.event)
      .sort((a: any, b: any) => a.sortOrder - b.sortOrder);

    return { pet, hospital, lifestyle, preparation, rows };
  }, [reservation]);

  if (loading) {
    return (
      <main className="p-6">
        <div className="mx-auto max-w-[1500px] border border-slate-300 bg-white p-12 text-center text-slate-500">
          예약 상세를 불러오는 중입니다.
        </div>
      </main>
    );
  }

  if (!reservation || !parsed) {
    return (
      <main className="p-6">
        <div className="mx-auto max-w-[1500px] border border-red-300 bg-red-50 p-6 text-red-700">
          {message || "예약을 찾을 수 없습니다."}
        </div>
      </main>
    );
  }

  const { pet, hospital, lifestyle, preparation, rows } = parsed;
  const brand =
    one(lifestyle?.pet_food_brands)?.name_ko ??
    lifestyle?.food_brand ??
    "미입력";
  const product =
    one(lifestyle?.pet_food_products)?.name_ko ??
    lifestyle?.food_product ??
    "미입력";

  return (
    <main className="p-4 lg:p-6">
      <div className="mx-auto max-w-[1500px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link
              href="/hospital-admin/reservations"
              className="text-sm font-bold text-slate-500 hover:text-slate-950"
            >
              ← 예약 목록
            </Link>
            <h2 className="mt-2 text-2xl font-bold">예약 상세 #{reservation.id}</h2>
          </div>

          <span className="border border-slate-300 bg-white px-4 py-2 text-sm font-bold">
            {reservation.status}
          </span>
        </div>

        {message && (
          <div className="mt-4 border border-red-300 bg-red-50 p-4 text-sm text-red-700">
            {message}
          </div>
        )}

        <section className="mt-5 grid gap-4 lg:grid-cols-3">
          <article className="border border-slate-300 bg-white p-5">
            <p className="text-xs font-bold text-slate-400">예약 일시</p>
            <p className="mt-2 text-xl font-bold">
              {reservation.reservation_date} {String(reservation.reservation_time).slice(0, 5)}
            </p>
            <p className="mt-2 text-sm text-slate-500">{hospital?.name}</p>
          </article>
          <article className="border border-slate-300 bg-white p-5">
            <p className="text-xs font-bold text-slate-400">보호자</p>
            <p className="mt-2 text-xl font-bold">{reservation.guardian_name}</p>
            <p className="mt-2 text-sm text-slate-500">{reservation.phone}</p>
          </article>
          <article className="border border-slate-300 bg-white p-5">
            <p className="text-xs font-bold text-slate-400">환자</p>
            <p className="mt-2 text-xl font-bold">{pet?.name ?? reservation.pet_name}</p>
            <p className="mt-2 text-sm text-slate-500">
              {speciesLabel(pet?.species)}{pet?.breed ? ` · ${pet.breed}` : ""}
            </p>
          </article>
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4">
            <article className="border border-slate-300 bg-white p-5">
              <h3 className="text-lg font-bold">환자 기본정보</h3>
              <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                <div><dt className="text-slate-400">성별</dt><dd className="mt-1 font-bold">{genderLabel(pet?.gender)}</dd></div>
                <div><dt className="text-slate-400">몸무게</dt><dd className="mt-1 font-bold">{pet?.weight_kg != null ? `${pet.weight_kg}kg` : "미입력"}</dd></div>
                <div><dt className="text-slate-400">생년월일</dt><dd className="mt-1 font-bold">{pet?.birth_date || "미입력"}</dd></div>
                <div><dt className="text-slate-400">중성화</dt><dd className="mt-1 font-bold">{lifestyle?.neutered === true ? "완료" : lifestyle?.neutered === false ? "미완료" : "미입력"}</dd></div>
              </dl>
            </article>

            <article className="border border-slate-300 bg-white p-5">
              <h3 className="text-lg font-bold">생활정보</h3>
              <dl className="mt-4 space-y-4 text-sm">
                <div><dt className="text-slate-400">사료</dt><dd className="mt-1 font-bold">{brand} · {product}</dd></div>
                <div><dt className="text-slate-400">알레르기</dt><dd className="mt-1 font-bold">{lifestyle?.allergies || "없음 또는 미입력"}</dd></div>
                <div><dt className="text-slate-400">복용약</dt><dd className="mt-1 font-bold">{lifestyle?.current_medications || "없음 또는 미입력"}</dd></div>
                <div><dt className="text-slate-400">영양제</dt><dd className="mt-1 font-bold">{lifestyle?.supplements || "없음 또는 미입력"}</dd></div>
              </dl>
            </article>

            <article className="border border-slate-950 bg-slate-950 p-5 text-white">
              <h3 className="text-lg font-bold">전자차트</h3>
              <p className="mt-2 text-sm leading-6 text-white/70">
                예약 정보와 PAWU 진료 준비 자료를 불러와 수의사 차트를 작성합니다.
              </p>
              <button
                type="button"
                disabled={saving}
                onClick={() => void startMedicalRecord()}
                className="mt-4 w-full bg-white px-4 py-3 font-bold text-slate-950 disabled:opacity-50"
              >
                전자차트 열기
              </button>
            </article>

            <article className="border border-slate-300 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold">예약 시간 관리</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    수술·응급 일정 등으로 조정이 필요할 때 병원에서 날짜와 시간을 변경합니다.
                  </p>
                </div>
                {["requested", "approved"].includes(reservation.status) && (
                  <button
                    type="button"
                    onClick={() => setShowScheduleEditor((current) => !current)}
                    className="border border-slate-950 px-3 py-2 text-sm font-bold"
                  >
                    {showScheduleEditor ? "변경 닫기" : "예약시간 변경"}
                  </button>
                )}
              </div>

              {showScheduleEditor && ["requested", "approved"].includes(reservation.status) && (
                <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label>
                      <span className="mb-1 block text-xs font-bold text-slate-500">변경 날짜</span>
                      <input
                        type="date"
                        value={scheduleDate}
                        onChange={(event) => setScheduleDate(event.target.value)}
                        className="w-full border border-slate-300 px-3 py-3"
                      />
                    </label>
                    <label>
                      <span className="mb-1 block text-xs font-bold text-slate-500">변경 시간</span>
                      <input
                        type="time"
                        value={scheduleTime}
                        onChange={(event) => setScheduleTime(event.target.value)}
                        className="w-full border border-slate-300 px-3 py-3"
                      />
                    </label>
                  </div>
                  <label>
                    <span className="mb-1 block text-xs font-bold text-slate-500">변경 사유 · 선택</span>
                    <textarea
                      rows={3}
                      value={scheduleReason}
                      onChange={(event) => setScheduleReason(event.target.value)}
                      placeholder="예: 응급 수술 일정으로 30분 뒤로 조정합니다."
                      className="w-full resize-none border border-slate-300 px-3 py-3 text-sm"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={saving || !scheduleDate || !scheduleTime}
                    onClick={() => void changeSchedule()}
                    className="w-full bg-amber-600 px-4 py-3 font-bold text-white disabled:opacity-50"
                  >
                    {saving ? "변경 중..." : "새 예약시간 저장"}
                  </button>
                  <p className="text-xs leading-5 text-slate-500">
                    운영시간·휴게시간·임시 마감·기존 예약을 확인한 뒤 변경됩니다. 변경 후 예약 상태는 승인으로 유지됩니다.
                  </p>
                </div>
              )}
            </article>

            <article className="border border-emerald-300 bg-emerald-50 p-5">
              <h3 className="text-lg font-bold text-emerald-950">보호자 바로 연락</h3>
              <p className="mt-2 text-sm leading-6 text-emerald-900/70">
                일반 예약은 바로 승인하고, 일정 조율이나 사전 안내가 필요할 때는 이 예약과 연결된 채팅을 시작하세요.
              </p>
              <button
                type="button"
                disabled={startingChat}
                onClick={() => void openGuardianChat()}
                className="mt-4 w-full bg-emerald-900 px-4 py-3 font-bold text-white disabled:opacity-50"
              >
                {startingChat ? "채팅 연결 중..." : "보호자와 채팅하기"}
              </button>
              <p className="mt-2 text-xs text-emerald-900/60">
                승인 전 예약도 병원에서 먼저 채팅을 시작할 수 있습니다.
              </p>
            </article>

            <article className="border border-slate-300 bg-white p-5">
              <h3 className="text-lg font-bold">예약 상태 처리</h3>
              <div className="mt-4 grid gap-2">
                {reservation.status === "requested" && (
                  <>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void changeStatus("approved")}
                      className="bg-slate-950 px-4 py-3 font-bold text-white disabled:opacity-50"
                    >
                      예약 승인
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void changeStatus("rejected")}
                      className="border border-red-300 px-4 py-3 font-bold text-red-700 disabled:opacity-50"
                    >
                      예약 거절
                    </button>
                  </>
                )}
                {reservation.status === "approved" && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void changeStatus("completed")}
                    className="border border-blue-300 bg-blue-50 px-4 py-3 font-bold text-blue-700 disabled:opacity-50"
                  >
                    진료 완료 처리
                  </button>
                )}
                {!["requested", "approved"].includes(reservation.status) && (
                  <p className="text-sm text-slate-500">
                    현재 상태에서는 추가 처리가 필요하지 않습니다.
                  </p>
                )}
              </div>
            </article>
          </div>

          <div className="space-y-4">
            <article className="border border-slate-950 bg-slate-950 p-6 text-white">
              <p className="text-xs font-bold text-white/60">PAWU VISIT PREP</p>
              <h3 className="mt-2 text-2xl font-bold">
                {preparation ? "진료 준비 요약" : "일반 예약"}
              </h3>
              <div className="mt-5 grid gap-5 lg:grid-cols-2">
                <div>
                  <p className="text-xs font-bold text-amber-300">특이사항</p>
                  <p className="mt-2 whitespace-pre-wrap leading-7">
                    {preparation?.main_concern || reservation.symptoms || "입력 없음"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-emerald-300">사전 요약</p>
                  <p className="mt-2 whitespace-pre-wrap leading-7">
                    {preparation?.generated_summary || "생성된 요약 없음"}
                  </p>
                </div>
              </div>
            </article>

            <article className="border border-slate-300 bg-white p-5">
              <h3 className="text-lg font-bold">건강 이벤트 타임라인</h3>

              {rows.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">
                  선택된 건강 이벤트가 없습니다.
                </p>
              ) : (
                <div className="mt-4 space-y-4">
                  {rows.map(({ event }: any) => {
                    const eventAttachments = attachments.filter(
                      (attachment) => attachment.event_id === event.id,
                    );

                    return (
                      <section key={event.id} className="border border-slate-200 p-4">
                        <div className="flex flex-wrap justify-between gap-3">
                          <div>
                            <p className="text-xs font-bold text-rose-600">
                              {new Date(event.occurred_at).toLocaleString("ko-KR")}
                            </p>
                            <p className="mt-1 text-base font-bold">
                              {event.title}
                              {event.count_value ? ` · ${event.count_value}회` : ""}
                            </p>
                          </div>
                          <span className="h-fit border border-slate-300 bg-slate-100 px-2 py-1 text-xs font-bold">
                            {priorityLabel(event.priority)}
                          </span>
                        </div>

                        {event.note && (
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                            {event.note}
                          </p>
                        )}

                        {eventAttachments.length > 0 && (
                          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                            {eventAttachments.map((attachment) => (
                              <div key={attachment.id} className="overflow-hidden bg-slate-100">
                                {attachment.signed_url && attachment.media_type === "video" ? (
                                  <video
                                    src={attachment.signed_url}
                                    controls
                                    className="aspect-square w-full object-cover"
                                  />
                                ) : attachment.signed_url ? (
                                  <img
                                    src={attachment.signed_url}
                                    alt={attachment.file_name}
                                    className="aspect-square w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex aspect-square items-center justify-center text-xs text-slate-400">
                                    미리보기 실패
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </section>
                    );
                  })}
                </div>
              )}
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}
