"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../../../lib/supabase";

type HospitalInfo = {
  id: number;
  name: string;
};

type HospitalAdminRow = {
  hospital_id: number;
  hospitals: HospitalInfo | HospitalInfo[] | null;
};

type BusinessHourRow = {
  id: number;
  hospital_id: number;
  day_of_week: number;
  is_open: boolean;
  open_time: string | null;
  close_time: string | null;
  break_start_time: string | null;
  break_end_time: string | null;
  slot_interval_minutes: number;
};

type ReservationRow = {
  id: number;
  reservation_time: string;
  status: string;
  pet_name: string;
};

type TimeBlockRow = {
  id: number;
  hospital_id: number;
  block_date: string;
  start_time: string;
  end_time: string;
  reason: string | null;
};

type TimeSlot = {
  startTime: string;
  endTime: string;
  isReserved: boolean;
  reservationId: number | null;
  petName: string | null;
  isBlocked: boolean;
  blockId: number | null;
};

function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function normalizeTime(value: string | null) {
  if (!value) {
    return "";
  }

  return value.slice(0, 5);
}

function timeToMinutes(time: string) {
  const [hour, minute] = time.split(":").map(Number);

  return hour * 60 + minute;
}

function minutesToTime(totalMinutes: number) {
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;

  return `${String(hour).padStart(2, "0")}:${String(
    minute
  ).padStart(2, "0")}`;
}

function getDayOfWeek(dateString: string) {
  const [year, month, day] = dateString
    .split("-")
    .map(Number);

  const date = new Date(year, month - 1, day);

  return date.getDay();
}

function getDayLabel(dayOfWeek: number) {
  switch (dayOfWeek) {
    case 0:
      return "일요일";
    case 1:
      return "월요일";
    case 2:
      return "화요일";
    case 3:
      return "수요일";
    case 4:
      return "목요일";
    case 5:
      return "금요일";
    case 6:
      return "토요일";
    default:
      return "";
  }
}

function createTimeSlots(
  businessHour: BusinessHourRow,
  reservations: ReservationRow[],
  blocks: TimeBlockRow[]
) {
  if (
    !businessHour.is_open ||
    !businessHour.open_time ||
    !businessHour.close_time
  ) {
    return [];
  }

  const openMinutes = timeToMinutes(
    normalizeTime(businessHour.open_time)
  );

  const closeMinutes = timeToMinutes(
    normalizeTime(businessHour.close_time)
  );

  const breakStartMinutes =
    businessHour.break_start_time !== null
      ? timeToMinutes(
          normalizeTime(businessHour.break_start_time)
        )
      : null;

  const breakEndMinutes =
    businessHour.break_end_time !== null
      ? timeToMinutes(
          normalizeTime(businessHour.break_end_time)
        )
      : null;

  const interval = businessHour.slot_interval_minutes;

  const slots: TimeSlot[] = [];

  for (
    let startMinutes = openMinutes;
    startMinutes + interval <= closeMinutes;
    startMinutes += interval
  ) {
    const endMinutes = startMinutes + interval;

    const overlapsBreak =
      breakStartMinutes !== null &&
      breakEndMinutes !== null &&
      startMinutes < breakEndMinutes &&
      endMinutes > breakStartMinutes;

    if (overlapsBreak) {
      continue;
    }

    const startTime = minutesToTime(startMinutes);
    const endTime = minutesToTime(endMinutes);

    const reservation =
      reservations.find(
        (item) =>
          normalizeTime(item.reservation_time) === startTime
      ) ?? null;

    const block =
      blocks.find(
        (item) =>
          normalizeTime(item.start_time) === startTime &&
          normalizeTime(item.end_time) === endTime
      ) ?? null;

    slots.push({
      startTime,
      endTime,
      isReserved: Boolean(reservation),
      reservationId: reservation?.id ?? null,
      petName: reservation?.pet_name ?? null,
      isBlocked: Boolean(block),
      blockId: block?.id ?? null,
    });
  }

  return slots;
}

