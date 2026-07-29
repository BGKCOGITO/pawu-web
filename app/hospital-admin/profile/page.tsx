"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../../../lib/supabase";

type Hospital = {
  id: number;
  name: string;
  address: string;
  phone: string | null;
  latitude: number;
  longitude: number;
  reservation_enabled: boolean;
  description: string | null;
  image_url: string | null;
  services: string[] | null;
  supported_animals: string[] | null;
  parking_available: boolean;
  night_care_available: boolean;
  emergency_care_available: boolean;
  is_published: boolean;
};

type HospitalAdminRow = {
  id: number;
  user_id: string;
  hospital_id: number;
  hospitals: Hospital | Hospital[] | null;
};

function getSingleRelation<T>(relation: T | T[] | null) {
  if (Array.isArray(relation)) {
    return relation[0] ?? null;
  }

  return relation;
}

function splitCommaValues(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function HospitalProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [hospital, setHospital] = useState<Hospital | null>(null);
  const [servicesInput, setServicesInput] = useState("");
  const [animalsInput, setAnimalsInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    async function loadHospital() {
      setIsLoading(true);
      setErrorMessage("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        console.error("로그인 정보 조회 오류:", userError);
        setErrorMessage("로그인 정보를 확인하지 못했습니다.");
        setIsLoading(false);
        return;
      }

      setUser(user);

      if (!user) {
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("hospital_admins")
        .select(
          `
            id,
            user_id,
            hospital_id,
            hospitals (
              id,
              name,
              address,
              phone,
              latitude,
              longitude,
              reservation_enabled,
              description,
              image_url,
              services,
              supported_animals,
              parking_available,
              night_care_available,
              emergency_care_available,
              is_published
            )
          `,
        )
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("병원 정보 조회 오류:", error);
        setErrorMessage("병원 정보를 불러오지 못했습니다.");
        setIsLoading(false);
        return;
      }

      if (!data) {
        setErrorMessage("이 계정에 연결된 병원이 없습니다.");
        setIsLoading(false);
        return;
      }

      const admin = data as unknown as HospitalAdminRow;
      const linkedHospital = getSingleRelation(admin.hospitals);

      if (!linkedHospital) {
        setErrorMessage("연결된 병원 정보를 찾지 못했습니다.");
        setIsLoading(false);
        return;
      }

      setHospital(linkedHospital);
      setServicesInput((linkedHospital.services ?? []).join(", "));
      setAnimalsInput((linkedHospital.supported_animals ?? []).join(", "));
      setIsLoading(false);
    }

    loadHospital();
  }, []);

  function updateField<K extends keyof Hospital>(
    field: K,
    value: Hospital[K],
  ) {
    setHospital((current) =>
      current ? { ...current, [field]: value } : current,
    );
    setSuccessMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user || !hospital) return;

    if (!hospital.name.trim() || !hospital.address.trim()) {
      setErrorMessage("병원명과 주소는 필수입니다.");
      return;
    }

    if (
      !Number.isFinite(Number(hospital.latitude)) ||
      !Number.isFinite(Number(hospital.longitude))
    ) {
      setErrorMessage("위도와 경도를 올바르게 입력해 주세요.");
      return;
    }

    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    const updatePayload = {
      name: hospital.name.trim(),
      address: hospital.address.trim(),
      phone: hospital.phone?.trim() || null,
      latitude: Number(hospital.latitude),
      longitude: Number(hospital.longitude),
      reservation_enabled: hospital.reservation_enabled,
      description: hospital.description?.trim() || null,
      image_url: hospital.image_url?.trim() || null,
      services: splitCommaValues(servicesInput),
      supported_animals: splitCommaValues(animalsInput),
      parking_available: hospital.parking_available,
      night_care_available: hospital.night_care_available,
      emergency_care_available: hospital.emergency_care_available,
      is_published: hospital.is_published,
    };

    const { data, error } = await supabase
      .from("hospitals")
      .update(updatePayload)
      .eq("id", hospital.id)
      .select(
        `
          id,
          name,
          address,
          phone,
          latitude,
          longitude,
          reservation_enabled,
          description,
          image_url,
          services,
          supported_animals,
          parking_available,
          night_care_available,
          emergency_care_available,
          is_published
        `,
      )
      .single();

    if (error || !data) {
      console.error("병원 정보 저장 오류:", error);
      setErrorMessage("병원 정보를 저장하지 못했습니다.");
      setIsSaving(false);
      return;
    }

    const savedHospital = data as Hospital;
    setHospital(savedHospital);
    setServicesInput((savedHospital.services ?? []).join(", "));
    setAnimalsInput((savedHospital.supported_animals ?? []).join(", "));
    setSuccessMessage("병원 정보가 저장되었습니다.");
    setIsSaving(false);
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gray-50 px-5 py-10 text-black">
        <p className="text-center text-sm text-gray-500">
          병원 정보를 불러오는 중입니다.
        </p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-gray-50 px-5 py-10 text-black">
        <div className="mx-auto max-w-md">
          <section className="mt-20 rounded-3xl border border-gray-200 bg-white p-8 text-center">
            <h1 className="text-2xl font-bold">로그인이 필요합니다</h1>
            <p className="mt-3 text-sm text-gray-500">
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

  if (!hospital) {
    return (
      <main className="min-h-screen bg-gray-50 px-5 py-10 text-black">
        <div className="mx-auto max-w-2xl">
          <Link
            href="/hospital-admin"
            className="inline-block rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm"
          >
            ← 병원 대시보드
          </Link>
          <section className="mt-8 rounded-3xl border border-red-200 bg-white p-8">
            <h1 className="text-2xl font-bold">
              병원 정보를 열 수 없습니다
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/hospital-admin"
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm"
          >
            ← 병원 대시보드
          </Link>

          <Link
            href={`/hospital/${hospital.id}`}
            target="_blank"
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold"
          >
            공개 화면 미리보기 ↗
          </Link>
        </div>

        <header className="mt-8">
          <p className="text-sm text-gray-500">PAWU 병원 관리자</p>
          <h1 className="mt-2 text-3xl font-bold">병원 정보 관리</h1>
          <p className="mt-3 text-sm leading-6 text-gray-600">
            보호자가 보는 병원 상세정보와 공개 상태를 수정합니다.
          </p>
        </header>

        {errorMessage && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <section className="rounded-3xl border border-gray-200 bg-white p-6">
            <h2 className="text-xl font-bold">기본 정보</h2>

            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium">병원명</span>
                <input
                  value={hospital.name}
                  onChange={(event) =>
                    updateField("name", event.target.value)
                  }
                  required
                  className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-black"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium">
                  전화번호
                </span>
                <input
                  value={hospital.phone ?? ""}
                  onChange={(event) =>
                    updateField("phone", event.target.value)
                  }
                  placeholder="041-123-4567"
                  className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-black"
                />
              </label>
            </div>

            <label className="mt-5 block">
              <span className="mb-2 block text-sm font-medium">주소</span>
              <input
                value={hospital.address}
                onChange={(event) =>
                  updateField("address", event.target.value)
                }
                required
                className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-black"
              />
            </label>

            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium">위도</span>
                <input
                  type="number"
                  step="any"
                  value={hospital.latitude}
                  onChange={(event) =>
                    updateField("latitude", Number(event.target.value))
                  }
                  className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-black"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium">경도</span>
                <input
                  type="number"
                  step="any"
                  value={hospital.longitude}
                  onChange={(event) =>
                    updateField("longitude", Number(event.target.value))
                  }
                  className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-black"
                />
              </label>
            </div>
          </section>

          <section className="rounded-3xl border border-gray-200 bg-white p-6">
            <h2 className="text-xl font-bold">소개와 대표 이미지</h2>

            <label className="mt-5 block">
              <span className="mb-2 block text-sm font-medium">병원 소개</span>
              <textarea
                value={hospital.description ?? ""}
                onChange={(event) =>
                  updateField("description", event.target.value)
                }
                rows={6}
                placeholder="병원의 특징, 진료 철학, 의료진과 시설을 소개해 주세요."
                className="w-full resize-y rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-black"
              />
            </label>

            <label className="mt-5 block">
              <span className="mb-2 block text-sm font-medium">
                대표 이미지 URL
              </span>
              <input
                type="url"
                value={hospital.image_url ?? ""}
                onChange={(event) =>
                  updateField("image_url", event.target.value)
                }
                placeholder="https://..."
                className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-black"
              />
              <span className="mt-2 block text-xs text-gray-500">
                이번 버전은 이미지 주소를 입력하는 방식입니다.
              </span>
            </label>

            {hospital.image_url && (
              <div className="mt-5 overflow-hidden rounded-2xl border border-gray-200 bg-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={hospital.image_url}
                  alt={`${hospital.name} 대표 이미지 미리보기`}
                  className="h-64 w-full object-cover"
                />
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-gray-200 bg-white p-6">
            <h2 className="text-xl font-bold">진료 정보</h2>

            <label className="mt-5 block">
              <span className="mb-2 block text-sm font-medium">
                진료 항목
              </span>
              <input
                value={servicesInput}
                onChange={(event) => setServicesInput(event.target.value)}
                placeholder="일반진료, 예방접종, 건강검진, 피부과"
                className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-black"
              />
              <span className="mt-2 block text-xs text-gray-500">
                여러 항목은 쉼표로 구분해 주세요.
              </span>
            </label>

            <label className="mt-5 block">
              <span className="mb-2 block text-sm font-medium">
                진료 가능한 동물
              </span>
              <input
                value={animalsInput}
                onChange={(event) => setAnimalsInput(event.target.value)}
                placeholder="강아지, 고양이, 소동물"
                className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-black"
              />
            </label>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                {
                  field: "parking_available" as const,
                  label: "주차 가능",
                  description: "보호자용 주차 공간 제공",
                },
                {
                  field: "night_care_available" as const,
                  label: "야간 진료",
                  description: "야간 시간대 진료 제공",
                },
                {
                  field: "emergency_care_available" as const,
                  label: "응급 진료",
                  description: "응급 환자 진료 제공",
                },
                {
                  field: "reservation_enabled" as const,
                  label: "PAWU 예약 받기",
                  description: "보호자가 온라인 예약 요청 가능",
                },
              ].map((item) => (
                <label
                  key={item.field}
                  className="flex cursor-pointer items-start gap-3 rounded-2xl border border-gray-200 p-4"
                >
                  <input
                    type="checkbox"
                    checked={hospital[item.field]}
                    onChange={(event) =>
                      updateField(item.field, event.target.checked)
                    }
                    className="mt-1 h-4 w-4"
                  />
                  <span>
                    <span className="block font-semibold">{item.label}</span>
                    <span className="mt-1 block text-xs text-gray-500">
                      {item.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-blue-200 bg-blue-50 p-6">
            <div className="flex items-start gap-3">
              <input
                id="is-published"
                type="checkbox"
                checked={hospital.is_published}
                onChange={(event) =>
                  updateField("is_published", event.target.checked)
                }
                className="mt-1 h-5 w-5"
              />

              <label htmlFor="is-published" className="cursor-pointer">
                <span className="block text-lg font-bold text-blue-950">
                  병원 정보 공개
                </span>
                <span className="mt-1 block text-sm leading-6 text-blue-800">
                  해제하면 보호자용 병원 상세화면에서 병원이 보이지
                  않습니다. 관리자 페이지에서는 계속 수정할 수 있습니다.
                </span>
              </label>
            </div>
          </section>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full rounded-2xl bg-black px-5 py-4 text-lg font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {isSaving ? "저장 중..." : "병원 정보 저장"}
          </button>
        </form>
      </div>
    </main>
  );
}
