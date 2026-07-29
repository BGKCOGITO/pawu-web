"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../../../../lib/supabase";
import {
  eventLabel,
  generateVisitPreparationSummary,
  type VisitPreparationEvent,
} from "@/lib/visit-preparation-summary";

type Pet = {
  id: number;
  name: string;
  species: "dog" | "cat" | "other";
  breed: string | null;
};

type GuardianProfile = {
  display_name: string | null;
  phone: string | null;
};

type ReservationTimeRow = {
  reservation_time: string;
};

type HospitalTimeBlock = {
  start_time: string;
  end_time: string;
};

const reservationTimes = [
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
];

const priorityLabels: Record<string, string> = {
  emergency: "응급",
  high: "높음",
  normal: "보통",
  reference: "참고",
};

function getSpeciesLabel(species: Pet["species"]) {
  if (species === "dog") return "강아지";
  if (species === "cat") return "고양이";
  return "기타";
}

function normalizeTime(time: string) {
  return String(time).slice(0, 5);
}

function isTimeInsideBlock(
  time: string,
  startTime: string,
  endTime: string,
) {
  const normalizedTime = normalizeTime(time);
  const normalizedStartTime = normalizeTime(startTime);
  const normalizedEndTime = normalizeTime(endTime);

  return (
    normalizedTime >= normalizedStartTime &&
    normalizedTime < normalizedEndTime
  );
}

