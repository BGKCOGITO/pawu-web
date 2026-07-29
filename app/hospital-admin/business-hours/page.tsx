"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
  id?: number;
  hospital_id: number;
  day_of_week: number;
  is_open: boolean;
  open_time: string | null;
  close_time: string | null;
  break_start_time: string | null;
  break_end_time: string | null;
  slot_interval_minutes: number;
};

type DayForm = {
  dayOfWeek: number;
  label: string;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
  hasBreak: boolean;
  breakStartTime: string;
  breakEndTime: string;
  slotIntervalMinutes: number;
};

const defaultDays: DayForm[] = [
  {
    dayOfWeek: 1,
    label: "월요일",
    isOpen: true,
    openTime: "09:00",
    closeTime: "18:00",
    hasBreak: true,
    breakStartTime: "12:00",
    breakEndTime: "13:00",
    slotIntervalMinutes: 30,
  },
  {
    dayOfWeek: 2,
    label: "화요일",
    isOpen: true,
    openTime: "09:00",
    closeTime: "18:00",
    hasBreak: true,
    breakStartTime: "12:00",
    breakEndTime: "13:00",
    slotIntervalMinutes: 30,
  },
  {
    dayOfWeek: 3,
    label: "수요일",
    isOpen: true,
    openTime: "09:00",
    closeTime: "18:00",
    hasBreak: true,
    breakStartTime: "12:00",
    breakEndTime: "13:00",
    slotIntervalMinutes: 30,
  },
  {
    dayOfWeek: 4,
    label: "목요일",
    isOpen: true,
    openTime: "09:00",
    closeTime: "18:00",
    hasBreak: true,
    breakStartTime: "12:00",
    breakEndTime: "13:00",
    slotIntervalMinutes: 30,
  },
  {
    dayOfWeek: 5,
    label: "금요일",
    isOpen: true,
    openTime: "09:00",
    closeTime: "18:00",
    hasBreak: true,
    breakStartTime: "12:00",
    breakEndTime: "13:00",
    slotIntervalMinutes: 30,
  },
  {
    dayOfWeek: 6,
    label: "토요일",
    isOpen: true,
    openTime: "09:00",
    closeTime: "13:00",
    hasBreak: false,
    breakStartTime: "",
    breakEndTime: "",
    slotIntervalMinutes: 30,
  },
  {
    dayOfWeek: 0,
    label: "일요일",
    isOpen: false,
    openTime: "09:00",
    closeTime: "18:00",
    hasBreak: false,
    breakStartTime: "",
    breakEndTime: "",
    slotIntervalMinutes: 30,
  },
];

function normalizeTime(value: string | null) {
  if (!value) return "";
  return value.slice(0, 5);
}

function validateDay(day: DayForm) {
  if (!day.isOpen) {
    return "";
  }

  if (!day.openTime || !day.closeTime) {
    return `${day.label}의 운영 시작시간과 종료시간을 입력해 주세요.`;
  }

  if (day.openTime >= day.closeTime) {
    return `${day.label}의 종료시간은 시작시간보다 늦어야 합니다.`;
  }

  if (day.hasBreak) {
    if (!day.breakStartTime || !day.breakEndTime) {
      return `${day.label}의 휴게시간을 모두 입력해 주세요.`;
    }

    if (day.breakStartTime >= day.breakEndTime) {
      return `${day.label}의 휴게 종료시간은 시작시간보다 늦어야 합니다.`;
    }

    if (
      day.breakStartTime < day.openTime ||
      day.breakEndTime > day.closeTime
    ) {
      return `${day.label}의 휴게시간은 운영시간 안에 있어야 합니다.`;
    }
  }

  return "";
}

