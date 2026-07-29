"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";

type PetInfo = {
  id: number;
  name: string;
  species: "dog" | "cat" | "other";
  breed: string | null;
  gender: "male" | "female" | "unknown" | null;
  weight_kg: number | null;
};

type HospitalInfo = {
  id: number;
  name: string;
};

type MedicationSchedule = {
  id: number;
  prescription_id: number;
  scheduled_time: string;
};

type Prescription = {
  id: number;
  medical_record_id: number;
  medicine_name: string;
  dosage: string;
  instructions: string | null;
  times_per_day: number;
  duration_days: number;
  start_date: string;
  end_date: string;
  medication_schedules: MedicationSchedule[] | null;
};

type VaccinationRecord = {
  id: number;
  medical_record_id: number;
  vaccine_name: string;
  manufacturer: string | null;
  vaccinated_at: string;
  next_due_date: string | null;
  memo: string | null;
};

type MedicalPrescriptionSchedule = {
  id: number;
  scheduled_time: string;
};

type MedicalPrescription = {
  id: number;
  medical_record_id: number;
  medication_name: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  route: string | null;
  instructions: string | null;
  start_date: string | null;
  end_date: string | null;
  medical_prescription_schedules:
    | MedicalPrescriptionSchedule[]
    | null;
};

type DiagnosticResultItem = {
  id: number;
  item_name: string;
  value_text: string | null;
  value_number: number | null;
  unit: string | null;
  reference_min: number | null;
  reference_max: number | null;
  reference_text: string | null;
  abnormal_flag:
    | "normal"
    | "low"
    | "high"
    | "critical_low"
    | "critical_high"
    | "abnormal"
    | null;
  note: string | null;
};

type DiagnosticFile = {
  id: number;
  original_filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  file_kind: string;
  caption: string | null;
  is_guardian_visible: boolean;
};

type DiagnosticOrder = {
  id: number;
  category: string;
  test_name: string;
  body_site: string | null;
  status: string;
  completed_at: string | null;
  interpretation: string | null;
  guardian_summary: string | null;
  diagnostic_result_items: DiagnosticResultItem[] | null;
  diagnostic_files: DiagnosticFile[] | null;
};

type MedicalRecord = {
  id: number;
  reservation_id: number;
  diagnosis: string;
  doctor_note: string | null;
  veterinarian_note: string | null;
  guardian_summary: string | null;
  care_instructions: string | null;
  medication_instructions: string | null;
  next_visit_date: string | null;
  created_at: string;
  updated_at: string;
  prescriptions: Prescription[] | null;
  medical_prescriptions: MedicalPrescription[] | null;
  vaccination_records: VaccinationRecord[] | null;
  diagnostic_orders: DiagnosticOrder[] | null;
};

type Reservation = {
  id: number;
  hospital_id: number;
  pet_id: number | null;
  pet_name: string;
  guardian_name: string;
  phone: string;
  reservation_date: string;
  reservation_time: string;
  visit_reason: string;
  symptoms: string | null;
  status: string;
  created_at: string;
  pets: PetInfo | PetInfo[] | null;
  hospitals: HospitalInfo | HospitalInfo[] | null;
  medical_records: MedicalRecord | MedicalRecord[] | null;
};

type SelectedMedicalRecord = {
  reservation: Reservation;
  record: MedicalRecord;
  pet: PetInfo | null;
  hospital: HospitalInfo | null;
};

function getStatusLabel(status: string) {
  switch (status) {
    case "requested":
      return "승인 대기";
    case "approved":
      return "예약 승인";
    case "in_progress":
      return "진료 중";
    case "rejected":
      return "예약 거절";
    case "cancelled":
      return "예약 취소";
    case "completed":
      return "진료 완료";
    case "no_show":
      return "노쇼";
    default:
      return status;
  }
}

function getStatusClass(status: string) {
  switch (status) {
    case "approved":
      return "bg-green-100 text-green-800";
    case "in_progress":
      return "bg-purple-100 text-purple-800";
    case "rejected":
      return "bg-red-100 text-red-800";
    case "completed":
      return "bg-blue-100 text-blue-800";
    case "cancelled":
    case "no_show":
      return "bg-gray-100 text-gray-600";
    default:
      return "bg-yellow-100 text-yellow-800";
  }
}