export default function ReservationPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const hospitalId = params.id;

  const [user, setUser] = useState<User | null>(null);
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedPetId, setSelectedPetId] = useState("");
  const [healthEvents, setHealthEvents] = useState<VisitPreparationEvent[]>([]);
  const [selectedEventIds, setSelectedEventIds] = useState<number[]>([]);

  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [bookedTimes, setBookedTimes] = useState<string[]>([]);

  const [isCheckingUser, setIsCheckingUser] = useState(true);
  const [isLoadingPets, setIsLoadingPets] = useState(true);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [isLoadingTimes, setIsLoadingTimes] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [noticeMessage, setNoticeMessage] = useState("");

  useEffect(() => {
    async function loadUserAndPets() {
      setIsCheckingUser(true);
      setIsLoadingPets(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setUser(null);
        setIsCheckingUser(false);
        setIsLoadingPets(false);
        return;
      }

      setUser(user);

      const [profileResult, petsResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("display_name, phone")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("pets")
          .select("id, name, species, breed")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      if (profileResult.error) {
        console.warn("보호자 프로필 조회 오류:", profileResult.error.message);
      }

      const profile =
        (profileResult.data as GuardianProfile | null) ?? null;
      const authName =
        typeof user.user_metadata?.full_name === "string"
          ? user.user_metadata.full_name
          : typeof user.user_metadata?.name === "string"
            ? user.user_metadata.name
            : "";
      const authPhone =
        typeof user.user_metadata?.phone === "string"
          ? user.user_metadata.phone
          : user.phone ?? "";

      setGuardianName(profile?.display_name?.trim() || authName.trim());
      setGuardianPhone(profile?.phone?.trim() || authPhone.trim());

      if (petsResult.error) {
        console.error("반려동물 조회 오류:", petsResult.error);
        setErrorMessage(
          "반려동물 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
        );
        setPets([]);
      } else {
        setPets((petsResult.data as Pet[] | null) ?? []);
      }

      setIsCheckingUser(false);
      setIsLoadingPets(false);
    }

    void loadUserAndPets();
  }, []);

  async function loadHealthEvents(petId: string) {
    setSelectedPetId(petId);
    setSelectedEventIds([]);
    setHealthEvents([]);
    setNoticeMessage("");

    const parsedPetId = Number(petId);

    if (!user || !Number.isInteger(parsedPetId)) return;

    setIsLoadingEvents(true);

    const { data, error } = await supabase
      .from("pet_health_events")
      .select(
        "id,occurred_at,event_type,title,severity,priority,count_value,note,share_with_hospital",
      )
      .eq("user_id", user.id)
      .eq("pet_id", parsedPetId)
      .eq("share_with_hospital", true)
      .order("occurred_at", { ascending: false })
      .limit(30);

    if (error) {
      console.error("건강 이벤트 조회 오류:", error);
      setErrorMessage("건강기록을 불러오지 못했습니다.");
    } else {
      setHealthEvents((data as VisitPreparationEvent[] | null) ?? []);
    }

    setIsLoadingEvents(false);
  }

  async function loadBookedTimes(date: string) {
    setSelectedTime("");
    setBookedTimes([]);
    setErrorMessage("");

    if (!date) return;

    const parsedHospitalId = Number(hospitalId);

    if (!Number.isInteger(parsedHospitalId)) {
      setErrorMessage("병원 정보를 확인할 수 없습니다.");
      return;
    }

    setIsLoadingTimes(true);

    const [reservationResult, timeBlockResult] = await Promise.all([
      supabase
        .from("reservations")
        .select("reservation_time")
        .eq("hospital_id", parsedHospitalId)
        .eq("reservation_date", date)
        .in("status", ["requested", "approved"]),
      supabase
        .from("hospital_time_blocks")
        .select("start_time, end_time")
        .eq("hospital_id", parsedHospitalId)
        .eq("block_date", date),
    ]);

    if (reservationResult.error || timeBlockResult.error) {
      console.error(
        "예약 시간 조회 오류:",
        reservationResult.error ?? timeBlockResult.error,
      );
      setErrorMessage(
        "예약 가능한 시간을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
      setIsLoadingTimes(false);
      return;
    }

    const reservationRows =
      (reservationResult.data ?? []) as ReservationTimeRow[];
    const timeBlocks =
      (timeBlockResult.data ?? []) as HospitalTimeBlock[];

    const reservedTimes = reservationRows.map((reservation) =>
      normalizeTime(reservation.reservation_time),
    );

    const temporarilyBlockedTimes = reservationTimes.filter((time) =>
      timeBlocks.some((block) =>
        isTimeInsideBlock(time, block.start_time, block.end_time),
      ),
    );

    setBookedTimes(
      Array.from(new Set([...reservedTimes, ...temporarilyBlockedTimes])),
    );
    setIsLoadingTimes(false);
  }

  function toggleEvent(eventId: number) {
    setSelectedEventIds((current) =>
      current.includes(eventId)
        ? current.filter((id) => id !== eventId)
        : [...current, eventId],
    );
  }

  const selectedEvents = useMemo(
    () => healthEvents.filter((event) => selectedEventIds.includes(event.id)),
    [healthEvents, selectedEventIds],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user) {
      router.push("/auth/login");
      return;
    }

    setIsSaving(true);
    setErrorMessage("");
    setNoticeMessage("");

    const formData = new FormData(event.currentTarget);
    const petId = Number(String(formData.get("petId") ?? ""));
    const guardianName = String(formData.get("guardianName") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const visitReason = String(formData.get("visitReason") ?? "");
    const symptoms = String(formData.get("symptoms") ?? "").trim();
    const parsedHospitalId = Number(hospitalId);

    if (!Number.isInteger(parsedHospitalId)) {
      setErrorMessage("병원 정보를 확인할 수 없습니다.");
      setIsSaving(false);
      return;
    }

    if (!Number.isInteger(petId)) {
      setErrorMessage("예약할 반려동물을 선택해 주세요.");
      setIsSaving(false);
      return;
    }

    if (!selectedDate || !selectedTime) {
      setErrorMessage("희망 날짜와 시간을 선택해 주세요.");
      setIsSaving(false);
      return;
    }

    if (bookedTimes.includes(selectedTime)) {
      setErrorMessage("이미 예약이 마감된 시간입니다.");
      setIsSaving(false);
      return;
    }

    const selectedPet = pets.find((pet) => pet.id === petId);

    if (!selectedPet) {
      setErrorMessage("선택한 반려동물 정보를 확인할 수 없습니다.");
      setIsSaving(false);
      return;
    }

    const [existingReservationResult, timeBlockResult] = await Promise.all([
      supabase
        .from("reservations")
        .select("id")
        .eq("hospital_id", parsedHospitalId)
        .eq("reservation_date", selectedDate)
        .eq("reservation_time", selectedTime)
        .in("status", ["requested", "approved"])
        .limit(1),
      supabase
        .from("hospital_time_blocks")
        .select("start_time, end_time")
        .eq("hospital_id", parsedHospitalId)
        .eq("block_date", selectedDate),
    ]);

    if (existingReservationResult.error || timeBlockResult.error) {
      setErrorMessage("예약 가능 여부를 확인하지 못했습니다.");
      setIsSaving(false);
      return;
    }

    const timeBlocks =
      (timeBlockResult.data ?? []) as HospitalTimeBlock[];

    const isTemporarilyBlocked = timeBlocks.some((block) =>
      isTimeInsideBlock(selectedTime, block.start_time, block.end_time),
    );

    if (
      (existingReservationResult.data ?? []).length > 0 ||
      isTemporarilyBlocked
    ) {
      setBookedTimes((current) =>
        current.includes(selectedTime)
          ? current
          : [...current, selectedTime],
      );
      setSelectedTime("");
      setErrorMessage(
        "방금 예약이 마감된 시간입니다. 다른 시간을 선택해 주세요.",
      );
      setIsSaving(false);
      return;
    }

    const { data: reservation, error: reservationError } = await supabase
      .from("reservations")
      .insert({
        hospital_id: parsedHospitalId,
        user_id: user.id,
        pet_id: selectedPet.id,
        pet_name: selectedPet.name,
        guardian_name: guardianName,
        phone,
        reservation_date: selectedDate,
        reservation_time: selectedTime,
        visit_reason: visitReason,
        symptoms: symptoms || null,
        status: "requested",
      })
      .select("id")
      .single();

    if (reservationError || !reservation) {
      console.error("예약 저장 오류:", reservationError);

      if (reservationError?.code === "23505") {
        setBookedTimes((current) =>
          current.includes(selectedTime)
            ? current
            : [...current, selectedTime],
        );
        setSelectedTime("");
        setErrorMessage("이미 예약된 시간입니다. 다른 시간을 선택해 주세요.");
      } else {
        setErrorMessage("예약 요청을 저장하지 못했습니다.");
      }

      setIsSaving(false);
      return;
    }

    if (selectedEvents.length > 0 || symptoms) {
      const generated = generateVisitPreparationSummary({
        petName: selectedPet.name,
        mainConcern: symptoms,
        events: selectedEvents,
      });

      const title = `${selectedDate} 진료 준비`;

      const { data: preparation, error: preparationError } = await supabase
        .from("visit_preparations")
        .insert({
          user_id: user.id,
          pet_id: selectedPet.id,
          reservation_id: reservation.id,
          title,
          main_concern: symptoms || null,
          status: "linked",
          generated_summary: generated.summary,
          generated_timeline: generated.timeline,
          generated_key_points: generated.keyPoints,
          summary_version: "rule-v1",
          generated_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (preparationError || !preparation) {
        console.error("자동 진료 준비 생성 오류:", preparationError);
        setNoticeMessage(
          "예약은 정상 접수됐지만 건강기록 요약 생성에 실패했습니다. 예약 정보는 병원에 전달됩니다.",
        );
      } else if (selectedEvents.length > 0) {
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
          console.error("진료 준비 이벤트 연결 오류:", linkError);
          setNoticeMessage(
            "예약과 특이사항은 전달됐지만 선택한 건강기록 일부를 연결하지 못했습니다.",
          );
        }
      }
    }

    setSubmitted(true);
    setIsSaving(false);
  }

  if (isCheckingUser) {
    return (
      <main className="min-h-screen bg-gray-50 px-5 py-8">
        <p className="text-center text-gray-500">
          로그인 상태를 확인하는 중입니다.
        </p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-gray-50 px-5 py-8 text-black">
        <div className="mx-auto w-full max-w-md">
          <section className="mt-20 rounded-3xl border border-gray-200 bg-white p-8 text-center">
            <h1 className="text-2xl font-bold">로그인이 필요합니다</h1>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              예약을 요청하려면 먼저 로그인해 주세요.
            </p>
            <Link
              href="/auth/login"
              className="mt-8 block w-full rounded-2xl bg-black px-5 py-4 font-medium text-white"
            >
              로그인하기
            </Link>
          </section>
        </div>
      </main>
    );
  }

  if (submitted) {
    return (
      <main className="min-h-screen bg-white px-5 py-6 text-black">
        <div className="mx-auto w-full max-w-md">
          <section className="mt-20 rounded-3xl border border-gray-200 p-8 text-center">
            <div className="text-4xl">✓</div>
            <h1 className="mt-5 text-2xl font-bold">
              예약 요청을 보냈습니다
            </h1>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              병원이 예약 내용과 선택한 건강기록을 함께 확인합니다.
            </p>

            {noticeMessage && (
              <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-left text-sm leading-6 text-amber-800">
                {noticeMessage}
              </p>
            )}

            <Link
              href="/my-reservations"
              className="mt-8 block w-full rounded-2xl bg-black px-5 py-4 font-medium text-white"
            >
              내 예약 확인
            </Link>
          </section>
        </div>
      </main>
    );
  }

  const unavailableTimeCount = reservationTimes.filter((time) =>
    bookedTimes.includes(time),
  ).length;
  const availableTimeCount =
    reservationTimes.length - unavailableTimeCount;

  return (
    <main className="min-h-screen bg-[#f7f5ef] px-5 py-6 text-black">
      <div className="mx-auto w-full max-w-2xl">
        <Link
          href={`/hospital/${hospitalId}`}
          className="inline-block rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm"
        >
          ← 병원 상세로
        </Link>

        <header className="mt-8">
          <p className="text-sm font-bold text-[#d86c57]">
            PAWU 예약 요청
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-[#153f34]">
            진료 예약
          </h1>
          <p className="mt-3 text-sm leading-6 text-gray-600">
            날짜와 시간을 선택하고, 이번 진료와 관련된 건강기록이 있다면 함께 전달하세요.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <section className="rounded-[28px] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-black text-[#153f34]">
              예약 기본정보
            </h2>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="mb-2 block text-sm font-medium">
                  반려동물
                </span>

                {isLoadingPets ? (
                  <div className="rounded-2xl border px-4 py-3 text-sm text-gray-500">
                    반려동물을 불러오는 중입니다.
                  </div>
                ) : pets.length > 0 ? (
                  <select
                    name="petId"
                    required
                    value={selectedPetId}
                    onChange={(event) =>
                      void loadHealthEvents(event.target.value)
                    }
                    className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3"
                  >
                    <option value="" disabled>
                      반려동물을 선택하세요
                    </option>
                    {pets.map((pet) => (
                      <option key={pet.id} value={pet.id}>
                        {pet.name} · {getSpeciesLabel(pet.species)}
                        {pet.breed ? ` · ${pet.breed}` : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Link href="/pets/new" className="text-sm underline">
                    반려동물 등록하러 가기
                  </Link>
                )}
              </label>

              <label>
                <span className="mb-2 block text-sm font-medium">
                  보호자 이름
                </span>
                <input
                  name="guardianName"
                  required
                  value={guardianName}
                  onChange={(event) => setGuardianName(event.target.value)}
                  autoComplete="name"
                  className="w-full rounded-2xl border border-gray-300 px-4 py-3"
                />
              </label>

              <label>
                <span className="mb-2 block text-sm font-medium">연락처</span>
                <input
                  name="phone"
                  type="tel"
                  required
                  value={guardianPhone}
                  onChange={(event) => setGuardianPhone(event.target.value)}
                  placeholder="010-1234-5678"
                  autoComplete="tel"
                  className="w-full rounded-2xl border border-gray-300 px-4 py-3"
                />
              </label>

              <label>
                <span className="mb-2 block text-sm font-medium">
                  희망 날짜
                </span>
                <input
                  name="reservationDate"
                  type="date"
                  required
                  value={selectedDate}
                  onChange={(event) => {
                    setSelectedDate(event.target.value);
                    void loadBookedTimes(event.target.value);
                  }}
                  className="w-full rounded-2xl border border-gray-300 px-4 py-3"
                />
              </label>

              <label>
                <span className="mb-2 block text-sm font-medium">
                  희망 시간
                </span>
                <select
                  name="reservationTime"
                  required
                  value={selectedTime}
                  onChange={(event) => setSelectedTime(event.target.value)}
                  disabled={
                    !selectedDate ||
                    isLoadingTimes ||
                    availableTimeCount === 0
                  }
                  className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 disabled:bg-gray-100"
                >
                  <option value="" disabled>
                    {!selectedDate
                      ? "날짜를 먼저 선택하세요"
                      : isLoadingTimes
                        ? "시간 확인 중..."
                        : availableTimeCount === 0
                          ? "예약 가능한 시간이 없습니다"
                          : "시간을 선택하세요"}
                  </option>
                  {reservationTimes.map((time) => (
                    <option
                      key={time}
                      value={time}
                      disabled={bookedTimes.includes(time)}
                    >
                      {time}
                      {bookedTimes.includes(time) ? " · 예약 마감" : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label className="sm:col-span-2">
                <span className="mb-2 block text-sm font-medium">
                  방문 목적
                </span>
                <select
                  name="visitReason"
                  required
                  defaultValue=""
                  className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3"
                >
                  <option value="" disabled>
                    방문 목적을 선택하세요
                  </option>
                  <option value="general">일반 진료</option>
                  <option value="vaccination">예방접종</option>
                  <option value="checkup">건강검진</option>
                  <option value="skin">피부·귀 증상</option>
                  <option value="digestive">구토·설사 등 소화기 증상</option>
                  <option value="other">기타</option>
                </select>
              </label>
            </div>
          </section>

          <section className="rounded-[28px] bg-white p-6 shadow-sm">
            <p className="text-sm font-bold text-[#d86c57]">
              건강기록 함께 보내기
            </p>
            <h2 className="mt-1 text-xl font-black text-[#153f34]">
              이번 진료와 관련된 기록
              <span className="ml-2 text-sm font-normal text-gray-400">
                선택사항
              </span>
            </h2>

            {!selectedPetId ? (
              <p className="mt-5 rounded-2xl bg-gray-50 p-5 text-sm text-gray-500">
                반려동물을 먼저 선택하면 건강기록이 표시됩니다.
              </p>
            ) : isLoadingEvents ? (
              <p className="mt-5 text-sm text-gray-500">
                건강기록을 불러오는 중입니다.
              </p>
            ) : healthEvents.length === 0 ? (
              <p className="mt-5 rounded-2xl bg-gray-50 p-5 text-sm text-gray-500">
                병원 공유로 설정된 건강기록이 없습니다. 기록 없이도 예약할 수 있습니다.
              </p>
            ) : (
              <>
                <div className="mt-4 flex justify-end">
                  <span className="rounded-full bg-[#153f34] px-3 py-1 text-xs font-bold text-white">
                    {selectedEventIds.length}개 선택
                  </span>
                </div>

                <div className="mt-3 max-h-[420px] space-y-3 overflow-y-auto pr-1">
                  {healthEvents.map((healthEvent) => {
                    const checked = selectedEventIds.includes(healthEvent.id);

                    return (
                      <label
                        key={healthEvent.id}
                        className={`block cursor-pointer rounded-2xl border p-4 ${
                          checked
                            ? "border-[#153f34] bg-[#eef5f1]"
                            : "border-gray-200"
                        }`}
                      >
                        <div className="flex gap-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleEvent(healthEvent.id)}
                            className="mt-1 h-5 w-5"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap justify-between gap-2">
                              <div>
                                <p className="text-xs font-bold text-[#d86c57]">
                                  {new Date(
                                    healthEvent.occurred_at,
                                  ).toLocaleString("ko-KR")}
                                </p>
                                <p className="mt-1 font-black text-[#153f34]">
                                  {eventLabel(healthEvent)}
                                  {healthEvent.count_value
                                    ? ` · ${healthEvent.count_value}회`
                                    : ""}
                                </p>
                              </div>
                              <span className="h-fit rounded-full bg-white px-3 py-1 text-xs font-bold">
                                {priorityLabels[healthEvent.priority] ??
                                  healthEvent.priority}
                              </span>
                            </div>
                            {healthEvent.note && (
                              <p className="mt-2 line-clamp-2 text-sm leading-6 text-gray-600">
                                {healthEvent.note}
                              </p>
                            )}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </>
            )}
          </section>

          <section className="rounded-[28px] bg-[#fffaf0] p-6 shadow-sm">
            <label>
              <span className="font-bold text-[#153f34]">
                이번 진료의 증상이나 특이사항
              </span>
              <span className="ml-2 text-sm text-gray-400">(선택사항)</span>
              <textarea
                name="symptoms"
                rows={5}
                placeholder="예: 사료를 바꾼 뒤 설사와 구토가 반복돼요."
                className="mt-3 w-full resize-none rounded-2xl border border-gray-300 bg-white px-4 py-3"
              />
            </label>
          </section>

          {errorMessage && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={
              isSaving ||
              isLoadingPets ||
              isLoadingTimes ||
              pets.length === 0 ||
              !selectedPetId ||
              !selectedDate ||
              !selectedTime
            }
            className="w-full rounded-2xl bg-[#153f34] px-5 py-4 text-lg font-bold text-white disabled:bg-gray-400"
          >
            {isSaving ? "예약과 건강기록을 저장하는 중..." : "예약 요청 보내기"}
          </button>
        </form>
      </div>
    </main>
  );
}