export default function BusinessHoursPage() {
  const [user, setUser] = useState<User | null>(null);
  const [hospital, setHospital] =
    useState<HospitalInfo | null>(null);
  const [days, setDays] = useState<DayForm[]>(defaultDays);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    async function loadBusinessHours() {
      setIsLoading(true);
      setErrorMessage("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        console.error("로그인 정보 조회 오류:", userError);
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

      const { data: hoursData, error: hoursError } =
        await supabase
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
          .eq("hospital_id", linkedHospital.id)
          .order("day_of_week", {
            ascending: true,
          });

      if (hoursError) {
        console.error(
          "운영시간 조회 오류:",
          hoursError
        );
        setErrorMessage(
          "운영시간을 불러오지 못했습니다."
        );
        setIsLoading(false);
        return;
      }

      const rows =
        (hoursData ?? []) as BusinessHourRow[];

      if (rows.length > 0) {
        setDays((currentDays) =>
          currentDays.map((day) => {
            const saved = rows.find(
              (row) =>
                row.day_of_week === day.dayOfWeek
            );

            if (!saved) {
              return day;
            }

            return {
              ...day,
              isOpen: saved.is_open,
              openTime:
                normalizeTime(saved.open_time) ||
                day.openTime,
              closeTime:
                normalizeTime(saved.close_time) ||
                day.closeTime,
              hasBreak:
                Boolean(saved.break_start_time) &&
                Boolean(saved.break_end_time),
              breakStartTime: normalizeTime(
                saved.break_start_time
              ),
              breakEndTime: normalizeTime(
                saved.break_end_time
              ),
              slotIntervalMinutes:
                saved.slot_interval_minutes,
            };
          })
        );
      }

      setIsLoading(false);
    }

    loadBusinessHours();
  }, []);

  function updateDay(
    dayOfWeek: number,
    updates: Partial<DayForm>
  ) {
    setDays((currentDays) =>
      currentDays.map((day) =>
        day.dayOfWeek === dayOfWeek
          ? {
              ...day,
              ...updates,
            }
          : day
      )
    );

    setErrorMessage("");
    setSuccessMessage("");
  }

  async function handleSave() {
    if (!hospital) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    for (const day of days) {
      const validationMessage = validateDay(day);

      if (validationMessage) {
        setErrorMessage(validationMessage);
        return;
      }
    }

    setIsSaving(true);

    const payload = days.map((day) => ({
      hospital_id: hospital.id,
      day_of_week: day.dayOfWeek,
      is_open: day.isOpen,
      open_time: day.isOpen ? day.openTime : null,
      close_time: day.isOpen ? day.closeTime : null,
      break_start_time:
        day.isOpen && day.hasBreak
          ? day.breakStartTime
          : null,
      break_end_time:
        day.isOpen && day.hasBreak
          ? day.breakEndTime
          : null,
      slot_interval_minutes:
        day.slotIntervalMinutes,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from("hospital_business_hours")
      .upsert(payload, {
        onConflict: "hospital_id,day_of_week",
      });

    if (error) {
      console.error("운영시간 저장 오류:", error);
      setErrorMessage(
        "운영시간을 저장하지 못했습니다."
      );
      setIsSaving(false);
      return;
    }

    setSuccessMessage(
      "병원 운영시간이 저장되었습니다."
    );
    setIsSaving(false);
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gray-50 px-5 py-10 text-black">
        <p className="text-center text-gray-500">
          운영시간을 불러오는 중입니다.
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
              운영시간을 관리할 수 없습니다
            </h1>

            <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700">
              {errorMessage}
            </p>
          </section>
        </div>
      </main>
    );
  }

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
            운영시간 관리
          </h1>

          <p className="mt-3 text-sm text-gray-600">
            {hospital?.name}
          </p>
        </header>

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

        <section className="mt-8 space-y-4">
          {days.map((day) => (
            <article
              key={day.dayOfWeek}
              className="rounded-3xl border border-gray-200 bg-white p-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold">
                    {day.label}
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    {day.isOpen
                      ? "진료하는 날입니다."
                      : "휴무일입니다."}
                  </p>
                </div>

                <label className="flex cursor-pointer items-center gap-3">
                  <span className="text-sm font-medium">
                    {day.isOpen ? "영업" : "휴무"}
                  </span>

                  <input
                    type="checkbox"
                    checked={day.isOpen}
                    onChange={(event) =>
                      updateDay(day.dayOfWeek, {
                        isOpen: event.target.checked,
                      })
                    }
                    className="h-5 w-5"
                  />
                </label>
              </div>

              {day.isOpen && (
                <div className="mt-6 space-y-6">
                  <div>
                    <h3 className="text-sm font-semibold">
                      운영시간
                    </h3>

                    <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                      <input
                        type="time"
                        value={day.openTime}
                        onChange={(event) =>
                          updateDay(day.dayOfWeek, {
                            openTime:
                              event.target.value,
                          })
                        }
                        className="rounded-2xl border border-gray-300 px-4 py-3"
                      />

                      <span className="text-gray-400">
                        ~
                      </span>

                      <input
                        type="time"
                        value={day.closeTime}
                        onChange={(event) =>
                          updateDay(day.dayOfWeek, {
                            closeTime:
                              event.target.value,
                          })
                        }
                        className="rounded-2xl border border-gray-300 px-4 py-3"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="flex cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        checked={day.hasBreak}
                        onChange={(event) =>
                          updateDay(day.dayOfWeek, {
                            hasBreak:
                              event.target.checked,
                          })
                        }
                        className="h-5 w-5"
                      />

                      <span className="text-sm font-semibold">
                        휴게시간 사용
                      </span>
                    </label>

                    {day.hasBreak && (
                      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                        <input
                          type="time"
                          value={day.breakStartTime}
                          onChange={(event) =>
                            updateDay(
                              day.dayOfWeek,
                              {
                                breakStartTime:
                                  event.target.value,
                              }
                            )
                          }
                          className="rounded-2xl border border-gray-300 px-4 py-3"
                        />

                        <span className="text-gray-400">
                          ~
                        </span>

                        <input
                          type="time"
                          value={day.breakEndTime}
                          onChange={(event) =>
                            updateDay(
                              day.dayOfWeek,
                              {
                                breakEndTime:
                                  event.target.value,
                              }
                            )
                          }
                          className="rounded-2xl border border-gray-300 px-4 py-3"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor={`interval-${day.dayOfWeek}`}
                      className="text-sm font-semibold"
                    >
                      예약 간격
                    </label>

                    <select
                      id={`interval-${day.dayOfWeek}`}
                      value={day.slotIntervalMinutes}
                      onChange={(event) =>
                        updateDay(day.dayOfWeek, {
                          slotIntervalMinutes:
                            Number(
                              event.target.value
                            ),
                        })
                      }
                      className="mt-3 w-full rounded-2xl border border-gray-300 bg-white px-4 py-3"
                    >
                      <option value={10}>10분</option>
                      <option value={15}>15분</option>
                      <option value={20}>20분</option>
                      <option value={30}>30분</option>
                      <option value={60}>60분</option>
                    </select>
                  </div>
                </div>
              )}
            </article>
          ))}
        </section>

        <div className="sticky bottom-0 mt-8 border-t border-gray-200 bg-gray-50 py-5">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="w-full rounded-2xl bg-black px-5 py-4 font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {isSaving
              ? "운영시간 저장 중..."
              : "운영시간 저장"}
          </button>
        </div>
      </div>
    </main>
  );
}