function getStatusDescription(status: string) {
  switch (status) {
    case "requested":
      return "병원에서 예약 요청을 확인하고 있습니다.";
    case "approved":
      return "병원에서 예약을 승인했습니다.";
    case "in_progress":
      return "현재 병원에서 진료가 진행 중입니다.";
    case "rejected":
      return "병원에서 예약 요청을 승인하지 않았습니다.";
    case "cancelled":
      return "사용자가 취소한 예약입니다.";
    case "completed":
      return "진료가 완료되었습니다. 아래에서 진료기록을 확인할 수 있습니다.";
    case "no_show":
      return "예약 시간에 방문하지 않은 예약입니다.";
    default:
      return "";
  }
}

function getVisitReasonLabel(reason: string) {
  switch (reason) {
    case "general":
      return "일반 진료";
    case "vaccination":
      return "예방접종";
    case "checkup":
      return "건강검진";
    case "skin":
      return "피부·귀 증상";
    case "digestive":
      return "소화기 증상";
    case "other":
      return "기타";
    default:
      return reason;
  }
}

function getSpeciesLabel(species: PetInfo["species"] | undefined) {
  if (species === "dog") return "강아지";
  if (species === "cat") return "고양이";
  if (species === "other") return "기타";
  return "미입력";
}

function getGenderLabel(gender: PetInfo["gender"] | undefined) {
  if (gender === "male") return "수컷";
  if (gender === "female") return "암컷";
  return "미입력";
}

function getPetEmoji(species: PetInfo["species"] | undefined) {
  if (species === "dog") return "🐶";
  if (species === "cat") return "🐱";
  return "🐾";
}

function formatDate(dateString: string | null) {
  if (!dateString) return "예정 없음";

  const [year, month, day] = dateString.split("-");
  return `${year}.${month}.${day}`;
}

function getSingleRelation<T>(relation: T | T[] | null) {
  if (Array.isArray(relation)) {
    return relation[0] ?? null;
  }

  return relation;
}

function diagnosticCategoryLabel(category: string) {
  switch (category) {
    case "laboratory":
      return "검사실";
    case "xray":
      return "X-ray";
    case "ultrasound":
      return "초음파";
    case "ct":
      return "CT";
    case "mri":
      return "MRI";
    case "endoscopy":
      return "내시경";
    case "pathology":
      return "병리";
    default:
      return "기타 검사";
  }
}

function diagnosticFlagLabel(
  flag: DiagnosticResultItem["abnormal_flag"],
) {
  switch (flag) {
    case "normal":
      return "정상";
    case "low":
      return "낮음";
    case "high":
      return "높음";
    case "critical_low":
      return "위험 낮음";
    case "critical_high":
      return "위험 높음";
    case "abnormal":
      return "이상";
    default:
      return "";
  }
}

function diagnosticFlagClass(
  flag: DiagnosticResultItem["abnormal_flag"],
) {
  if (flag === "normal") {
    return "bg-emerald-100 text-emerald-800";
  }

  if (
    flag === "critical_low" ||
    flag === "critical_high"
  ) {
    return "bg-red-100 text-red-800";
  }

  if (flag === "low" || flag === "high" || flag === "abnormal") {
    return "bg-amber-100 text-amber-800";
  }

  return "bg-gray-100 text-gray-600";
}

function formatDiagnosticValue(item: DiagnosticResultItem) {
  const value =
    item.value_number !== null
      ? String(item.value_number)
      : item.value_text || "결과 미입력";

  return item.unit ? `${value} ${item.unit}` : value;
}

function formatReference(item: DiagnosticResultItem) {
  if (
    item.reference_min !== null ||
    item.reference_max !== null
  ) {
    return `${item.reference_min ?? "-"} ~ ${
      item.reference_max ?? "-"
    }${item.unit ? ` ${item.unit}` : ""}`;
  }

  return item.reference_text || "기준 범위 미입력";
}

