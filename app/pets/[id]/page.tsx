"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  loadSignedEventAttachments,
  PET_EVENT_MEDIA_BUCKET,
  type EventAttachment,
} from "@/lib/pet-event-media";

type Pet = {
  id: number;
  name: string;
  species: string;
  breed: string | null;
  birth_date: string | null;
  gender: string | null;
  weight_kg: number | null;
  notes: string | null;
};

type Profile = {
  food_brand: string;
  food_product: string;
  feeding_type: "scheduled" | "free";
  feeding_times_per_day: number | null;
  feeding_amount_per_day_g: number | null;
  treats: string | null;
  allergies: string | null;
  current_medications: string | null;
  supplements: string | null;
  neutered: boolean | null;
  living_environment: string | null;
};

type HealthEvent = {
  id: number;
  occurred_at: string;
  event_type: string;
  severity: string | null;
  priority: "emergency" | "high" | "normal" | "reference";
  count_value: number | null;
  title: string;
  note: string | null;
  share_with_hospital: boolean;
};

const eventLabels: Record<string, string> = {
  vomiting: "구토",
  diarrhea: "설사",
  appetite_loss: "식욕 감소",
  water_change: "음수량 변화",
  cough: "기침",
  sneeze: "재채기",
  eye: "눈 이상",
  ear: "귀 이상",
  skin: "피부 이상",
  limping: "절뚝거림",
  seizure: "발작",
  food_change: "사료 변경",
  medication_change: "약 변경",
  weight: "체중 기록",
  hospital_visit: "병원 방문",
  accident: "사고",
  other: "기타",
};

const priorityLabels: Record<string, string> = {
  emergency: "응급",
  high: "높음",
  normal: "보통",
  reference: "참고",
};

const severityLabels: Record<string, string> = {
  mild: "가벼움",
  moderate: "보통",
  severe: "심함",
};

function livingEnvironmentLabel(value: string | null | undefined) {
  if (value === "indoor") return "실내";
  if (value === "outdoor") return "실외";
  if (value === "mixed") return "실내·실외";
  return "미입력";
}

