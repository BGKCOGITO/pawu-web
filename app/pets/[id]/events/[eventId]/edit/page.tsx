"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import EventMediaPicker from "@/components/pets/EventMediaPicker";
import {
  deleteEventAttachment,
  loadSignedEventAttachments,
  uploadEventMedia,
  validateEventMediaFiles,
  type EventAttachment,
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

type HealthEvent = {
  id: number;
  user_id: string;
  pet_id: number;
  occurred_at: string;
  event_type: string;
  severity: string | null;
  priority: "emergency" | "high" | "normal" | "reference";
  count_value: number | null;
  title: string;
  note: string | null;
  share_with_hospital: boolean;
};

function toLocalDateTimeValue(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default function EditEventPage() {
  const params = useParams();
  const router = useRouter();
  const petId = Number(params.id);
  const eventId = Number(params.eventId);

  const [healthEvent, setHealthEvent] = useState<HealthEvent | null>(null);
  const [attachments, setAttachments] = useState<EventAttachment[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<
    number | null
  >(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setErrorMessage("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        if (!cancelled) {
          setErrorMessage("로그인이 필요합니다.");
          setIsLoading(false);
        }
        return;
      }

      const { data, error } = await supabase
        .from("pet_health_events")
        .select(
          "id,user_id,pet_id,occurred_at,event_type,severity,priority,count_value,title,note,share_with_hospital",
        )
        .eq("id", eventId)
        .eq("pet_id", petId)
        .eq("user_id", user.id)
        .single();

      if (error || !data) {
        if (!cancelled) {
          setErrorMessage(
            `기록을 불러오지 못했습니다: ${error?.message ?? "정보 없음"}`,
          );
          setIsLoading(false);
        }
        return;
      }

      try {
        const loadedAttachments = await loadSignedEventAttachments([eventId]);

        if (!cancelled) {
          setHealthEvent(data as HealthEvent);
          setAttachments(loadedAttachments);
          setIsLoading(false);
        }
      } catch (attachmentError) {
        if (!cancelled) {
          setHealthEvent(data as HealthEvent);
          setErrorMessage(
            `첨부파일을 불러오지 못했습니다: ${
              attachmentError instanceof Error
                ? attachmentError.message
                : "알 수 없는 오류"
            }`,
          );
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [eventId, petId]);

  async function handleDeleteAttachment(attachment: EventAttachment) {
    if (!window.confirm("이 첨부파일을 삭제하시겠습니까?")) return;

    setDeletingAttachmentId(attachment.id);

    try {
      await deleteEventAttachment(attachment);
      setAttachments((current) =>
        current.filter((item) => item.id !== attachment.id),
      );
    } catch (error) {
      alert(
        `첨부파일 삭제에 실패했습니다: ${
          error instanceof Error ? error.message : "알 수 없는 오류"
        }`,
      );
    } finally {
      setDeletingAttachmentId(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!healthEvent) return;

    const mediaError = validateEventMediaFiles(
      newFiles,
      attachments.length,
    );

    if (mediaError) {
      setErrorMessage(mediaError);
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

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

    const { error } = await supabase
      .from("pet_health_events")
      .update({
        occurred_at: new Date(occurredAt).toISOString(),
        event_type: eventType,
        title,
        severity: String(form.get("severity") ?? "") || null,
        priority: String(form.get("priority") ?? "normal"),
        count_value: countText ? Number(countText) : null,
        note: String(form.get("note") ?? "").trim() || null,
        share_with_hospital: form.get("share_with_hospital") === "on",
        updated_at: new Date().toISOString(),
      })
      .eq("id", eventId)
      .eq("pet_id", petId)
      .eq("user_id", user.id);

    if (error) {
      setErrorMessage(`수정에 실패했습니다: ${error.message}`);
      setIsSaving(false);
      return;
    }

    try {
      if (newFiles.length > 0) {
        await uploadEventMedia({
          files: newFiles,
          userId: user.id,
          petId,
          eventId,
          startSortOrder: attachments.length,
        });
      }
    } catch (uploadError) {
      setErrorMessage(
        `기록은 수정됐지만 새 첨부파일 저장에 실패했습니다: ${
          uploadError instanceof Error
            ? uploadError.message
            : "알 수 없는 오류"
        }`,
      );
      setIsSaving(false);
      return;
    }

    router.push(`/pets/${petId}`);
    router.refresh();
  }

  const inputClass =
    "mt-2 w-full rounded-2xl border border-[#d8d3c8] bg-white px-4 py-3 outline-none transition focus:border-[#174c3c] focus:ring-2 focus:ring-[#174c3c]/10";

  if (isLoading) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-12 text-center text-[#6e746f]">
        기록을 불러오는 중입니다...
      </main>
    );
  }

  if (!healthEvent) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-12">
        <p className="rounded-2xl bg-red-50 p-5 text-red-700">
          {errorMessage}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-8 sm:px-8">
      <Link href={`/pets/${petId}`} className="text-sm font-bold text-[#153f34]">
        ← 우리 아이로 돌아가기
      </Link>

      <p className="mt-7 text-sm font-bold text-[#d86c57]">HEALTH EVENT</p>
      <h1 className="mt-2 text-3xl font-black text-[#153f34]">
        특이사항 수정
      </h1>

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
            defaultValue={toLocalDateTimeValue(healthEvent.occurred_at)}
            className={inputClass}
          />
        </label>

        <label>
          이벤트 종류 *
          <select
            name="event_type"
            required
            defaultValue={healthEvent.event_type}
            className={inputClass}
          >
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
            <select
              name="priority"
              defaultValue={healthEvent.priority ?? "normal"}
              className={inputClass}
            >
              <option value="emergency">응급</option>
              <option value="high">높음</option>
              <option value="normal">보통</option>
              <option value="reference">참고</option>
            </select>
          </label>

          <label>
            정도
            <select
              name="severity"
              defaultValue={healthEvent.severity ?? ""}
              className={inputClass}
            >
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
              defaultValue={healthEvent.count_value ?? ""}
              className={inputClass}
            />
          </label>
        </div>

        <label>
          메모
          <textarea
            name="note"
            rows={5}
            defaultValue={healthEvent.note ?? ""}
            className={inputClass}
          />
        </label>

        {attachments.length > 0 && (
          <div>
            <p className="mb-3 font-bold text-[#153f34]">현재 첨부파일</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="overflow-hidden rounded-2xl border border-[#e4dfd4] bg-white"
                >
                  <div className="aspect-square bg-black/5">
                    {attachment.signed_url &&
                    attachment.media_type === "video" ? (
                      <video
                        src={attachment.signed_url}
                        controls
                        className="h-full w-full object-cover"
                      />
                    ) : attachment.signed_url ? (
                      <img
                        src={attachment.signed_url}
                        alt={attachment.file_name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-[#777]">
                        미리보기 없음
                      </div>
                    )}
                  </div>

                  <div className="p-3">
                    <p className="truncate text-xs text-[#656b66]">
                      {attachment.file_name}
                    </p>
                    <button
                      type="button"
                      disabled={deletingAttachmentId === attachment.id}
                      onClick={() => handleDeleteAttachment(attachment)}
                      className="mt-2 text-xs font-bold text-red-600 disabled:opacity-50"
                    >
                      {deletingAttachmentId === attachment.id
                        ? "삭제 중..."
                        : "파일 삭제"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <EventMediaPicker
          files={newFiles}
          onChange={setNewFiles}
          existingCount={attachments.length}
        />

        <label className="flex items-center gap-3 rounded-2xl bg-[#eef5f1] p-4">
          <input
            name="share_with_hospital"
            type="checkbox"
            defaultChecked={healthEvent.share_with_hospital}
            className="h-5 w-5"
          />
          <span>
            <b className="block text-[#153f34]">다음 병원 방문 시 공유</b>
            <small className="text-[#677068]">
              첨부파일도 기록과 함께 공유됩니다.
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
          {isSaving ? "저장 중..." : "수정 완료"}
        </button>
      </form>
    </main>
  );
}
