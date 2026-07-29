"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  eventLabel,
  generateVisitPreparationSummary,
  type VisitPreparationEvent,
} from "@/lib/visit-preparation-summary";

type Pet = {
  id: number;
  name: string;
};

const priorityLabels: Record<string, string> = {
  emergency: "응급",
  high: "높음",
  normal: "보통",
  reference: "참고",
};

export default function NewVisitPreparationPage() {
  const params = useParams();
  const router = useRouter();
  const petId = Number(params.id);

  const [pet, setPet] = useState<Pet | null>(null);
  const [events, setEvents] = useState<VisitPreparationEvent[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErrorMessage("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        if (!cancelled) {
          setErrorMessage("로그인이 필요합니다.");
          setLoading(false);
        }
        return;
      }

      const [{ data: petData, error: petError }, { data: eventData, error: eventError }] =
        await Promise.all([
          supabase
            .from("pets")
            .select("id,name")
            .eq("id", petId)
            .eq("user_id", user.id)
            .single(),
          supabase
            .from("pet_health_events")
            .select(
              "id,occurred_at,event_type,title,severity,priority,count_value,note,share_with_hospital",
            )
            .eq("pet_id", petId)
            .eq("user_id", user.id)
            .eq("share_with_hospital", true)
            .order("occurred_at", { ascending: false }),
        ]);

      if (cancelled) return;

      if (petError || !petData) {
        setErrorMessage(
          `반려동물 정보를 불러오지 못했습니다: ${petError?.message ?? "정보 없음"}`,
        );
        setLoading(false);
        return;
      }

      if (eventError) {
        setErrorMessage(`이벤트를 불러오지 못했습니다: ${eventError.message}`);
        setLoading(false);
        return;
      }

      setPet(petData as Pet);
      setEvents((eventData as VisitPreparationEvent[] | null) ?? []);
      setLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [petId]);

  const selectedEvents = useMemo(
    () => events.filter((event) => selectedIds.includes(event.id)),
    [events, selectedIds],
  );

  function toggleEvent(eventId: number) {
    setSelectedIds((current) =>
      current.includes(eventId)
        ? current.filter((id) => id !== eventId)
        : [...current, eventId],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!pet || selectedEvents.length === 0) {
      setErrorMessage("이번 진료와 관련된 이벤트를 1개 이상 선택해주세요.");
      return;
    }

    setSaving(true);
    setErrorMessage("");

    const form = new FormData(event.currentTarget);
    const mainConcern = String(form.get("main_concern") ?? "").trim();

    const today = new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    const title = `${today} 진료 준비`;

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setErrorMessage("로그인이 필요합니다.");
      setSaving(false);
      return;
    }

    const generated = generateVisitPreparationSummary({
      petName: pet.name,
      mainConcern,
      events: selectedEvents,
    });

    const { data: preparation, error: preparationError } = await supabase
      .from("visit_preparations")
      .insert({
        user_id: user.id,
        pet_id: petId,
        title,
        main_concern: mainConcern || null,
        status: "ready",
        generated_summary: generated.summary,
        generated_timeline: generated.timeline,
        generated_key_points: generated.keyPoints,
        summary_version: "rule-v1",
        generated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (preparationError || !preparation) {
      setErrorMessage(
        `진료 준비 저장에 실패했습니다: ${
          preparationError?.message ?? "알 수 없는 오류"
        }`,
      );
      setSaving(false);
      return;
    }

    const { error: linkError } = await supabase
      .from("visit_preparation_events")
      .insert(
        [...selectedEvents]
          .sort(
            (a, b) =>
              new Date(a.occurred_at).getTime() -
              new Date(b.occurred_at).getTime(),
          )
          .map((selectedEvent, index) => ({
            visit_preparation_id: preparation.id,
            event_id: selectedEvent.id,
            sort_order: index,
          })),
      );

    if (linkError) {
      await supabase
        .from("visit_preparations")
        .delete()
        .eq("id", preparation.id)
        .eq("user_id", user.id);

      setErrorMessage(`이벤트 연결에 실패했습니다: ${linkError.message}`);
      setSaving(false);
      return;
    }

    router.push(`/pets/${petId}/visit-preparations/${preparation.id}`);
    router.refresh();
  }

  const inputClass =
    "mt-2 w-full rounded-2xl border border-[#d8d3c8] bg-white px-4 py-3 outline-none focus:border-[#174c3c] focus:ring-2 focus:ring-[#174c3c]/10";

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-12 text-center">
        기록을 불러오는 중입니다...
      </main>
    );
  }

  if (!pet) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-12">
        <p className="rounded-2xl bg-red-50 p-5 text-red-700">
          {errorMessage}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
      <Link href={`/pets/${petId}`} className="text-sm font-bold text-[#153f34]">
        ← {pet.name} 기록으로 돌아가기
      </Link>

      <p className="mt-7 text-sm font-bold text-[#d86c57]">PAWU VISIT PREP</p>
      <h1 className="mt-2 text-3xl font-black text-[#153f34]">
        진료 준비 만들기
      </h1>
      <p className="mt-3 leading-7 text-[#687069]">
        이번 병원 방문과 관련된 기록만 골라주세요. PAWU가 시간순서와
        중요도를 기준으로 병원 전달용 요약을 만듭니다.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <section className="rounded-[28px] bg-[#fffaf0] p-5 shadow-sm sm:p-7">
          <label>
            <span className="font-bold text-[#153f34]">
              이번에 가장 걱정되는 증상이나 특이사항
            </span>
            <span className="ml-2 text-sm text-[#8a8f8a]">(선택사항)</span>
            <textarea
              name="main_concern"
              rows={4}
              placeholder="예: 사료를 바꾼 뒤 설사와 구토가 반복돼요."
              className={inputClass}
            />
          </label>

          <p className="mt-3 text-sm leading-6 text-[#757b76]">
            따로 적지 않아도 선택한 건강 이벤트만으로 진료 준비를 만들 수 있습니다.
          </p>
        </section>

        <section>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-[#d86c57]">SELECT EVENTS</p>
              <h2 className="mt-1 text-2xl font-black text-[#153f34]">
                관련 이벤트 선택
              </h2>
            </div>

            <span className="rounded-full bg-[#153f34] px-4 py-2 text-sm font-bold text-white">
              {selectedIds.length}개 선택
            </span>
          </div>

          <div className="mt-5 space-y-3">
            {events.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-[#cfc8ba] p-8 text-center text-[#747a75]">
                병원 공유로 설정된 건강 이벤트가 없습니다.
              </div>
            ) : (
              events.map((healthEvent) => {
                const checked = selectedIds.includes(healthEvent.id);

                return (
                  <label
                    key={healthEvent.id}
                    className={`block cursor-pointer rounded-[24px] border p-5 transition ${
                      checked
                        ? "border-[#153f34] bg-[#eef5f1]"
                        : "border-[#e1ddd2] bg-white"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleEvent(healthEvent.id)}
                        className="mt-1 h-5 w-5"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-bold text-[#d86c57]">
                              {new Date(
                                healthEvent.occurred_at,
                              ).toLocaleString("ko-KR")}
                            </p>
                            <h3 className="mt-1 text-lg font-black text-[#153f34]">
                              {eventLabel(healthEvent)}
                              {healthEvent.count_value
                                ? ` · ${healthEvent.count_value}회`
                                : ""}
                            </h3>
                          </div>

                          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#153f34]">
                            {priorityLabels[healthEvent.priority] ??
                              healthEvent.priority}
                          </span>
                        </div>

                        {healthEvent.note && (
                          <p className="mt-3 whitespace-pre-wrap leading-7 text-[#5f675f]">
                            {healthEvent.note}
                          </p>
                        )}
                      </div>
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </section>

        {errorMessage && (
          <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">
            {errorMessage}
          </p>
        )}

        <button
          disabled={saving || selectedIds.length === 0}
          className="w-full rounded-2xl bg-[#d86c57] px-6 py-4 font-bold text-white disabled:opacity-50"
        >
          {saving ? "요약 생성 중..." : "진료 준비 요약 만들기"}
        </button>
      </form>
    </main>
  );
}