export default function PetDetailPage() {
  const params = useParams();
  const petId = Number(params.id);

  const [pet, setPet] = useState<Pet | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [events, setEvents] = useState<HealthEvent[]>([]);
  const [attachments, setAttachments] = useState<EventAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError("로그인이 필요합니다.");
      setLoading(false);
      return;
    }

    const [
      { data: petData, error: petError },
      { data: profileData, error: profileError },
      { data: eventData, error: eventError },
    ] = await Promise.all([
      supabase
        .from("pets")
        .select(
          "id,name,species,breed,birth_date,gender,weight_kg,notes",
        )
        .eq("id", petId)
        .eq("user_id", user.id)
        .single(),
      supabase
        .from("pet_lifestyle_profiles")
        .select(
          "food_brand,food_product,feeding_type,feeding_times_per_day,feeding_amount_per_day_g,treats,allergies,current_medications,supplements,neutered,living_environment",
        )
        .eq("pet_id", petId)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("pet_health_events")
        .select(
          "id,occurred_at,event_type,severity,priority,count_value,title,note,share_with_hospital",
        )
        .eq("pet_id", petId)
        .eq("user_id", user.id)
        .order("occurred_at", { ascending: false }),
    ]);

    if (petError) {
      setError(petError.message);
      setLoading(false);
      return;
    }

    if (profileError) console.error(profileError);
    if (eventError) console.error(eventError);

    const loadedEvents = (eventData as HealthEvent[] | null) ?? [];

    let loadedAttachments: EventAttachment[] = [];

    try {
      loadedAttachments = await loadSignedEventAttachments(
        loadedEvents.map((event) => event.id),
      );
    } catch (attachmentError) {
      console.error("첨부파일 조회 오류:", attachmentError);
    }

    setPet(petData as Pet);
    setProfile((profileData as Profile | null) ?? null);
    setEvents(loadedEvents);
    setAttachments(loadedAttachments);
    setLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, [petId]);

  const recentSummary = useMemo(
    () =>
      events
        .slice(0, 5)
        .map((event) => eventLabels[event.event_type] ?? event.title)
        .join(" · "),
    [events],
  );

  async function deleteEvent(event: HealthEvent) {
    const label = eventLabels[event.event_type] ?? event.title;
    const shouldDelete = window.confirm(
      `${label} 기록을 정말 삭제하시겠습니까?`,
    );

    if (!shouldDelete) return;

    setDeletingId(event.id);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      alert("로그인이 필요합니다.");
      setDeletingId(null);
      return;
    }

    const { error: deleteError } = await supabase
      .from("pet_health_events")
      .delete()
      .eq("id", event.id)
      .eq("pet_id", petId)
      .eq("user_id", user.id);

    if (deleteError) {
      alert(`삭제에 실패했습니다: ${deleteError.message}`);
      setDeletingId(null);
      return;
    }

    const eventAttachments = attachments.filter(
      (attachment) => attachment.event_id === event.id,
    );

    if (eventAttachments.length > 0) {
      await supabase.storage
        .from(PET_EVENT_MEDIA_BUCKET)
        .remove(eventAttachments.map((attachment) => attachment.storage_path));
    }

    setEvents((current) => current.filter((item) => item.id !== event.id));
    setAttachments((current) =>
      current.filter((attachment) => attachment.event_id !== event.id),
    );
    setDeletingId(null);
  }

  if (loading) {
    return <main className="p-8">불러오는 중...</main>;
  }

  if (error || !pet) {
    return (
      <main className="p-8 text-red-700">
        정보를 불러오지 못했습니다: {error}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[#d86c57]">MY PAWU</p>
          <h1 className="mt-1 text-3xl font-black text-[#153f34]">
            {pet.name}
          </h1>
          <p className="mt-1 text-[#6e746f]">
            {pet.species === "dog"
              ? "강아지"
              : pet.species === "cat"
                ? "고양이"
                : "기타"}
            {pet.breed ? ` · ${pet.breed}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/health-notebook?petId=${pet.id}`}
            className="rounded-full bg-[#153f34] px-4 py-2 text-sm font-bold text-white"
          >
            건강 타임라인
          </Link>

          <Link
            href={`/pets/${pet.id}/edit`}
            className="rounded-full border border-[#153f34] px-4 py-2 text-sm font-bold text-[#153f34]"
          >
            정보 수정
          </Link>

          <Link
            href={`/pets/${pet.id}/events/new`}
            className="rounded-full bg-[#d86c57] px-4 py-2 text-sm font-bold text-white"
          >
            이벤트 기록
          </Link>
        </div>
      </div>

      <section className="mt-5 flex flex-wrap gap-3 rounded-[24px] bg-[#eef5f1] p-4">
        <Link
          href={`/pets/${pet.id}/visit-preparations/new`}
          className="rounded-full bg-[#153f34] px-5 py-3 text-sm font-bold text-white"
        >
          진료 준비 만들기
        </Link>
        <Link
          href={`/pets/${pet.id}/visit-preparations`}
          className="rounded-full border border-[#153f34] px-5 py-3 text-sm font-bold text-[#153f34]"
        >
          진료 준비 목록
        </Link>
      </section>

      <section className="mt-7 grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
        <article className="rounded-[30px] bg-[#153f34] p-6 text-white sm:p-8">
          <p className="text-sm text-white/70">한눈에 보는 생활 프로필</p>
          <h2 className="mt-2 text-2xl font-black">
            {profile
              ? `${profile.food_brand} ${profile.food_product}`
              : "생활정보를 등록해주세요"}
          </h2>

          <div className="mt-6 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <Info
              label="몸무게"
              value={pet.weight_kg ? `${pet.weight_kg}kg` : "미입력"}
            />
            <Info
              label="급여"
              value={
                profile
                  ? `하루 ${profile.feeding_times_per_day}회`
                  : "미입력"
              }
            />
            <Info
              label="급여량"
              value={
                profile?.feeding_amount_per_day_g
                  ? `${profile.feeding_amount_per_day_g}g/일`
                  : "미입력"
              }
            />
            <Info label="알레르기" value={profile?.allergies || "미입력"} />
            <Info
              label="복용약"
              value={profile?.current_medications || "없음"}
            />
            <Info
              label="중성화"
              value={
                profile?.neutered === true
                  ? "완료"
                  : profile?.neutered === false
                    ? "미완료"
                    : "미입력"
              }
            />
            <Info
              label="생활환경"
              value={livingEnvironmentLabel(profile?.living_environment)}
            />
            <Info label="간식" value={profile?.treats || "미입력"} />
            <Info label="영양제" value={profile?.supplements || "미입력"} />
          </div>
        </article>

        <article className="rounded-[30px] bg-[#fff4e7] p-6 sm:p-8">
          <p className="text-sm font-bold text-[#d86c57]">최근 기록 요약</p>
          <h2 className="mt-2 text-xl font-black text-[#153f34]">
            {events.length ? `${events.length}개의 이벤트` : "아직 기록이 없어요"}
          </h2>
          <p className="mt-4 leading-7 text-[#5f675f]">
            {recentSummary ||
              "구토, 설사, 사료 변경 등 특이사항이 생겼을 때만 날짜별로 기록하세요. 다음 병원 방문 시 한눈에 전달할 수 있습니다."}
          </p>
        </article>
      </section>

      <section className="mt-8">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm font-bold text-[#d86c57]">HEALTH TIMELINE</p>
            <h2 className="mt-1 text-2xl font-black text-[#153f34]">
              날짜별 이벤트
            </h2>
          </div>

          <Link
            href={`/pets/${pet.id}/events/new`}
            className="text-sm font-bold text-[#153f34] underline"
          >
            새 기록 추가
          </Link>
        </div>

        <div className="mt-5 space-y-3">
          {events.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-[#cfc8ba] p-8 text-center text-[#747a75]">
              특이사항이 있을 때만 기록하면 됩니다.
            </div>
          ) : (
            events.map((event) => (
              <article
                key={event.id}
                className="rounded-[24px] border border-[#e1ddd2] bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-[#d86c57]">
                      {new Date(event.occurred_at).toLocaleString("ko-KR")}
                    </p>
                    <h3 className="mt-1 text-lg font-black text-[#153f34]">
                      {eventLabels[event.event_type] ?? event.title}
                      {event.count_value ? ` · ${event.count_value}회` : ""}
                    </h3>

                    {event.severity && (
                      <p className="mt-1 text-sm text-[#737a74]">
                        정도: {severityLabels[event.severity] ?? event.severity}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-[#fff4e7] px-3 py-1 text-xs font-bold text-[#d86c57]">
                      {priorityLabels[event.priority] ?? event.priority}
                    </span>
                    <span className="rounded-full bg-[#eef5f1] px-3 py-1 text-xs font-bold text-[#153f34]">
                      {event.share_with_hospital ? "병원 공유" : "비공개"}
                    </span>
                  </div>
                </div>

                {event.note && (
                  <p className="mt-3 whitespace-pre-wrap leading-7 text-[#59615c]">
                    {event.note}
                  </p>
                )}

                {attachments.some(
                  (attachment) => attachment.event_id === event.id,
                ) && (
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {attachments
                      .filter(
                        (attachment) => attachment.event_id === event.id,
                      )
                      .map((attachment) => (
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

                <div className="mt-4 flex justify-end gap-2 border-t border-[#eee9df] pt-4">
                  <Link
                    href={`/pets/${pet.id}/events/${event.id}/edit`}
                    className="rounded-full border border-[#153f34] px-4 py-2 text-sm font-bold text-[#153f34]"
                  >
                    수정
                  </Link>

                  <button
                    type="button"
                    onClick={() => deleteEvent(event)}
                    disabled={deletingId === event.id}
                    className="rounded-full border border-red-200 px-4 py-2 text-sm font-bold text-red-600 disabled:opacity-50"
                  >
                    {deletingId === event.id ? "삭제 중..." : "삭제"}
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/10 p-3">
      <p className="text-xs text-white/60">{label}</p>
      <p className="mt-1 break-words font-bold">{value}</p>
    </div>
  );
}