export default function TimeBlocksPage() {
  const [user, setUser] = useState<User | null>(null);

  const [hospital, setHospital] =
    useState<HospitalInfo | null>(null);

  const [selectedDate, setSelectedDate] = useState(
    getTodayString()
  );

  const [businessHour, setBusinessHour] =
    useState<BusinessHourRow | null>(null);

  const [reservations, setReservations] = useState<
    ReservationRow[]
  >([]);

  const [blocks, setBlocks] = useState<TimeBlockRow[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSchedule, setIsLoadingSchedule] =
    useState(false);

  const [changingTime, setChangingTime] = useState<
    string | null
  >(null);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const timeSlots = useMemo(() => {
    if (!businessHour) {
      return [];
    }

    return createTimeSlots(
      businessHour,
      reservations,
      blocks
    );
  }, [businessHour, reservations, blocks]);

  useEffect(() => {
    async function loadAdminHospital() {
      setIsLoading(true);
      setErrorMessage("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        console.error(
          "로그인 정보 조회 오류:",
          userError
        );

        setErrorMessage(
          "로그인 정보를 확인하지 못했습니다."
        );

        setIsLoading(false);
        return;
      }

      setUser(user);

      if (!user) {
        setIsLoading(false);
        return;
      }

      const { data: adminData, error: adminError } =
        await supabase
          .from("hospital_admins")
          .select(
            `
              hospital_id,
              hospitals (
                id,
                name
              )
            `
          )
          .eq("user_id", user.id)
          .maybeSingle();

      if (adminError) {
        console.error(
          "병원 관리자 조회 오류:",
          adminError
        );

        setErrorMessage(
          "병원 관리자 정보를 불러오지 못했습니다."
        );

        setIsLoading(false);
        return;
      }

      if (!adminData) {
        setErrorMessage(
          "이 계정에 연결된 병원이 없습니다."
        );

        setIsLoading(false);
        return;
      }

      const admin =
        adminData as unknown as HospitalAdminRow;

      const linkedHospital = Array.isArray(
        admin.hospitals
      )
        ? admin.hospitals[0] ?? null
        : admin.hospitals;

      if (!linkedHospital) {
        setErrorMessage(
          "연결된 병원 정보를 찾지 못했습니다."
        );

        setIsLoading(false);
        return;
      }

      setHospital(linkedHospital);
      setIsLoading(false);
    }

    loadAdminHospital();
  }, []);

  useEffect(() => {
    async function loadSchedule() {
      if (!hospital || !selectedDate) {
        return;
      }

      setIsLoadingSchedule(true);
      setErrorMessage("");
      setSuccessMessage("");

      const dayOfWeek = getDayOfWeek(selectedDate);

      const [
        businessHourResult,
        reservationsResult,
        blocksResult,
      ] = await Promise.all([
        supabase
          .from("hospital_business_hours")
          .select(
            `
              id,
              hospital_id,
              day_of_week,
              is_open,
              open_time,
              close_time,
              break_start_time,
              break_end_time,
              slot_interval_minutes
            `
          )
          .eq("hospital_id", hospital.id)
          .eq("day_of_week", dayOfWeek)
          .maybeSingle(),

        supabase
          .from("reservations")
          .select(
            `
              id,
              reservation_time,
              status,
              pet_name
            `
          )
          .eq("hospital_id", hospital.id)
          .eq("reservation_date", selectedDate)
          .in("status", ["requested", "approved"]),

        supabase
          .from("hospital_time_blocks")
          .select(
            `
              id,
              hospital_id,
              block_date,
              start_time,
              end_time,
              reason
            `
          )
          .eq("hospital_id", hospital.id)
          .eq("block_date", selectedDate)
          .order("start_time", {
            ascending: true,
          }),
      ]);

      if (businessHourResult.error) {
        console.error(
          "운영시간 조회 오류:",
          businessHourResult.error
        );

        setErrorMessage(
          "선택한 날짜의 운영시간을 불러오지 못했습니다."
        );

        setBusinessHour(null);
        setReservations([]);
        setBlocks([]);
        setIsLoadingSchedule(false);
        return;
      }

      if (reservationsResult.error) {
        console.error(
          "예약 조회 오류:",
          reservationsResult.error
        );

        setErrorMessage(
          "선택한 날짜의 예약을 불러오지 못했습니다."
        );

        setBusinessHour(null);
        setReservations([]);
        setBlocks([]);
        setIsLoadingSchedule(false);
        return;
      }

      if (blocksResult.error) {
        console.error(
          "마감시간 조회 오류:",
          blocksResult.error
        );

        setErrorMessage(
          "임시 마감시간을 불러오지 못했습니다."
        );

        setBusinessHour(null);
        setReservations([]);
        setBlocks([]);
        setIsLoadingSchedule(false);
        return;
      }

      setBusinessHour(
        businessHourResult.data as BusinessHourRow | null
      );

      setReservations(
        (reservationsResult.data ??
          []) as ReservationRow[]
      );

      setBlocks(
        (blocksResult.data ?? []) as TimeBlockRow[]
      );

      setIsLoadingSchedule(false);
    }

    loadSchedule();
  }, [hospital, selectedDate]);

  async function handleToggleBlock(slot: TimeSlot) {
    if (!hospital) {
      return;
    }

    if (slot.isReserved) {
      setErrorMessage(
        "이미 예약이 있는 시간은 변경할 수 없습니다."
      );
      return;
    }

    setChangingTime(slot.startTime);
    setErrorMessage("");
    setSuccessMessage("");

    if (slot.isBlocked && slot.blockId !== null) {
      const { error } = await supabase
        .from("hospital_time_blocks")
        .delete()
        .eq("id", slot.blockId)
        .eq("hospital_id", hospital.id);

      if (error) {
        console.error(
          "예약시간 재오픈 오류:",
          error
        );

        setErrorMessage(
          "예약시간을 다시 열지 못했습니다."
        );

        setChangingTime(null);
        return;
      }

      setBlocks((currentBlocks) =>
        currentBlocks.filter(
          (block) => block.id !== slot.blockId
        )
      );

      setSuccessMessage(
        `${slot.startTime} 예약시간을 다시 열었습니다.`
      );

      setChangingTime(null);
      return;
    }

    const { data, error } = await supabase
      .from("hospital_time_blocks")
      .insert({
        hospital_id: hospital.id,
        block_date: selectedDate,
        start_time: slot.startTime,
        end_time: slot.endTime,
        reason: "병원 관리자 임시 마감",
      })
      .select(
        `
          id,
          hospital_id,
          block_date,
          start_time,
          end_time,
          reason
        `
      )
      .single();

    if (error) {
      console.error("예약시간 마감 오류:", error);

      if (error.code === "23505") {
        setErrorMessage(
          "이미 임시 마감된 시간입니다."
        );
      } else {
        setErrorMessage(
          "예약시간을 마감하지 못했습니다."
        );
      }

      setChangingTime(null);
      return;
    }

    setBlocks((currentBlocks) => [
      ...currentBlocks,
      data as TimeBlockRow,
    ]);

    setSuccessMessage(
      `${slot.startTime} 예약시간을 임시 마감했습니다.`
    );

    setChangingTime(null);
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gray-50 px-5 py-10 text-black">
        <p className="text-center text-gray-500">
          병원 관리자 정보를 불러오는 중입니다.
        </p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-gray-50 px-5 py-10 text-black">
        <div className="mx-auto max-w-md">
          <section className="mt-20 rounded-3xl border border-gray-200 bg-white p-8 text-center">
            <h1 className="text-2xl font-bold">
              로그인이 필요합니다
            </h1>

            <p className="mt-3 text-sm text-gray-600">
              병원 관리자 계정으로 로그인해 주세요.
            </p>

            <Link
              href="/auth/login"
              className="mt-8 block rounded-2xl bg-black px-5 py-4 font-semibold text-white"
            >
              로그인하기
            </Link>
          </section>
        </div>
      </main>
    );
  }

  if (errorMessage && !hospital) {
    return (
      <main className="min-h-screen bg-gray-50 px-5 py-10 text-black">
        <div className="mx-auto max-w-2xl">
          <Link
            href="/hospital-admin"
            className="inline-block rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm"
          >
            ← 관리자 홈
          </Link>

          <section className="mt-8 rounded-3xl border border-red-200 bg-white p-8">
            <h1 className="text-2xl font-bold">
              예약시간을 관리할 수 없습니다
            </h1>

            <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700">
              {errorMessage}
            </p>
          </section>
        </div>
      </main>
    );
  }

  const selectedDayOfWeek =
    getDayOfWeek(selectedDate);

  return (
    <main className="min-h-screen bg-gray-50 px-5 py-8 text-black">
      <div className="mx-auto w-full max-w-4xl">
        <Link
          href="/hospital-admin"
          className="inline-block rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm"
        >
          ← 관리자 홈
        </Link>

        <header className="mt-8">
          <p className="text-sm text-gray-500">
            PAWU 병원 관리자
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            예약시간 열기·닫기
          </h1>

          <p className="mt-3 text-sm text-gray-600">
            {hospital?.name}
          </p>
        </header>

        <section className="mt-8 rounded-3xl border border-gray-200 bg-white p-6">
          <label
            htmlFor="schedule-date"
            className="text-sm font-semibold"
          >
            관리할 날짜
          </label>

          <input
            id="schedule-date"
            type="date"
            min={getTodayString()}
            value={selectedDate}
            onChange={(event) =>
              setSelectedDate(event.target.value)
            }
            className="mt-3 w-full rounded-2xl border border-gray-300 px-4 py-3"
          />

          <p className="mt-3 text-sm text-gray-500">
            {selectedDate} ·{" "}
            {getDayLabel(selectedDayOfWeek)}
          </p>
        </section>

        {successMessage && (
          <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-5 text-sm text-green-700">
            {successMessage}
          </div>
        )}

        {errorMessage && hospital && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {isLoadingSchedule && (
          <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-8 text-center">
            <p className="text-sm text-gray-500">
              예약시간을 불러오는 중입니다.
            </p>
          </section>
        )}

        {!isLoadingSchedule && !businessHour && (
          <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-8 text-center">
            <h2 className="text-xl font-bold">
              운영시간이 등록되지 않았습니다
            </h2>

            <p className="mt-3 text-sm leading-6 text-gray-500">
              선택한 요일의 운영시간을 먼저 등록해 주세요.
            </p>

            <Link
              href="/hospital-admin/business-hours"
              className="mt-6 inline-block rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white"
            >
              운영시간 설정하기
            </Link>
          </section>
        )}

        {!isLoadingSchedule &&
          businessHour &&
          !businessHour.is_open && (
            <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-8 text-center">
              <h2 className="text-xl font-bold">
                휴무일입니다
              </h2>

              <p className="mt-3 text-sm text-gray-500">
                선택한 날짜는 운영시간 설정에서 휴무로
                지정되어 있습니다.
              </p>
            </section>
          )}

        {!isLoadingSchedule &&
          businessHour?.is_open &&
          timeSlots.length === 0 && (
            <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-8 text-center">
              <h2 className="text-xl font-bold">
                생성할 예약시간이 없습니다
              </h2>

              <p className="mt-3 text-sm text-gray-500">
                운영시간과 예약 간격을 확인해 주세요.
              </p>
            </section>
          )}

        {!isLoadingSchedule &&
          businessHour?.is_open &&
          timeSlots.length > 0 && (
            <section className="mt-8">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-sm text-gray-500">
                    시간별 예약 상태
                  </p>

                  <h2 className="mt-1 text-2xl font-bold">
                    {getDayLabel(selectedDayOfWeek)} 일정
                  </h2>
                </div>

                <p className="text-sm text-gray-500">
                  예약 간격{" "}
                  {businessHour.slot_interval_minutes}분
                </p>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {timeSlots.map((slot) => {
                  const isChanging =
                    changingTime === slot.startTime;

                  if (slot.isReserved) {
                    return (
                      <article
                        key={slot.startTime}
                        className="rounded-3xl border border-green-200 bg-green-50 p-5"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-xl font-bold text-green-900">
                              {slot.startTime}
                            </p>

                            <p className="mt-1 text-sm text-green-700">
                              {slot.startTime} ~{" "}
                              {slot.endTime}
                            </p>
                          </div>

                          <span className="rounded-full bg-green-200 px-3 py-1 text-xs font-semibold text-green-800">
                            예약 있음
                          </span>
                        </div>

                        <p className="mt-4 text-sm text-green-800">
                          반려동물:{" "}
                          {slot.petName || "이름 미등록"}
                        </p>

                        <button
                          type="button"
                          disabled
                          className="mt-4 w-full cursor-not-allowed rounded-2xl bg-green-100 px-4 py-3 text-sm font-semibold text-green-500"
                        >
                          예약이 있어 변경할 수 없음
                        </button>
                      </article>
                    );
                  }

                  if (slot.isBlocked) {
                    return (
                      <article
                        key={slot.startTime}
                        className="rounded-3xl border border-red-200 bg-red-50 p-5"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-xl font-bold text-red-900">
                              {slot.startTime}
                            </p>

                            <p className="mt-1 text-sm text-red-700">
                              {slot.startTime} ~{" "}
                              {slot.endTime}
                            </p>
                          </div>

                          <span className="rounded-full bg-red-200 px-3 py-1 text-xs font-semibold text-red-800">
                            임시 마감
                          </span>
                        </div>

                        <p className="mt-4 text-sm text-red-700">
                          사용자 예약 화면에서 선택할 수
                          없는 시간입니다.
                        </p>

                        <button
                          type="button"
                          onClick={() =>
                            handleToggleBlock(slot)
                          }
                          disabled={
                            isChanging ||
                            changingTime !== null
                          }
                          className="mt-4 w-full rounded-2xl border border-red-300 bg-white px-4 py-3 text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                        >
                          {isChanging
                            ? "처리 중..."
                            : "예약시간 다시 열기"}
                        </button>
                      </article>
                    );
                  }

                  return (
                    <article
                      key={slot.startTime}
                      className="rounded-3xl border border-gray-200 bg-white p-5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xl font-bold">
                            {slot.startTime}
                          </p>

                          <p className="mt-1 text-sm text-gray-500">
                            {slot.startTime} ~{" "}
                            {slot.endTime}
                          </p>
                        </div>

                        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
                          예약 가능
                        </span>
                      </div>

                      <p className="mt-4 text-sm text-gray-500">
                        현재 사용자가 예약할 수 있는
                        시간입니다.
                      </p>

                      <button
                        type="button"
                        onClick={() =>
                          handleToggleBlock(slot)
                        }
                        disabled={
                          isChanging ||
                          changingTime !== null
                        }
                        className="mt-4 w-full rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-400"
                      >
                        {isChanging
                          ? "처리 중..."
                          : "이 시간 임시 마감"}
                      </button>
                    </article>
                  );
                })}
              </div>
            </section>
          )}
      </div>
    </main>
  );
}