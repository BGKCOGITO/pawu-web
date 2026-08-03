"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import EventMediaPicker from "@/components/pets/EventMediaPicker";
import {
  uploadEventMedia,
  validateEventMediaFiles,
} from "@/lib/pet-event-media";

const eventTypes = [
  ["vomiting", "구토"],
  ["diarrhea", "설사"],
  ["appetite_loss", "식욕 감소"],
  ["water_change", "음수량 변화"],
  ["cough", "기침"],
  ["sneeze", "재채기"],
  ["eye", "눈 이상"],
  ["ear", "귀 이상"],
  ["skin", "피부 이상"],
  ["limping", "절뚝거림"],
  ["seizure", "발작"],
  ["food_change", "사료 변경"],
  ["medication_change", "약 변경"],
  ["weight", "체중 기록"],
  ["hospital_visit", "병원 방문"],
  ["accident", "사고"],
  ["other", "기타"],
] as const;

function nowLocalDateTime() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 16);
}

export default function NewEventPage() {
  const params = useParams();
  const router = useRouter();
  const petId = Number(params.id);

  const [files, setFiles] = useState<File[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setErrorMessage("");

    const mediaError = validateEventMediaFiles(files);

    if (mediaError) {
      setErrorMessage(mediaError);
      setIsSaving(false);
      return;
    }

    const form = new FormData(event.currentTarget);
    const eventType = String(form.get("event_type") ?? "");
    const occurredAt = String(form.get("occurred_at") ?? "");
    const countText = String(form.get("count_value") ?? "").trim();
    const title =
      eventTypes.find(([value]) => value === eventType)?.[1] ?? "기타";

    if (!eventType || !occurredAt) {
      setErrorMessage("발생 일시와 이벤트 종류는 필수입니다.");
      setIsSaving(false);
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setErrorMessage("로그인이 필요합니다.");
      setIsSaving(false);
      return;
    }

    const { data: pet, error: petError } = await supabase
      .from("pets")
      .select("id")
      .eq("id", petId)
      .eq("user_id", user.id)
      .single();

    if (petError || !pet) {
      setErrorMessage("본인의 반려동물 정보만 기록할 수 있습니다.");
      setIsSaving(false);
      return;
    }

    const { data: createdEvent, error: insertError } = await supabase
      .from("pet_health_events")
      .insert({
        pet_id: petId,
        user_id: user.id,
        occurred_at: new Date(occurredAt).toISOString(),
        event_type: eventType,
        title,
        severity: String(form.get("severity") ?? "") || null,
        priority: String(form.get("priority") ?? "normal"),
        count_value: countText ? Number(countText) : null,
        note: String(form.get("note") ?? "").trim() || null,
        share_with_hospital: form.get("share_with_hospital") === "on",
      })
      .select("id")
      .single();

    if (insertError || !createdEvent) {
      setErrorMessage(
        `기록 저장에 실패했습니다: ${insertError?.message ?? "알 수 없는 오류"}`,
      );
      setIsSaving(false);
      return;
    }

    try {
      if (files.length > 0) {
        await uploadEventMedia({
          files,
          userId: user.id,
          petId,
          eventId: Number(createdEvent.id),
        });
      }
    } catch (uploadError) {
      const detail =
        uploadError instanceof Error
          ? uploadError.message
          : "알 수 없는 오류";

      router.push(
        `/pets/${petId}/events/${createdEvent.id}/edit?attachmentError=${encodeURIComponent(detail)}`,
      );
      router.refresh();
      return;
    }

    router.push(`/pets/${petId}`);
    router.refresh();
  }

  const inputClass =
    "mt-2 w-full rounded-2xl border border-[#d8d3c8] bg-white px-4 py-3 outline-none transition focus:border-[#174c3c] focus:ring-2 focus:ring-[#174c3c]/10";

  return (
    <main className="mx-auto max-w-2xl px-5 py-8 sm:px-8">
      <Link href={`/pets/${petId}`} className="text-sm font-bold text-[#153f34]">
        ← 우리 아이로 돌아가기
      </Link>

      <p className="mt-7 text-sm font-bold text-[#d86c57]">HEALTH EVENT</p>
      <h1 className="mt-2 text-3xl font-black text-[#153f34]">
        특이사항 기록
      </h1>
      <p className="mt-3 text-[#6e746f]">
        매일 쓰지 않아도 됩니다. 평소와 다른 일이 생겼을 때만 기록하세요.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-8 space-y-5 rounded-[30px] bg-[#fffaf0] p-5 shadow-sm sm:p-8"
      >
        <label>
          발생 일시 *
          <input
            name="occurred_at"
            type="datetime-local"
            required
            defaultValue={nowLocalDateTime()}
            className={inputClass}
          />
        </label>

        <label>
          이벤트 종류 *
          <select name="event_type" required className={inputClass}>
            <option value="">선택해주세요</option>
            {eventTypes.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            중요도
            <select name="priority" defaultValue="normal" className={inputClass}>
              <option value="emergency">응급</option>
              <option value="high">높음</option>
              <option value="normal">보통</option>
              <option value="reference">참고</option>
            </select>
          </label>

          <label>
            정도
            <select name="severity" defaultValue="" className={inputClass}>
              <option value="">잘 모르겠어요</option>
              <option value="mild">가벼움</option>
              <option value="moderate">보통</option>
              <option value="severe">심함</option>
            </select>
          </label>

          <label>
            횟수
            <input
              name="count_value"
              type="number"
              min="0"
              placeholder="예: 2"
              className={inputClass}
            />
          </label>
        </div>

        <label>
          메모
          <textarea
            name="note"
            rows={5}
            placeholder="언제부터, 어떤 상황에서, 평소와 무엇이 다른지 적어주세요."
            className={inputClass}
          />
        </label>

        <EventMediaPicker files={files} onChange={setFiles} />

        <label className="flex items-center gap-3 rounded-2xl bg-[#eef5f1] p-4">
          <input
            name="share_with_hospital"
            type="checkbox"
            defaultChecked
            className="h-5 w-5"
          />
          <span>
            <b className="block text-[#153f34]">다음 병원 방문 시 공유</b>
            <small className="text-[#677068]">
              기록과 첨부파일을 향후 병원 차트에서 함께 확인할 수 있습니다.
            </small>
          </span>
        </label>

        {errorMessage && (
          <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">
            {errorMessage}
          </p>
        )}

        <button
          disabled={isSaving}
          className="w-full rounded-2xl bg-[#d86c57] px-6 py-4 font-bold text-white disabled:opacity-50"
        >
          {isSaving ? "저장 중..." : "이벤트 기록 완료"}
        </button>
      </form>
    </main>
  );
}