function formatFileSize(size: number | null) {
  if (!size) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MyReservationsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cancellingReservationId, setCancellingReservationId] =
    useState<number | null>(null);
  const [selectedMedicalRecord, setSelectedMedicalRecord] =
    useState<SelectedMedicalRecord | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    async function loadReservations() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUser(user);

      if (!user) {
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("reservations")
        .select(
          `
            id,
            hospital_id,
            pet_id,
            pet_name,
            guardian_name,
            phone,
            reservation_date,
            reservation_time,
            visit_reason,
            symptoms,
            status,
            created_at,
            pets (
              id,
              name,
              species,
              breed,
              gender,
              weight_kg
            ),
            hospitals (
              id,
              name
            ),
            medical_records (
              id,
              reservation_id,
              diagnosis,
              doctor_note,
              veterinarian_note,
              guardian_summary,
              care_instructions,
              medication_instructions,
              next_visit_date,
              created_at,
              updated_at,
              prescriptions (
                id,
                medical_record_id,
                medicine_name,
                dosage,
                instructions,
                times_per_day,
                duration_days,
                start_date,
                end_date,
                medication_schedules (
                  id,
                  prescription_id,
                  scheduled_time
                )
              ),
              medical_prescriptions (
                id,
                medical_record_id,
                medication_name,
                dosage,
                frequency,
                duration,
                route,
                instructions,
                start_date,
                end_date,
                medical_prescription_schedules (
                  id,
                  scheduled_time
                )
              ),
              vaccination_records (
                id,
                medical_record_id,
                vaccine_name,
                manufacturer,
                vaccinated_at,
                next_due_date,
                memo
              ),
              diagnostic_orders (
                id,
                category,
                test_name,
                body_site,
                status,
                completed_at,
                interpretation,
                guardian_summary,
                diagnostic_result_items (
                  id,
                  item_name,
                  value_text,
                  value_number,
                  unit,
                  reference_min,
                  reference_max,
                  reference_text,
                  abnormal_flag,
                  note
                ),
                diagnostic_files (
                  id,
                  original_filename,
                  mime_type,
                  size_bytes,
                  file_kind,
                  caption,
                  is_guardian_visible
                )
              )
            )
          `
        )
        .eq("user_id", user.id)
        .order("created_at", {
          ascending: false,
        });

      if (error) {
        console.error("예약 조회 오류:", error);
        setErrorMessage("예약 내역을 불러오지 못했습니다.");
        setIsLoading(false);
        return;
      }

      setReservations((data ?? []) as unknown as Reservation[]);
      setIsLoading(false);
    }

    loadReservations();
  }, []);

  useEffect(() => {
    if (!selectedMedicalRecord) return;

    function closeWithEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedMedicalRecord(null);
      }
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeWithEscape);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", closeWithEscape);
    };
  }, [selectedMedicalRecord]);

  async function handleCancelReservation(reservationId: number) {
    if (!user) return;

    const shouldCancel = window.confirm(
      "이 예약을 정말 취소하시겠습니까?"
    );

    if (!shouldCancel) return;

    setCancellingReservationId(reservationId);
    setErrorMessage("");
    setSuccessMessage("");

    const { error } = await supabase
      .from("reservations")
      .update({ status: "cancelled" })
      .eq("id", reservationId)
      .eq("user_id", user.id)
      .in("status", ["requested", "approved"]);

    if (error) {
      console.error("예약 취소 오류:", error);
      setErrorMessage(
        "예약을 취소하지 못했습니다. 잠시 후 다시 시도해 주세요."
      );
      setCancellingReservationId(null);
      return;
    }

    setReservations((currentReservations) =>
      currentReservations.map((reservation) =>
        reservation.id === reservationId
          ? { ...reservation, status: "cancelled" }
          : reservation
      )
    );

    setSuccessMessage("예약이 정상적으로 취소되었습니다.");
    setCancellingReservationId(null);
  }

  function openMedicalRecord(
    reservation: Reservation,
    record: MedicalRecord,
    pet: PetInfo | null,
    hospital: HospitalInfo | null
  ) {
    setSelectedMedicalRecord({ reservation, record, pet, hospital });
  }

  async function openDiagnosticFile(file: DiagnosticFile) {
    setErrorMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("로그인 정보가 만료되었습니다.");
      }

      const response = await fetch(
        `/api/guardian/diagnostic-files/${file.id}`,
        {
          headers: {
            authorization: `Bearer ${session.access_token}`,
          },
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message ?? "검사 파일을 열지 못했습니다.",
        );
      }

      window.open(
        result.signedUrl,
        "_blank",
        "noopener,noreferrer",
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "검사 파일을 열지 못했습니다.",
      );
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gray-50 px-5 py-8">
        <p className="text-center text-gray-500">
          예약 내역을 불러오는 중입니다.
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
            <p className="mt-3 text-sm text-gray-600">
              본인의 예약 내역을 확인하려면 로그인하세요.
            </p>
            <Link
              href="/auth/login"
              className="mt-8 block rounded-2xl bg-black px-5 py-4 text-white"
            >
              로그인하기
            </Link>
          </section>
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="min-h-screen bg-gray-50 px-5 py-8 text-black">
        <div className="mx-auto w-full max-w-2xl">
          <Link
            href="/account"
            className="inline-block rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm"
          >
            ← 계정으로
          </Link>

          <header className="mt-8">
            <p className="text-sm text-gray-500">PAWU 예약 관리</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              내 예약
            </h1>
            <p className="mt-3 break-all text-sm text-gray-600">
              {user.email}
            </p>
          </header>

          {successMessage && (
            <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-5 text-sm text-green-700">
              {successMessage}
            </div>
          )}

          {errorMessage && (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          {!errorMessage && reservations.length === 0 && (
            <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-8 text-center">
              <h2 className="text-lg font-semibold">예약 내역이 없습니다</h2>
              <p className="mt-2 text-sm text-gray-500">
                병원을 찾아 첫 예약을 요청해 보세요.
              </p>
              <Link
                href="/map"
                className="mt-6 block rounded-2xl bg-black px-5 py-4 text-white"
              >
                동물병원 찾기
              </Link>
            </section>
          )}

          {reservations.length > 0 && (
            <section className="mt-8">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">예약 내역</h2>
                <span className="rounded-full bg-black px-3 py-1 text-sm text-white">
                  {reservations.length}건
                </span>
              </div>

              <div className="mt-4 space-y-4">
                {reservations.map((reservation) => {
                  const pet = getSingleRelation(reservation.pets);
                  const hospital = getSingleRelation(reservation.hospitals);
                  const medicalRecord = getSingleRelation(
                    reservation.medical_records
                  );

                  const displayedPetName = pet?.name ?? reservation.pet_name;
                  const displayedHospitalName =
                    hospital?.name ?? `병원 #${reservation.hospital_id}`;
                  const canCancel =
                    reservation.status === "requested" ||
                    reservation.status === "approved";
                  const isCancelling =
                    cancellingReservationId === reservation.id;

                  return (
                    <article
                      key={reservation.id}
                      className="rounded-3xl border border-gray-200 bg-white p-6"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm text-gray-400">
                            예약번호 #{reservation.id}
                          </p>
                          <h3 className="mt-1 text-xl font-bold">
                            {displayedPetName}
                          </h3>
                          {pet && (
                            <p className="mt-1 text-sm text-gray-500">
                              {getSpeciesLabel(pet.species)}
                              {pet.breed ? ` · ${pet.breed}` : ""}
                            </p>
                          )}
                        </div>

                        <span
                          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(
                            reservation.status
                          )}`}
                        >
                          {getStatusLabel(reservation.status)}
                        </span>
                      </div>

                      <p className="mt-4 rounded-2xl bg-gray-100 p-4 text-sm text-gray-600">
                        {getStatusDescription(reservation.status)}
                      </p>

                      <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <dt className="text-gray-400">희망 날짜</dt>
                          <dd className="mt-1 font-medium">
                            {reservation.reservation_date}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-gray-400">희망 시간</dt>
                          <dd className="mt-1 font-medium">
                            {reservation.reservation_time.slice(0, 5)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-gray-400">방문 목적</dt>
                          <dd className="mt-1 font-medium">
                            {getVisitReasonLabel(reservation.visit_reason)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-gray-400">병원</dt>
                          <dd className="mt-1 font-medium">
                            {displayedHospitalName}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-gray-400">성별</dt>
                          <dd className="mt-1 font-medium">
                            {pet ? getGenderLabel(pet.gender) : "기존 예약"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-gray-400">몸무게</dt>
                          <dd className="mt-1 font-medium">
                            {pet?.weight_kg !== null &&
                            pet?.weight_kg !== undefined
                              ? `${pet.weight_kg}kg`
                              : "미입력"}
                          </dd>
                        </div>
                      </dl>

                      <section className="mt-5 rounded-2xl border border-gray-200 p-4">
                        <h4 className="text-sm font-semibold">
                          증상 및 요청사항
                        </h4>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-600">
                          {reservation.symptoms || "작성된 내용이 없습니다."}
                        </p>
                      </section>

                      {reservation.status === "completed" && medicalRecord && (
                        <button
                          type="button"
                          onClick={() =>
                            openMedicalRecord(
                              reservation,
                              medicalRecord,
                              pet,
                              hospital
                            )
                          }
                          className="mt-5 w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                        >
                          📋 진료기록 보기
                        </button>
                      )}

                      {reservation.status === "completed" && !medicalRecord && (
                        <div className="mt-5 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
                          병원에서 진료기록을 준비하고 있습니다.
                        </div>
                      )}

                      {canCancel && (
                        <button
                          type="button"
                          onClick={() =>
                            handleCancelReservation(reservation.id)
                          }
                          disabled={
                            isCancelling ||
                            cancellingReservationId !== null
                          }
                          className="mt-5 w-full rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                        >
                          {isCancelling
                            ? "예약을 취소하는 중..."
                            : "예약 취소"}
                        </button>
                      )}

                      <Link
                        href={`/hospital/${reservation.hospital_id}`}
                        className="mt-3 block w-full rounded-2xl border border-gray-300 px-4 py-3 text-center text-sm font-semibold"
                      >
                        병원 상세 보기
                      </Link>
                    </article>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </main>

      {selectedMedicalRecord && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby="medical-record-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedMedicalRecord(null);
            }
          }}
        >
          <section className="max-h-full w-full max-w-3xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-gray-200 bg-white px-6 py-5 sm:px-8">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gray-100 text-3xl">
                  {getPetEmoji(selectedMedicalRecord.pet?.species)}
                </div>
                <div>
                  <p className="text-sm text-gray-500">PAWU 진료 차트</p>
                  <h2
                    id="medical-record-title"
                    className="mt-1 text-2xl font-bold"
                  >
                    {selectedMedicalRecord.pet?.name ??
                      selectedMedicalRecord.reservation.pet_name}
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    {selectedMedicalRecord.hospital?.name ??
                      `병원 #${selectedMedicalRecord.reservation.hospital_id}`}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedMedicalRecord(null)}
                className="rounded-full border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                aria-label="진료기록 닫기"
              >
                닫기
              </button>
            </header>

            <div className="px-6 py-6 sm:px-8 sm:py-8">
              <div className="grid gap-3 rounded-2xl bg-gray-50 p-5 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-gray-400">진료일</p>
                  <p className="mt-1 font-semibold">
                    {formatDate(
                      selectedMedicalRecord.reservation.reservation_date
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400">진료 시간</p>
                  <p className="mt-1 font-semibold">
                    {selectedMedicalRecord.reservation.reservation_time.slice(
                      0,
                      5
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400">예약번호</p>
                  <p className="mt-1 font-semibold">
                    #{selectedMedicalRecord.reservation.id}
                  </p>
                </div>
              </div>

              <div className="mt-7 space-y-6">
                <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                  <p className="text-sm font-bold text-emerald-800">
                    오늘 진료 요약
                  </p>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-emerald-950">
                    {selectedMedicalRecord.record.guardian_summary ||
                      "병원에서 별도의 진료 요약을 입력하지 않았습니다."}
                  </p>
                </section>

                <section>
                  <p className="text-sm font-semibold text-blue-600">진단명</p>
                  <p className="mt-2 whitespace-pre-wrap text-xl font-bold leading-8">
                    {selectedMedicalRecord.record.diagnosis}
                  </p>
                </section>

                <section className="border-t border-gray-200 pt-6">
                  <h3 className="text-base font-bold">의사 소견</h3>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-700">
                    {selectedMedicalRecord.record.veterinarian_note ||
                      selectedMedicalRecord.record.doctor_note ||
                      "공개된 의사 소견이 없습니다."}
                  </p>
                </section>

                <section className="border-t border-gray-200 pt-6">
                  <h3 className="text-base font-bold">보호자 주의사항</h3>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-700">
                    {selectedMedicalRecord.record.care_instructions ||
                      "별도의 보호자 주의사항이 없습니다."}
                  </p>
                </section>

                <section className="rounded-2xl border border-purple-200 bg-purple-50 p-5">
                  <h3 className="text-base font-bold text-purple-900">
                    💊 공통 투약 안내
                  </h3>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-purple-900">
                    {selectedMedicalRecord.record.medication_instructions ||
                      "별도의 공통 투약 안내가 없습니다."}
                  </p>
                </section>

                <section className="border-t border-gray-200 pt-6">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-bold">💊 처방약</h3>
                    <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-800">
                      {(selectedMedicalRecord.record.medical_prescriptions?.length ??
                        selectedMedicalRecord.record.prescriptions?.length ??
                        0)}개
                    </span>
                  </div>

                  {(selectedMedicalRecord.record.medical_prescriptions?.length ??
                    selectedMedicalRecord.record.prescriptions?.length ??
                    0) === 0 ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-5 text-center text-sm text-gray-500">
                      등록된 처방약이 없습니다.
                    </div>
                  ) : selectedMedicalRecord.record.medical_prescriptions &&
                    selectedMedicalRecord.record.medical_prescriptions.length > 0 ? (
                    <div className="mt-4 space-y-4">
                      {selectedMedicalRecord.record.medical_prescriptions.map(
                        (prescription, prescriptionIndex) => (
                          <article
                            key={prescription.id}
                            className="rounded-3xl border border-purple-200 bg-white p-5 shadow-sm"
                          >
                            <p className="text-xs font-semibold text-purple-600">
                              처방약 {prescriptionIndex + 1}
                            </p>
                            <h4 className="mt-1 text-xl font-bold">
                              {prescription.medication_name}
                            </h4>

                            <section className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                              <p className="text-sm font-bold text-blue-900">
                                복용 일정
                              </p>
                              <p className="mt-2 text-sm font-semibold text-blue-950">
                                {prescription.start_date || "시작일 미입력"} ~{" "}
                                {prescription.end_date || "종료일 미입력"}
                              </p>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {(prescription.medical_prescription_schedules ??
                                  []).map((schedule) => (
                                  <span
                                    key={schedule.id}
                                    className="rounded-full bg-white px-3 py-1.5 text-sm font-bold text-blue-800 shadow-sm"
                                  >
                                    {String(schedule.scheduled_time).slice(0, 5)}
                                  </span>
                                ))}
                                {(prescription.medical_prescription_schedules ??
                                  []).length === 0 && (
                                  <span className="text-sm text-blue-700">
                                    정확한 복용 시간이 등록되지 않았습니다.
                                  </span>
                                )}
                              </div>
                              <p className="mt-3 text-xs leading-5 text-blue-700">
                                이 날짜와 시간을 기준으로 복약 알림을 설정할 수 있습니다.
                              </p>
                            </section>

                            <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <dt className="text-gray-400">1회 투여량</dt>
                                <dd className="mt-1 font-semibold">
                                  {prescription.dosage || "미입력"}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-gray-400">복용 빈도</dt>
                                <dd className="mt-1 font-semibold">
                                  {prescription.frequency || "미입력"}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-gray-400">복용 기간</dt>
                                <dd className="mt-1 font-semibold">
                                  {prescription.duration || "미입력"}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-gray-400">투여 경로</dt>
                                <dd className="mt-1 font-semibold">
                                  {prescription.route || "미입력"}
                                </dd>
                              </div>
                            </dl>

                            <div className="mt-4 rounded-2xl bg-purple-50 p-4">
                              <p className="text-sm font-semibold text-purple-900">
                                복약 안내
                              </p>
                              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-purple-900">
                                {prescription.instructions ||
                                  "별도의 복약 안내가 없습니다."}
                              </p>
                            </div>
                          </article>
                        ),
                      )}
                    </div>
                  ) : (
                    <div className="mt-4 space-y-4">
                      {(selectedMedicalRecord.record.prescriptions ?? []).map(
                        (prescription, prescriptionIndex) => (
                          <article
                            key={prescription.id}
                            className="rounded-3xl border border-purple-200 bg-white p-5 shadow-sm"
                          >
                            <p className="text-xs font-semibold text-purple-600">
                              처방약 {prescriptionIndex + 1}
                            </p>
                            <h4 className="mt-1 text-xl font-bold">
                              {prescription.medicine_name}
                            </h4>
                            <p className="mt-3 text-sm text-gray-600">
                              {[
                                prescription.dosage,
                                `하루 ${prescription.times_per_day}회`,
                                `${prescription.duration_days}일`,
                              ].join(" · ")}
                            </p>
                            <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
                              {prescription.instructions ||
                                "별도의 복약 안내가 없습니다."}
                            </p>
                          </article>
                        ),
                      )}
                    </div>
                  )}
                </section>

                <section className="border-t border-gray-200 pt-6">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-bold">🔬 검사·영상 결과</h3>
                    <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-800">
                      {selectedMedicalRecord.record.diagnostic_orders?.length ??
                        0}건
                    </span>
                  </div>

                  {!selectedMedicalRecord.record.diagnostic_orders ||
                  selectedMedicalRecord.record.diagnostic_orders.length === 0 ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-5 text-center text-sm text-gray-500">
                      병원에서 보호자에게 공개한 검사 결과가 없습니다.
                    </div>
                  ) : (
                    <div className="mt-4 space-y-5">
                      {[...selectedMedicalRecord.record.diagnostic_orders]
                        .sort((first, second) =>
                          String(second.completed_at ?? "").localeCompare(
                            String(first.completed_at ?? ""),
                          ),
                        )
                        .map((diagnostic) => (
                          <article
                            key={diagnostic.id}
                            className="rounded-3xl border border-cyan-200 bg-cyan-50/30 p-5"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="text-xs font-bold text-cyan-700">
                                  {diagnosticCategoryLabel(
                                    diagnostic.category,
                                  )}
                                </p>
                                <h4 className="mt-1 text-xl font-bold">
                                  {diagnostic.test_name}
                                </h4>
                                <p className="mt-1 text-sm text-gray-500">
                                  {diagnostic.body_site
                                    ? `${diagnostic.body_site} · `
                                    : ""}
                                  {diagnostic.completed_at
                                    ? `${formatDate(
                                        diagnostic.completed_at,
                                      )} 완료`
                                    : "검사 완료"}
                                </p>
                              </div>
                              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                                결과 공개
                              </span>
                            </div>

                            <section className="mt-4 rounded-2xl bg-white p-4">
                              <p className="text-sm font-bold text-cyan-900">
                                보호자용 결과 설명
                              </p>
                              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-gray-700">
                                {diagnostic.guardian_summary ||
                                  "병원에서 별도의 보호자용 설명을 입력하지 않았습니다."}
                              </p>
                            </section>

                            {diagnostic.interpretation && (
                              <section className="mt-3 rounded-2xl border border-gray-200 bg-white p-4">
                                <p className="text-sm font-bold">
                                  수의사 판독 소견
                                </p>
                                <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-gray-700">
                                  {diagnostic.interpretation}
                                </p>
                              </section>
                            )}

                            {(diagnostic.diagnostic_result_items?.length ??
                              0) > 0 && (
                              <section className="mt-4">
                                <p className="text-sm font-bold">
                                  세부 검사 수치
                                </p>
                                <div className="mt-3 overflow-hidden rounded-2xl border border-gray-200 bg-white">
                                  {(
                                    diagnostic.diagnostic_result_items ?? []
                                  ).map((item) => (
                                    <div
                                      key={item.id}
                                      className="grid gap-2 border-b border-gray-100 p-4 last:border-b-0 sm:grid-cols-[1.2fr_1fr_1fr_auto]"
                                    >
                                      <div>
                                        <p className="font-semibold">
                                          {item.item_name}
                                        </p>
                                        {item.note && (
                                          <p className="mt-1 text-xs text-gray-500">
                                            {item.note}
                                          </p>
                                        )}
                                      </div>

                                      <div>
                                        <p className="text-xs text-gray-400">
                                          결과
                                        </p>
                                        <p className="mt-1 font-bold">
                                          {formatDiagnosticValue(item)}
                                        </p>
                                      </div>

                                      <div>
                                        <p className="text-xs text-gray-400">
                                          참고 범위
                                        </p>
                                        <p className="mt-1 text-sm font-semibold">
                                          {formatReference(item)}
                                        </p>
                                      </div>

                                      {item.abnormal_flag && (
                                        <span
                                          className={`h-fit rounded-full px-3 py-1 text-xs font-bold ${diagnosticFlagClass(
                                            item.abnormal_flag,
                                          )}`}
                                        >
                                          {diagnosticFlagLabel(
                                            item.abnormal_flag,
                                          )}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </section>
                            )}

                            {(diagnostic.diagnostic_files?.length ?? 0) >
                              0 && (
                              <section className="mt-4">
                                <p className="text-sm font-bold">
                                  공개된 검사 파일
                                </p>
                                <div className="mt-3 space-y-2">
                                  {(
                                    diagnostic.diagnostic_files ?? []
                                  ).map((file) => (
                                    <button
                                      key={file.id}
                                      type="button"
                                      onClick={() =>
                                        void openDiagnosticFile(file)
                                      }
                                      className="flex w-full items-center justify-between gap-3 rounded-2xl border border-cyan-200 bg-white p-4 text-left hover:bg-cyan-50"
                                    >
                                      <div className="min-w-0">
                                        <p className="truncate text-sm font-bold">
                                          {file.original_filename}
                                        </p>
                                        <p className="mt-1 text-xs text-gray-500">
                                          {file.file_kind}
                                          {file.size_bytes
                                            ? ` · ${formatFileSize(
                                                file.size_bytes,
                                              )}`
                                            : ""}
                                        </p>
                                        {file.caption && (
                                          <p className="mt-1 text-xs text-gray-600">
                                            {file.caption}
                                          </p>
                                        )}
                                      </div>
                                      <span className="shrink-0 rounded-full bg-cyan-100 px-3 py-2 text-xs font-bold text-cyan-800">
                                        열기
                                      </span>
                                    </button>
                                  ))}
                                </div>
                                <p className="mt-2 text-xs leading-5 text-gray-400">
                                  검사 파일은 보안을 위해 임시 열람 주소로
                                  제공됩니다.
                                </p>
                              </section>
                            )}
                          </article>
                        ))}
                    </div>
                  )}
                </section>

                <section className="border-t border-gray-200 pt-6">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-bold">💉 예방접종</h3>
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
                      {selectedMedicalRecord.record.vaccination_records?.length ?? 0}개
                    </span>
                  </div>

                  {!selectedMedicalRecord.record.vaccination_records ||
                  selectedMedicalRecord.record.vaccination_records.length === 0 ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-5 text-center text-sm text-gray-500">
                      등록된 예방접종 기록이 없습니다.
                    </div>
                  ) : (
                    <div className="mt-4 space-y-4">
                      {[...selectedMedicalRecord.record.vaccination_records]
                        .sort((first, second) =>
                          second.vaccinated_at.localeCompare(first.vaccinated_at),
                        )
                        .map((vaccination, vaccinationIndex) => (
                          <article
                            key={vaccination.id}
                            className="rounded-3xl border border-blue-200 bg-blue-50/40 p-5"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className="text-xs font-semibold text-blue-600">
                                  예방접종 {vaccinationIndex + 1}
                                </p>
                                <h4 className="mt-1 text-xl font-bold">
                                  {vaccination.vaccine_name}
                                </h4>
                                <p className="mt-1 text-sm text-gray-500">
                                  {vaccination.manufacturer || "제조사 미입력"}
                                </p>
                              </div>

                              <span className="shrink-0 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
                                접종 완료
                              </span>
                            </div>

                            <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
                              <div>
                                <dt className="text-gray-400">접종일</dt>
                                <dd className="mt-1 font-semibold">
                                  {formatDate(vaccination.vaccinated_at)}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-gray-400">다음 접종 예정일</dt>
                                <dd className="mt-1 font-semibold">
                                  {formatDate(vaccination.next_due_date)}
                                </dd>
                              </div>
                            </dl>

                            <div className="mt-4 rounded-2xl bg-white p-4">
                              <p className="text-sm font-semibold">접종 메모</p>
                              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">
                                {vaccination.memo || "별도의 접종 메모가 없습니다."}
                              </p>
                            </div>
                          </article>
                        ))}
                    </div>
                  )}
                </section>

                <section className="rounded-2xl border border-green-200 bg-green-50 p-5">
                  <h3 className="text-base font-bold text-green-900">
                    📅 다음 방문 권장일
                  </h3>
                  <p className="mt-2 text-lg font-bold text-green-900">
                    {formatDate(
                      selectedMedicalRecord.record.next_visit_date
                    )}
                  </p>
                </section>
              </div>

              <p className="mt-8 text-xs leading-5 text-gray-400">
                이 기록은 병원에서 작성한 진료 안내입니다. 증상이 악화되거나
                응급 상황이 발생하면 해당 병원에 바로 문의해 주세요.
              </p>

              <button
                type="button"
                onClick={() => setSelectedMedicalRecord(null)}
                className="mt-6 w-full rounded-2xl bg-black px-5 py-4 font-semibold text-white"
              >
                확인
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}