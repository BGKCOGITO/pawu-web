"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  eventLabel,
  type VisitPreparationEvent,
} from "@/lib/visit-preparation-summary";
import {
  loadSignedEventAttachments,
  type EventAttachment,
} from "@/lib/pet-event-media";

type Preparation = {
  id: number;
  title: string;
  main_concern: string | null;
  status: string;
  generated_summary: string | null;
  generated_timeline: string | null;
  generated_key_points: string | null;
  summary_version: string;
  generated_at: string | null;
  created_at: string;
};

type LinkedRow = {
  sort_order: number;
  pet_health_events: VisitPreparationEvent | VisitPreparationEvent[] | null;
};

const priorityLabels: Record<string, string> = {
  emergency: "응급",
  high: "높음",
  normal: "보통",
  reference: "참고",
};

export default function VisitPreparationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const petId = Number(params.id);
  const preparationId = Number(params.preparationId);

  const [preparation, setPreparation] = useState<Preparation | null>(null);
  const [events, setEvents] = useState<VisitPreparationEvent[]>([]);
  const [attachments, setAttachments] = useState<EventAttachment[]>([]);
  const [petName, setPetName] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

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

      const [
        { data: preparationData, error: preparationError },
        { data: linkedData, error: linkedError },
        { data: petData, error: petError },
      ] = await Promise.all([
        supabase
          .from("visit_preparations")
          .select(
            "id,title,main_concern,status,generated_summary,generated_timeline,generated_key_points,summary_version,generated_at,created_at",
          )
          .eq("id", preparationId)
          .eq("pet_id", petId)
          .eq("user_id", user.id)
          .single(),
        supabase
          .from("visit_preparation_events")
          .select(
            "sort_order,pet_health_events(id,occurred_at,event_type,title,severity,priority,count_value,note,share_with_hospital)",
          )
          .eq("visit_preparation_id", preparationId)
          .order("sort_order"),
        supabase
          .from("pets")
          .select("name")
          .eq("id", petId)
          .eq("user_id", user.id)
          .single(),
      ]);

      if (cancelled) return;

      if (preparationError || !preparationData) {
        setErrorMessage(
          `진료 준비를 불러오지 못했습니다: ${
            preparationError?.message ?? "정보 없음"
          }`,
        );
        setLoading(false);
        return;
      }

      if (linkedError) {
        setErrorMessage(`연결된 이벤트 조회 실패: ${linkedError.message}`);
        setLoading(false);
        return;
      }

      if (petError) {
        setErrorMessage(`반려동물 조회 실패: ${petError.message}`);
        setLoading(false);
        return;
      }

      const loadedEvents = ((linkedData as unknown as LinkedRow[] | null) ?? [])
        .flatMap((row) => {
          const linkedEvent = row.pet_health_events;
          if (!linkedEvent) return [];
          return Array.isArray(linkedEvent) ? linkedEvent : [linkedEvent];
        });

      let loadedAttachments: EventAttachment[] = [];

      try {
        loadedAttachments = await loadSignedEventAttachments(
          loadedEvents.map((event) => event.id),
        );
      } catch (error) {
        console.error("첨부파일 조회 오류:", error);
      }

      setPreparation(preparationData as Preparation);
      setEvents(loadedEvents);
      setAttachments(loadedAttachments);
      setPetName(petData?.name ?? "");
      setLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [petId, preparationId]);

  async function deletePreparation() {
    if (!window.confirm("이 진료 준비 묶음을 삭제하시겠습니까?")) return;

    setDeleting(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("로그인이 필요합니다.");
      setDeleting(false);
      return;
    }

    const { error } = await supabase
      .from("visit_preparations")
      .delete()
      .eq("id", preparationId)
      .eq("user_id", user.id);

    if (error) {
      alert(`삭제에 실패했습니다: ${error.message}`);
      setDeleting(false);
      return;
    }

    router.push(`/pets/${petId}`);
    router.refresh();
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl px-5 py-12 text-center">
        진료 준비를 불러오는 중입니다...
      </main>
    );
  }

  if (!preparation) {
    return (
      <main className="mx-auto max-w-4xl px-5 py-12">
        <p className="rounded-2xl bg-red-50 p-5 text-red-700">
          {errorMessage}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
      <Link href={`/pets/${petId}`} className="text-sm font-bold text-[#153f34]">
        ← {petName || "우리 아이"} 기록으로 돌아가기
      </Link>

      <div className="mt-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-[#d86c57]">PAWU VISIT PREP</p>
          <h1 className="mt-2 text-3xl font-black text-[#153f34]">
            진료 준비
          </h1>
          <p className="mt-2 text-sm text-[#747a75]">
            {new Date(preparation.created_at).toLocaleString("ko-KR")} 생성
          </p>
        </div>

        <button
          type="button"
          onClick={deletePreparation}
          disabled={deleting}
          className="rounded-full border border-red-200 px-4 py-2 text-sm font-bold text-red-600 disabled:opacity-50"
        >
          {deleting ? "삭제 중..." : "진료 준비 삭제"}
        </button>
      </div>

      {preparation.main_concern && (
        <section className="mt-7 rounded-[28px] bg-[#fff4e7] p-6">
          <p className="text-sm font-bold text-[#d86c57]">
            보호자가 가장 걱정하는 내용
          </p>
          <p className="mt-3 whitespace-pre-wrap text-lg font-bold leading-8 text-[#153f34]">
            {preparation.main_concern}
          </p>
        </section>
      )}

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <article className="rounded-[28px] bg-[#153f34] p-6 text-white">
          <p className="text-sm font-bold text-white/65">사전 요약</p>
          <p className="mt-4 whitespace-pre-wrap leading-8">
            {preparation.generated_summary || "요약이 없습니다."}
          </p>
        </article>

        <article className="rounded-[28px] bg-[#eef5f1] p-6">
          <p className="text-sm font-bold text-[#d86c57]">중요 기록</p>
          <p className="mt-4 whitespace-pre-wrap leading-8 text-[#153f34]">
            {preparation.generated_key_points || "중요 기록이 없습니다."}
          </p>
        </article>
      </section>

      <section className="mt-8">
        <p className="text-sm font-bold text-[#d86c57]">SELECTED TIMELINE</p>
        <h2 className="mt-1 text-2xl font-black text-[#153f34]">
          선택한 건강 이벤트
        </h2>

        <div className="mt-5 space-y-4">
          {events.map((healthEvent) => {
            const eventAttachments = attachments.filter(
              (attachment) => attachment.event_id === healthEvent.id,
            );

            return (
              <article
                key={healthEvent.id}
                className="rounded-[24px] border border-[#e1ddd2] bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
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

                  <span className="rounded-full bg-[#eef5f1] px-3 py-1 text-xs font-bold text-[#153f34]">
                    {priorityLabels[healthEvent.priority] ??
                      healthEvent.priority}
                  </span>
                </div>

                {healthEvent.note && (
                  <p className="mt-3 whitespace-pre-wrap leading-7 text-[#59615c]">
                    {healthEvent.note}
                  </p>
                )}

                {eventAttachments.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {eventAttachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="overflow-hidden rounded-2xl bg-black/5"
                      >
                        {attachment.signed_url &&
                        attachment.media_type === "video" ? (
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
                          <div className="flex aspect-square items-center justify-center text-xs text-[#777]">
                            미리보기 없음
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-8 rounded-[24px] border border-[#d9d5ca] bg-white p-5">
        <p className="text-sm font-bold text-[#153f34]">현재 요약 방식</p>
        <p className="mt-2 text-sm leading-7 text-[#697069]">
          현재 버전은 실제 AI 진단이 아니라 선택한 기록의 시간순서, 반복 횟수,
          보호자 메모와 중요도를 규칙으로 정리한 사전 요약입니다. 다음 단계에서
          AI 모델을 연결하되 진단 표현은 사용하지 않습니다.
        </p>
      </section>
    </main>
  );
}
