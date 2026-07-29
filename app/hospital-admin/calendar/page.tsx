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

type PetInfo = {
  id: number;
  user_id: string;
  name: string;
  species: "dog" | "cat" | "other";
  breed: string | null;
};

type PrescriptionForm = {
  clientId: string;
  medicineName: string;
  dosage: string;
  instructions: string;
  timesPerDay: number;
  durationDays: number;
  startDate: string;
  scheduledTimes: string[];
};

type VaccinationForm = {
  clientId: string;
  vaccineName: string;
  manufacturer: string;
  vaccinatedAt: string;
  nextDueDate: string;
  memo: string;
};

type MedicalRecordForm = {
  diagnosis: string;
  doctorNote: string;
  careInstructions: string;
  medicationInstructions: string;
  nextVisitDate: string;
};

const EMPTY_MEDICAL_RECORD_FORM: MedicalRecordForm = {
  diagnosis: "",
  doctorNote: "",
  careInstructions: "",
  medicationInstructions: "",
  nextVisitDate: "",
};

function createPrescriptionForm(): PrescriptionForm {
  return {
    clientId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    medicineName: "",
    dosage: "",
    instructions: "",
    timesPerDay: 1,
    durationDays: 1,
    startDate: getTodayString(),
    scheduledTimes: ["09:00"],
  };
}

function createVaccinationForm(): VaccinationForm {
  return {
    clientId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    vaccineName: "",
    manufacturer: "",
    vaccinatedAt: getTodayString(),
    nextDueDate: "",
    memo: "",
  };
}

function getSinglePet(
  pets: PetInfo | PetInfo[] | null,
): PetInfo | null {
  if (Array.isArray(pets)) {
    return pets[0] ?? null;
  }

  return pets;
}

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + days);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function createScheduledAt(dateString: string, timeString: string) {
  return new Date(`${dateString}T${timeString}:00`).toISOString();
}

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
  completed_at: string | null;
  pets: PetInfo | PetInfo[] | null;
};

function getTodayString() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getMonthString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

function formatDateString(year: number, monthIndex: number, day: number) {
  const month = String(monthIndex + 1).padStart(2, "0");
  const date = String(day).padStart(2, "0");

  return `${year}-${month}-${date}`;
}

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
    case "no_show":
      return "노쇼";
    case "completed":
      return "진료 완료";
    default:
      return status;
  }
}

function getStatusClass(status: string) {
  switch (status) {
    case "requested":
      return "bg-yellow-100 text-yellow-800";
    case "approved":
      return "bg-green-100 text-green-800";
    case "in_progress":
      return "bg-purple-100 text-purple-800";
    case "rejected":
      return "bg-red-100 text-red-800";
    case "cancelled":
      return "bg-gray-100 text-gray-600";
    case "no_show":
      return "bg-orange-100 text-orange-800";
    case "completed":
      return "bg-blue-100 text-blue-800";
    default:
      return "bg-gray-100 text-gray-600";
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

function getSpeciesLabel(species: PetInfo["species"]) {
  if (species === "dog") return "강아지";
  if (species === "cat") return "고양이";
  return "기타";
}

function getCalendarDays(currentMonth: Date) {
  const year = currentMonth.getFullYear();
  const monthIndex = currentMonth.getMonth();

  const firstDayOfWeek = new Date(year, monthIndex, 1).getDay();

  const lastDate = new Date(year, monthIndex + 1, 0).getDate();

  const days: Array<number | null> = [];

  for (let index = 0; index < firstDayOfWeek; index += 1) {
    days.push(null);
  }

  for (let day = 1; day <= lastDate; day += 1) {
    days.push(day);
  }

  while (days.length % 7 !== 0) {
    days.push(null);
  }

  return days;
}

export default function HospitalCalendarPage() {
  const [user, setUser] = useState<User | null>(null);

  const [hospital, setHospital] = useState<HospitalInfo | null>(null);

  const [currentMonth, setCurrentMonth] = useState(new Date());

  const [selectedDate, setSelectedDate] = useState(getTodayString());

  const [monthReservations, setMonthReservations] = useState<Reservation[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingReservations, setIsLoadingReservations] = useState(false);

  const [changingReservationId, setChangingReservationId] = useState<
    number | null
  >(null);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [medicalRecordReservation, setMedicalRecordReservation] =
    useState<Reservation | null>(null);
  const [medicalRecordForm, setMedicalRecordForm] = useState<MedicalRecordForm>(
    EMPTY_MEDICAL_RECORD_FORM,
  );
  const [isSavingMedicalRecord, setIsSavingMedicalRecord] = useState(false);
  const [medicalRecordError, setMedicalRecordError] = useState("");
  const [prescriptions, setPrescriptions] = useState<PrescriptionForm[]>([]);
  const [vaccinations, setVaccinations] = useState<VaccinationForm[]>([]);

  const calendarDays = useMemo(
    () => getCalendarDays(currentMonth),
    [currentMonth],
  );

  const selectedReservations = useMemo(() => {
    return monthReservations
      .filter((reservation) => reservation.reservation_date === selectedDate)
      .sort((first, second) =>
        first.reservation_time.localeCompare(second.reservation_time),
      );
  }, [monthReservations, selectedDate]);

  const reservationCountByDate = useMemo(() => {
    const counts: Record<string, number> = {};

    monthReservations.forEach((reservation) => {
      if (
        reservation.status === "cancelled" ||
        reservation.status === "rejected"
      ) {
        return;
      }

      counts[reservation.reservation_date] =
        (counts[reservation.reservation_date] ?? 0) + 1;
    });

    return counts;
  }, [monthReservations]);

  useEffect(() => {
    async function loadAdminHospital() {
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

      const { data: adminData, error: adminError } = await supabase
        .from("hospital_admins")
        .select(
          `
              hospital_id,
              hospitals (
                id,
                name
              )
            `,
        )
        .eq("user_id", user.id)
        .maybeSingle();

      if (adminError) {
        console.error("병원 관리자 조회 오류:", adminError);

        setErrorMessage("병원 관리자 정보를 불러오지 못했습니다.");

        setIsLoading(false);
        return;
      }

      if (!adminData) {
        setErrorMessage("이 계정에 연결된 병원이 없습니다.");

        setIsLoading(false);
        return;
      }

      const admin = adminData as unknown as HospitalAdminRow;

      const linkedHospital = Array.isArray(admin.hospitals)
        ? (admin.hospitals[0] ?? null)
        : admin.hospitals;

      if (!linkedHospital) {
        setErrorMessage("연결된 병원 정보를 찾지 못했습니다.");

        setIsLoading(false);
        return;
      }

      setHospital(linkedHospital);
      setIsLoading(false);
    }

    loadAdminHospital();
  }, []);

  useEffect(() => {
    async function loadMonthReservations() {
      if (!hospital) {
        return;
      }

      setIsLoadingReservations(true);
      setErrorMessage("");
      setSuccessMessage("");

      const year = currentMonth.getFullYear();
      const monthIndex = currentMonth.getMonth();

      const monthStart = formatDateString(year, monthIndex, 1);

      const monthEnd = formatDateString(
        year,
        monthIndex,
        new Date(year, monthIndex + 1, 0).getDate(),
      );

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
            completed_at,
            pets (
              id,
              user_id,
              name,
              species,
              breed
            )
          `,
        )
        .eq("hospital_id", hospital.id)
        .gte("reservation_date", monthStart)
        .lte("reservation_date", monthEnd)
        .order("reservation_date", {
          ascending: true,
        })
        .order("reservation_time", {
          ascending: true,
        });

      if (error) {
        console.error("예약 달력 조회 오류:", error);

        setErrorMessage("예약 달력을 불러오지 못했습니다.");

        setMonthReservations([]);
        setIsLoadingReservations(false);
        return;
      }

      setMonthReservations((data ?? []) as unknown as Reservation[]);

      setIsLoadingReservations(false);
    }

    loadMonthReservations();
  }, [hospital, currentMonth]);

  function movePreviousMonth() {
    setCurrentMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1),
    );
  }

  function moveNextMonth() {
    setCurrentMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1),
    );
  }

  function moveToToday() {
    const today = new Date();

    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));

    setSelectedDate(getTodayString());
  }

  function openMedicalRecordModal(reservation: Reservation) {
    setMedicalRecordReservation(reservation);
    setMedicalRecordForm(EMPTY_MEDICAL_RECORD_FORM);
    setPrescriptions([]);
    setVaccinations([]);
    setMedicalRecordError("");
  }

  function closeMedicalRecordModal() {
    if (isSavingMedicalRecord) {
      return;
    }

    setMedicalRecordReservation(null);
    setMedicalRecordForm(EMPTY_MEDICAL_RECORD_FORM);
    setPrescriptions([]);
    setVaccinations([]);
    setMedicalRecordError("");
  }

  function addPrescription() {
    setPrescriptions((current) => [...current, createPrescriptionForm()]);
  }

  function removePrescription(clientId: string) {
    setPrescriptions((current) =>
      current.filter((prescription) => prescription.clientId !== clientId),
    );
  }

  function updatePrescription(
    clientId: string,
    field: keyof Omit<PrescriptionForm, "clientId" | "scheduledTimes">,
    value: string | number,
  ) {
    setPrescriptions((current) =>
      current.map((prescription) =>
        prescription.clientId === clientId
          ? {
              ...prescription,
              [field]: value,
            }
          : prescription,
      ),
    );
  }

  function addPrescriptionTime(clientId: string) {
    setPrescriptions((current) =>
      current.map((prescription) => {
        if (prescription.clientId !== clientId) {
          return prescription;
        }

        if (prescription.scheduledTimes.length >= 24) {
          return prescription;
        }

        return {
          ...prescription,
          scheduledTimes: [...prescription.scheduledTimes, "09:00"],
        };
      }),
    );
  }

  function updatePrescriptionTime(
    clientId: string,
    timeIndex: number,
    value: string,
  ) {
    setPrescriptions((current) =>
      current.map((prescription) => {
        if (prescription.clientId !== clientId) {
          return prescription;
        }

        return {
          ...prescription,
          scheduledTimes: prescription.scheduledTimes.map((time, index) =>
            index === timeIndex ? value : time,
          ),
        };
      }),
    );
  }

  function removePrescriptionTime(clientId: string, timeIndex: number) {
    setPrescriptions((current) =>
      current.map((prescription) => {
        if (prescription.clientId !== clientId) {
          return prescription;
        }

        return {
          ...prescription,
          scheduledTimes: prescription.scheduledTimes.filter(
            (_, index) => index !== timeIndex,
          ),
        };
      }),
    );
  }

  function addVaccination() {
    setVaccinations((current) => [...current, createVaccinationForm()]);
  }

  function removeVaccination(clientId: string) {
    setVaccinations((current) =>
      current.filter((vaccination) => vaccination.clientId !== clientId),
    );
  }

  function updateVaccination(
    clientId: string,
    field: keyof Omit<VaccinationForm, "clientId">,
    value: string,
  ) {
    setVaccinations((current) =>
      current.map((vaccination) =>
        vaccination.clientId === clientId
          ? {
              ...vaccination,
              [field]: value,
            }
          : vaccination,
      ),
    );
  }

  function updateMedicalRecordField(
    field: keyof MedicalRecordForm,
    value: string,
  ) {
    setMedicalRecordForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleStatusChange(
    reservationId: number,
    nextStatus: "approved" | "rejected" | "in_progress" | "no_show",
  ) {
    if (!hospital) {
      return;
    }

    let confirmationMessage = "";

    if (nextStatus === "approved") {
      confirmationMessage = "이 예약을 승인하시겠습니까?";
    }

    if (nextStatus === "rejected") {
      confirmationMessage = "이 예약을 거절하시겠습니까?";
    }

    if (nextStatus === "in_progress") {
      confirmationMessage = "진료를 시작하시겠습니까?";
    }

    if (nextStatus === "no_show") {
      confirmationMessage = "내원하지 않은 예약으로 처리하시겠습니까?";
    }

    const confirmed = window.confirm(confirmationMessage);

    if (!confirmed) {
      return;
    }

    setChangingReservationId(reservationId);
    setErrorMessage("");
    setSuccessMessage("");

    const { error } = await supabase
      .from("reservations")
      .update({
        status: nextStatus,
        completed_at: null,
      })
      .eq("id", reservationId)
      .eq("hospital_id", hospital.id);

    if (error) {
      console.error("예약 상태 변경 오류:", error);
      setErrorMessage("예약 상태를 변경하지 못했습니다.");
      setChangingReservationId(null);
      return;
    }

    setMonthReservations((currentReservations) =>
      currentReservations.map((reservation) =>
        reservation.id === reservationId
          ? {
              ...reservation,
              status: nextStatus,
              completed_at: null,
            }
          : reservation,
      ),
    );

    setSuccessMessage(
      `예약 상태가 '${getStatusLabel(nextStatus)}' 상태로 변경되었습니다.`,
    );

    setChangingReservationId(null);
  }

  async function handleMedicalRecordSubmit() {
    if (!hospital || !medicalRecordReservation) {
      return;
    }

    const diagnosis = medicalRecordForm.diagnosis.trim();
    const doctorNote = medicalRecordForm.doctorNote.trim();
    const careInstructions = medicalRecordForm.careInstructions.trim();
    const medicationInstructions =
      medicalRecordForm.medicationInstructions.trim();
    const pet = getSinglePet(medicalRecordReservation.pets);

    if (!diagnosis) {
      setMedicalRecordError("진단명을 입력해 주세요.");
      return;
    }

    if (!doctorNote) {
      setMedicalRecordError("의사 소견을 입력해 주세요.");
      return;
    }

    if (!careInstructions) {
      setMedicalRecordError("보호자 주의사항을 입력해 주세요.");
      return;
    }

    for (let index = 0; index < prescriptions.length; index += 1) {
      const prescription = prescriptions[index];

      if (!prescription.medicineName.trim()) {
        setMedicalRecordError(
          `처방약 ${index + 1}의 약 이름을 입력해 주세요.`,
        );
        return;
      }

      if (!prescription.dosage.trim()) {
        setMedicalRecordError(
          `처방약 ${index + 1}의 1회 복용량을 입력해 주세요.`,
        );
        return;
      }

      if (
        !Number.isInteger(prescription.timesPerDay) ||
        prescription.timesPerDay < 1 ||
        prescription.timesPerDay > 24
      ) {
        setMedicalRecordError(
          `처방약 ${index + 1}의 하루 복용 횟수를 확인해 주세요.`,
        );
        return;
      }

      if (
        !Number.isInteger(prescription.durationDays) ||
        prescription.durationDays < 1
      ) {
        setMedicalRecordError(
          `처방약 ${index + 1}의 복용 기간을 확인해 주세요.`,
        );
        return;
      }

      const validTimes = prescription.scheduledTimes.filter(Boolean);

      if (validTimes.length !== prescription.timesPerDay) {
        setMedicalRecordError(
          `처방약 ${index + 1}의 복용 시간은 하루 복용 횟수와 같은 개수로 입력해 주세요.`,
        );
        return;
      }

      if (new Set(validTimes).size !== validTimes.length) {
        setMedicalRecordError(
          `처방약 ${index + 1}에 중복된 복용 시간이 있습니다.`,
        );
        return;
      }
    }

    if (prescriptions.length > 0 && (!pet || !medicalRecordReservation.pet_id)) {
      setMedicalRecordError(
        "반려동물 계정 정보가 없어 처방약을 저장할 수 없습니다.",
      );
      return;
    }

    for (let index = 0; index < vaccinations.length; index += 1) {
      const vaccination = vaccinations[index];

      if (!vaccination.vaccineName.trim()) {
        setMedicalRecordError(
          `예방접종 ${index + 1}의 백신명을 입력해 주세요.`,
        );
        return;
      }

      if (!vaccination.vaccinatedAt) {
        setMedicalRecordError(
          `예방접종 ${index + 1}의 접종일을 입력해 주세요.`,
        );
        return;
      }

      if (
        vaccination.nextDueDate &&
        vaccination.nextDueDate < vaccination.vaccinatedAt
      ) {
        setMedicalRecordError(
          `예방접종 ${index + 1}의 다음 접종 예정일은 접종일 이후여야 합니다.`,
        );
        return;
      }
    }

    if (vaccinations.length > 0 && (!pet || !medicalRecordReservation.pet_id)) {
      setMedicalRecordError(
        "반려동물 계정 정보가 없어 예방접종 기록을 저장할 수 없습니다.",
      );
      return;
    }

    setIsSavingMedicalRecord(true);
    setMedicalRecordError("");
    setErrorMessage("");
    setSuccessMessage("");

    const completedAt = new Date().toISOString();

    const { data: recordData, error: recordError } = await supabase
      .from("medical_records")
      .upsert(
        {
          reservation_id: medicalRecordReservation.id,
          hospital_id: hospital.id,
          pet_id: medicalRecordReservation.pet_id,
          diagnosis,
          doctor_note: doctorNote,
          care_instructions: careInstructions,
          medication_instructions: medicationInstructions || null,
          next_visit_date: medicalRecordForm.nextVisitDate || null,
          updated_at: completedAt,
        },
        { onConflict: "reservation_id" },
      )
      .select("id")
      .single();

    if (recordError || !recordData) {
      console.error("진료기록 저장 오류:", recordError);
      setMedicalRecordError(
        "진료기록을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
      setIsSavingMedicalRecord(false);
      return;
    }

    const medicalRecordId = Number(recordData.id);

    const { error: oldPrescriptionDeleteError } = await supabase
      .from("prescriptions")
      .delete()
      .eq("medical_record_id", medicalRecordId);

    if (oldPrescriptionDeleteError) {
      console.error(
        "기존 처방약 정리 오류:",
        oldPrescriptionDeleteError,
      );
      setMedicalRecordError(
        "진료기록은 저장했지만 기존 처방약 정보를 정리하지 못했습니다.",
      );
      setIsSavingMedicalRecord(false);
      return;
    }

    if (prescriptions.length > 0 && pet && medicalRecordReservation.pet_id) {
      for (const prescription of prescriptions) {
        const endDate = addDays(
          prescription.startDate,
          prescription.durationDays - 1,
        );

        const { data: prescriptionData, error: prescriptionError } =
          await supabase
            .from("prescriptions")
            .insert({
              medical_record_id: medicalRecordId,
              user_id: pet.user_id,
              pet_id: medicalRecordReservation.pet_id,
              medicine_name: prescription.medicineName.trim(),
              dosage: prescription.dosage.trim(),
              instructions: prescription.instructions.trim() || null,
              times_per_day: prescription.timesPerDay,
              duration_days: prescription.durationDays,
              start_date: prescription.startDate,
              end_date: endDate,
            })
            .select("id")
            .single();

        if (prescriptionError || !prescriptionData) {
          console.error("처방약 저장 오류:", prescriptionError);
          setMedicalRecordError(
            `${prescription.medicineName.trim()} 처방약을 저장하지 못했습니다.`,
          );
          setIsSavingMedicalRecord(false);
          return;
        }

        const prescriptionId = Number(prescriptionData.id);
        const scheduledTimes = prescription.scheduledTimes
          .filter(Boolean)
          .sort();

        const { error: scheduleError } = await supabase
          .from("medication_schedules")
          .insert(
            scheduledTimes.map((scheduledTime) => ({
              prescription_id: prescriptionId,
              scheduled_time: scheduledTime,
            })),
          );

        if (scheduleError) {
          console.error("복용 시간 저장 오류:", scheduleError);
          setMedicalRecordError(
            `${prescription.medicineName.trim()}의 복용 시간을 저장하지 못했습니다.`,
          );
          setIsSavingMedicalRecord(false);
          return;
        }

        const reminderRows = [];

        for (
          let dayOffset = 0;
          dayOffset < prescription.durationDays;
          dayOffset += 1
        ) {
          const reminderDate = addDays(prescription.startDate, dayOffset);

          for (const scheduledTime of scheduledTimes) {
            const scheduledAt = createScheduledAt(
              reminderDate,
              scheduledTime,
            );

            if (new Date(scheduledAt).getTime() <= Date.now()) {
              continue;
            }

            reminderRows.push({
              user_id: pet.user_id,
              pet_id: medicalRecordReservation.pet_id,
              reminder_type: "medication",
              source_table: "prescriptions",
              source_id: prescriptionId,
              title: `${medicalRecordReservation.pet_name} 약 복용 시간`,
              message: `${prescription.medicineName.trim()} ${prescription.dosage.trim()} 복용 시간입니다.`,
              scheduled_at: scheduledAt,
              status: "pending",
              channel: "push",
            });
          }
        }

        if (reminderRows.length > 0) {
          const { error: reminderError } = await supabase
            .from("reminders")
            .insert(reminderRows);

          if (reminderError) {
            console.error("약 복용 알림 저장 오류:", reminderError);
            setMedicalRecordError(
              `${prescription.medicineName.trim()}은 저장했지만 알림 일정을 만들지 못했습니다.`,
            );
            setIsSavingMedicalRecord(false);
            return;
          }
        }
      }
    }

    const { data: oldVaccinationRows, error: oldVaccinationReadError } =
      await supabase
        .from("vaccination_records")
        .select("id")
        .eq("medical_record_id", medicalRecordId);

    if (oldVaccinationReadError) {
      console.error("기존 예방접종 조회 오류:", oldVaccinationReadError);
      setMedicalRecordError(
        "진료기록은 저장했지만 기존 예방접종 기록을 확인하지 못했습니다.",
      );
      setIsSavingMedicalRecord(false);
      return;
    }

    const oldVaccinationIds = (oldVaccinationRows ?? []).map((row) =>
      Number(row.id),
    );

    if (oldVaccinationIds.length > 0) {
      const { error: oldVaccinationReminderDeleteError } = await supabase
        .from("reminders")
        .delete()
        .eq("source_table", "vaccination_records")
        .in("source_id", oldVaccinationIds);

      if (oldVaccinationReminderDeleteError) {
        console.error(
          "기존 예방접종 알림 정리 오류:",
          oldVaccinationReminderDeleteError,
        );
        setMedicalRecordError(
          "진료기록은 저장했지만 기존 예방접종 알림을 정리하지 못했습니다.",
        );
        setIsSavingMedicalRecord(false);
        return;
      }
    }

    const { error: oldVaccinationDeleteError } = await supabase
      .from("vaccination_records")
      .delete()
      .eq("medical_record_id", medicalRecordId);

    if (oldVaccinationDeleteError) {
      console.error("기존 예방접종 기록 정리 오류:", oldVaccinationDeleteError);
      setMedicalRecordError(
        "진료기록은 저장했지만 기존 예방접종 기록을 정리하지 못했습니다.",
      );
      setIsSavingMedicalRecord(false);
      return;
    }

    if (vaccinations.length > 0 && pet && medicalRecordReservation.pet_id) {
      for (const vaccination of vaccinations) {
        const { data: vaccinationData, error: vaccinationError } =
          await supabase
            .from("vaccination_records")
            .insert({
              medical_record_id: medicalRecordId,
              reservation_id: medicalRecordReservation.id,
              hospital_id: hospital.id,
              user_id: pet.user_id,
              pet_id: medicalRecordReservation.pet_id,
              vaccine_name: vaccination.vaccineName.trim(),
              manufacturer: vaccination.manufacturer.trim() || null,
              vaccinated_at: vaccination.vaccinatedAt,
              next_due_date: vaccination.nextDueDate || null,
              memo: vaccination.memo.trim() || null,
            })
            .select("id")
            .single();

        if (vaccinationError || !vaccinationData) {
          console.error("예방접종 기록 저장 오류:", vaccinationError);
          setMedicalRecordError(
            `${vaccination.vaccineName.trim()} 예방접종 기록을 저장하지 못했습니다.`,
          );
          setIsSavingMedicalRecord(false);
          return;
        }

        if (vaccination.nextDueDate) {
          const reminderDate = addDays(vaccination.nextDueDate, -7);
          const scheduledAt = createScheduledAt(reminderDate, "09:00");

          if (new Date(scheduledAt).getTime() > Date.now()) {
            const vaccinationId = Number(vaccinationData.id);
            const { error: vaccinationReminderError } = await supabase
              .from("reminders")
              .insert({
                user_id: pet.user_id,
                pet_id: medicalRecordReservation.pet_id,
                reminder_type: "vaccination",
                source_table: "vaccination_records",
                source_id: vaccinationId,
                title: `${medicalRecordReservation.pet_name} 예방접종 예정 안내`,
                message: `${vaccination.vaccineName.trim()} 다음 접종 예정일이 일주일 남았습니다.`,
                scheduled_at: scheduledAt,
                status: "pending",
                channel: "push",
              });

            if (vaccinationReminderError) {
              console.error(
                "예방접종 알림 저장 오류:",
                vaccinationReminderError,
              );
              setMedicalRecordError(
                `${vaccination.vaccineName.trim()} 접종 기록은 저장했지만 알림 일정을 만들지 못했습니다.`,
              );
              setIsSavingMedicalRecord(false);
              return;
            }
          }
        }
      }
    }

    if (
      medicalRecordForm.nextVisitDate &&
      pet &&
      medicalRecordReservation.pet_id
    ) {
      const reminderDate = addDays(medicalRecordForm.nextVisitDate, -1);
      const scheduledAt = createScheduledAt(reminderDate, "09:00");

      if (new Date(scheduledAt).getTime() > Date.now()) {
        const { error: nextVisitReminderError } = await supabase
          .from("reminders")
          .insert({
            user_id: pet.user_id,
            pet_id: medicalRecordReservation.pet_id,
            reminder_type: "next_visit",
            source_table: "medical_records",
            source_id: medicalRecordId,
            title: `${medicalRecordReservation.pet_name} 재진 예정 안내`,
            message: `내일은 ${medicalRecordReservation.pet_name}의 병원 방문 권장일입니다.`,
            scheduled_at: scheduledAt,
            status: "pending",
            channel: "push",
          });

        if (nextVisitReminderError) {
          console.error("재진 알림 저장 오류:", nextVisitReminderError);
          setMedicalRecordError(
            "진료기록은 저장했지만 재진 알림 일정을 만들지 못했습니다.",
          );
          setIsSavingMedicalRecord(false);
          return;
        }
      }
    }

    const { error: reservationError } = await supabase
      .from("reservations")
      .update({
        status: "completed",
        completed_at: completedAt,
      })
      .eq("id", medicalRecordReservation.id)
      .eq("hospital_id", hospital.id);

    if (reservationError) {
      console.error("진료 완료 처리 오류:", reservationError);
      setMedicalRecordError(
        "진료기록은 저장됐지만 예약 완료 처리를 하지 못했습니다. 다시 저장해 주세요.",
      );
      setIsSavingMedicalRecord(false);
      return;
    }

    setMonthReservations((currentReservations) =>
      currentReservations.map((reservation) =>
        reservation.id === medicalRecordReservation.id
          ? {
              ...reservation,
              status: "completed",
              completed_at: completedAt,
            }
          : reservation,
      ),
    );

    setSuccessMessage(
      `${medicalRecordReservation.pet_name}의 진료기록, 처방약, 예방접종 정보를 저장하고 진료를 완료했습니다.`,
    );
    setMedicalRecordReservation(null);
    setMedicalRecordForm(EMPTY_MEDICAL_RECORD_FORM);
    setPrescriptions([]);
    setVaccinations([]);
    setIsSavingMedicalRecord(false);
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
            <h1 className="text-2xl font-bold">로그인이 필요합니다</h1>

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
            <h1 className="text-2xl font-bold">예약 달력을 열 수 없습니다</h1>

            <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700">
              {errorMessage}
            </p>
          </section>
        </div>
      </main>
    );
  }

  const currentYear = currentMonth.getFullYear();
  const currentMonthIndex = currentMonth.getMonth();

  return (
    <main className="min-h-screen bg-gray-50 px-5 py-8 text-black">
      <div className="mx-auto w-full max-w-6xl">
        <Link
          href="/hospital-admin"
          className="inline-block rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm"
        >
          ← 관리자 홈
        </Link>

        <header className="mt-8">
          <p className="text-sm text-gray-500">PAWU 병원 관리자</p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight">예약 달력</h1>

          <p className="mt-3 text-sm text-gray-600">{hospital?.name}</p>
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

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-3xl border border-gray-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={movePreviousMonth}
                  className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
                >
                  ←
                </button>

                <button
                  type="button"
                  onClick={moveNextMonth}
                  className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
                >
                  →
                </button>

                <button
                  type="button"
                  onClick={moveToToday}
                  className="rounded-xl border border-gray-300 px-3 py-2 text-sm font-medium"
                >
                  오늘
                </button>
              </div>

              <h2 className="text-xl font-bold">
                {currentYear}년 {currentMonthIndex + 1}월
              </h2>
            </div>

            <div className="mt-6 grid grid-cols-7 text-center text-xs font-semibold text-gray-500">
              <div className="py-2 text-red-500">일</div>
              <div className="py-2">월</div>
              <div className="py-2">화</div>
              <div className="py-2">수</div>
              <div className="py-2">목</div>
              <div className="py-2">금</div>
              <div className="py-2 text-blue-500">토</div>
            </div>

            {isLoadingReservations ? (
              <div className="py-20 text-center text-sm text-gray-500">
                예약 달력을 불러오는 중입니다.
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, index) => {
                  if (day === null) {
                    return (
                      <div
                        key={`empty-${index}`}
                        className="aspect-square rounded-xl bg-gray-50"
                      />
                    );
                  }

                  const dateString = formatDateString(
                    currentYear,
                    currentMonthIndex,
                    day,
                  );

                  const count = reservationCountByDate[dateString] ?? 0;

                  const isSelected = selectedDate === dateString;

                  const isToday = getTodayString() === dateString;

                  return (
                    <button
                      key={dateString}
                      type="button"
                      onClick={() => setSelectedDate(dateString)}
                      className={`relative aspect-square rounded-xl border p-2 text-left transition ${
                        isSelected
                          ? "border-black bg-black text-white"
                          : "border-gray-200 bg-white hover:border-black"
                      }`}
                    >
                      <span
                        className={`text-sm font-semibold ${
                          isToday && !isSelected ? "text-blue-600" : ""
                        }`}
                      >
                        {day}
                      </span>

                      {count > 0 && (
                        <span
                          className={`absolute bottom-2 left-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            isSelected
                              ? "bg-white text-black"
                              : "bg-green-100 text-green-800"
                          }`}
                        >
                          {count}건
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm text-gray-500">선택한 날짜</p>

                <h2 className="mt-1 text-2xl font-bold">{selectedDate}</h2>
              </div>

              <span className="rounded-full bg-black px-3 py-1 text-sm text-white">
                {selectedReservations.length}건
              </span>
            </div>

            {selectedReservations.length === 0 ? (
              <div className="mt-4 rounded-3xl border border-gray-200 bg-white p-8 text-center">
                <h3 className="text-lg font-bold">예약이 없습니다</h3>

                <p className="mt-2 text-sm text-gray-500">
                  선택한 날짜에 등록된 예약이 없습니다.
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {selectedReservations.map((reservation) => {
                  const pet = Array.isArray(reservation.pets)
                    ? (reservation.pets[0] ?? null)
                    : reservation.pets;

                  const displayedPetName = pet?.name ?? reservation.pet_name;

                  const isChanging = changingReservationId === reservation.id;

                  return (
                    <article
                      key={reservation.id}
                      className="rounded-3xl border border-gray-200 bg-white p-5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-2xl font-bold">
                            {reservation.reservation_time.slice(0, 5)}
                          </p>

                          <h3 className="mt-2 text-lg font-bold">
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
                            reservation.status,
                          )}`}
                        >
                          {getStatusLabel(reservation.status)}
                        </span>
                      </div>

                      <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <dt className="text-gray-400">보호자</dt>

                          <dd className="mt-1 font-medium">
                            {reservation.guardian_name}
                          </dd>
                        </div>

                        <div>
                          <dt className="text-gray-400">연락처</dt>

                          <dd className="mt-1 font-medium">
                            {reservation.phone}
                          </dd>
                        </div>

                        <div>
                          <dt className="text-gray-400">방문 목적</dt>

                          <dd className="mt-1 font-medium">
                            {getVisitReasonLabel(reservation.visit_reason)}
                          </dd>
                        </div>

                        <div>
                          <dt className="text-gray-400">예약번호</dt>

                          <dd className="mt-1 font-medium">
                            #{reservation.id}
                          </dd>
                        </div>
                      </dl>

                      <div className="mt-5 rounded-2xl bg-gray-100 p-4">
                        <p className="text-sm font-semibold">
                          증상 및 요청사항
                        </p>

                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-600">
                          {reservation.symptoms || "작성된 내용이 없습니다."}
                        </p>
                      </div>

                      {reservation.status === "requested" && (
                        <div className="mt-5 grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              handleStatusChange(reservation.id, "approved")
                            }
                            disabled={
                              isChanging || changingReservationId !== null
                            }
                            className="rounded-2xl bg-green-600 px-4 py-3 text-sm font-semibold text-white disabled:bg-gray-400"
                          >
                            {isChanging ? "처리 중..." : "예약 승인"}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleStatusChange(reservation.id, "rejected")
                            }
                            disabled={
                              isChanging || changingReservationId !== null
                            }
                            className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white disabled:bg-gray-400"
                          >
                            {isChanging ? "처리 중..." : "예약 거절"}
                          </button>
                        </div>
                      )}

                      {reservation.status === "approved" && (
                        <div className="mt-5 grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              handleStatusChange(reservation.id, "in_progress")
                            }
                            disabled={
                              isChanging || changingReservationId !== null
                            }
                            className="rounded-2xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white disabled:bg-gray-400"
                          >
                            {isChanging ? "처리 중..." : "진료 시작"}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleStatusChange(reservation.id, "no_show")
                            }
                            disabled={
                              isChanging || changingReservationId !== null
                            }
                            className="rounded-2xl bg-orange-600 px-4 py-3 text-sm font-semibold text-white disabled:bg-gray-400"
                          >
                            {isChanging ? "처리 중..." : "노쇼 처리"}
                          </button>
                        </div>
                      )}

                      {reservation.status === "in_progress" && (
                        <button
                          type="button"
                          onClick={() => openMedicalRecordModal(reservation)}
                          disabled={
                            isChanging || changingReservationId !== null
                          }
                          className="mt-5 w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:bg-gray-400"
                        >
                          {isChanging ? "처리 중..." : "진료기록 작성 및 완료"}
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      {medicalRecordReservation && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="medical-record-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeMedicalRecordModal();
            }
          }}
        >
          <section className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-purple-600">
                  PAWU 진료 차트
                </p>
                <h2
                  id="medical-record-title"
                  className="mt-2 text-2xl font-bold"
                >
                  진료기록 작성
                </h2>
                <p className="mt-2 text-sm text-gray-500">
                  {medicalRecordReservation.pet_name} ·{" "}
                  {medicalRecordReservation.guardian_name} 보호자 · 예약 #
                  {medicalRecordReservation.id}
                </p>
              </div>

              <button
                type="button"
                onClick={closeMedicalRecordModal}
                disabled={isSavingMedicalRecord}
                className="rounded-full border border-gray-200 px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                닫기
              </button>
            </div>

            <div className="mt-6 rounded-2xl bg-gray-50 p-4 text-sm text-gray-600">
              진료기록을 저장하면 예약이 자동으로 진료 완료 상태로 변경되고
              보호자가 내용을 확인할 수 있습니다.
            </div>

            {medicalRecordError && (
              <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {medicalRecordError}
              </div>
            )}

            <div className="mt-6 grid gap-5">
              <label className="block">
                <span className="text-sm font-semibold">
                  진단명 <span className="text-red-500">*</span>
                </span>
                <input
                  type="text"
                  value={medicalRecordForm.diagnosis}
                  onChange={(event) =>
                    updateMedicalRecordField("diagnosis", event.target.value)
                  }
                  placeholder="예: 외이염, 장염, 정기 건강검진"
                  className="mt-2 w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-black"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold">
                  의사 소견 <span className="text-red-500">*</span>
                </span>
                <textarea
                  value={medicalRecordForm.doctorNote}
                  onChange={(event) =>
                    updateMedicalRecordField("doctorNote", event.target.value)
                  }
                  placeholder="검사 결과, 현재 상태, 치료 방향 등을 적어 주세요."
                  rows={5}
                  className="mt-2 w-full resize-y rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-black"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold">
                  보호자 주의사항 <span className="text-red-500">*</span>
                </span>
                <textarea
                  value={medicalRecordForm.careInstructions}
                  onChange={(event) =>
                    updateMedicalRecordField(
                      "careInstructions",
                      event.target.value,
                    )
                  }
                  placeholder="목욕, 산책, 식사, 상처 관리 등 집에서 지켜야 할 내용을 적어 주세요."
                  rows={4}
                  className="mt-2 w-full resize-y rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-black"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold">공통 투약 안내</span>
                <textarea
                  value={medicalRecordForm.medicationInstructions}
                  onChange={(event) =>
                    updateMedicalRecordField(
                      "medicationInstructions",
                      event.target.value,
                    )
                  }
                  placeholder="예: 모든 약은 식후에 복용하고 구토 시 병원으로 연락해 주세요."
                  rows={3}
                  className="mt-2 w-full resize-y rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-black"
                />
              </label>

              <section className="rounded-3xl border border-blue-200 bg-blue-50/40 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold">💊 처방약</h3>
                    <p className="mt-1 text-sm text-gray-600">
                      복용 횟수와 같은 개수의 복용 시간을 입력해 주세요.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={addPrescription}
                    disabled={isSavingMedicalRecord}
                    className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:bg-gray-400"
                  >
                    + 처방약 추가
                  </button>
                </div>

                {prescriptions.length === 0 ? (
                  <div className="mt-5 rounded-2xl border border-dashed border-blue-200 bg-white p-5 text-center text-sm text-gray-500">
                    처방약이 없으면 추가하지 않아도 됩니다.
                  </div>
                ) : (
                  <div className="mt-5 space-y-5">
                    {prescriptions.map((prescription, prescriptionIndex) => (
                      <article
                        key={prescription.clientId}
                        className="rounded-3xl border border-gray-200 bg-white p-5"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <h4 className="font-bold">
                            처방약 {prescriptionIndex + 1}
                          </h4>

                          <button
                            type="button"
                            onClick={() =>
                              removePrescription(prescription.clientId)
                            }
                            disabled={isSavingMedicalRecord}
                            className="rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 disabled:opacity-50"
                          >
                            삭제
                          </button>
                        </div>

                        <div className="mt-5 grid gap-4 sm:grid-cols-2">
                          <label className="block">
                            <span className="text-sm font-semibold">
                              약 이름 <span className="text-red-500">*</span>
                            </span>
                            <input
                              type="text"
                              value={prescription.medicineName}
                              onChange={(event) =>
                                updatePrescription(
                                  prescription.clientId,
                                  "medicineName",
                                  event.target.value,
                                )
                              }
                              placeholder="예: 아목시실린"
                              className="mt-2 w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-black"
                            />
                          </label>

                          <label className="block">
                            <span className="text-sm font-semibold">
                              1회 복용량 <span className="text-red-500">*</span>
                            </span>
                            <input
                              type="text"
                              value={prescription.dosage}
                              onChange={(event) =>
                                updatePrescription(
                                  prescription.clientId,
                                  "dosage",
                                  event.target.value,
                                )
                              }
                              placeholder="예: 1정, 2.5mL"
                              className="mt-2 w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-black"
                            />
                          </label>

                          <label className="block">
                            <span className="text-sm font-semibold">
                              하루 복용 횟수
                            </span>
                            <input
                              type="number"
                              min={1}
                              max={24}
                              value={prescription.timesPerDay}
                              onChange={(event) =>
                                updatePrescription(
                                  prescription.clientId,
                                  "timesPerDay",
                                  Math.max(1, Number(event.target.value) || 1),
                                )
                              }
                              className="mt-2 w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-black"
                            />
                          </label>

                          <label className="block">
                            <span className="text-sm font-semibold">
                              복용 기간
                            </span>
                            <div className="mt-2 flex items-center gap-2">
                              <input
                                type="number"
                                min={1}
                                value={prescription.durationDays}
                                onChange={(event) =>
                                  updatePrescription(
                                    prescription.clientId,
                                    "durationDays",
                                    Math.max(
                                      1,
                                      Number(event.target.value) || 1,
                                    ),
                                  )
                                }
                                className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-black"
                              />
                              <span className="shrink-0 text-sm text-gray-500">
                                일
                              </span>
                            </div>
                          </label>

                          <label className="block">
                            <span className="text-sm font-semibold">
                              복용 시작일
                            </span>
                            <input
                              type="date"
                              value={prescription.startDate}
                              onChange={(event) =>
                                updatePrescription(
                                  prescription.clientId,
                                  "startDate",
                                  event.target.value,
                                )
                              }
                              className="mt-2 w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-black"
                            />
                          </label>

                          <label className="block sm:col-span-2">
                            <span className="text-sm font-semibold">
                              복용 안내
                            </span>
                            <input
                              type="text"
                              value={prescription.instructions}
                              onChange={(event) =>
                                updatePrescription(
                                  prescription.clientId,
                                  "instructions",
                                  event.target.value,
                                )
                              }
                              placeholder="예: 식후 복용, 냉장 보관"
                              className="mt-2 w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-black"
                            />
                          </label>
                        </div>

                        <div className="mt-5 rounded-2xl bg-gray-50 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold">복용 시간</p>
                              <p className="mt-1 text-xs text-gray-500">
                                현재 {prescription.scheduledTimes.length}개 ·
                                하루 {prescription.timesPerDay}회
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                addPrescriptionTime(prescription.clientId)
                              }
                              disabled={isSavingMedicalRecord}
                              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50"
                            >
                              + 시간 추가
                            </button>
                          </div>

                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            {prescription.scheduledTimes.map(
                              (scheduledTime, timeIndex) => (
                                <div
                                  key={`${prescription.clientId}-${timeIndex}`}
                                  className="flex items-center gap-2"
                                >
                                  <input
                                    type="time"
                                    value={scheduledTime}
                                    onChange={(event) =>
                                      updatePrescriptionTime(
                                        prescription.clientId,
                                        timeIndex,
                                        event.target.value,
                                      )
                                    }
                                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 outline-none focus:border-black"
                                  />

                                  <button
                                    type="button"
                                    onClick={() =>
                                      removePrescriptionTime(
                                        prescription.clientId,
                                        timeIndex,
                                      )
                                    }
                                    disabled={
                                      isSavingMedicalRecord ||
                                      prescription.scheduledTimes.length === 1
                                    }
                                    className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm disabled:opacity-40"
                                  >
                                    삭제
                                  </button>
                                </div>
                              ),
                            )}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-3xl border border-emerald-200 bg-emerald-50/40 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold">💉 예방접종</h3>
                    <p className="mt-1 text-sm text-gray-600">
                      접종한 백신과 다음 접종 예정일을 입력해 주세요.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={addVaccination}
                    disabled={isSavingMedicalRecord}
                    className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:bg-gray-400"
                  >
                    + 예방접종 추가
                  </button>
                </div>

                {vaccinations.length === 0 ? (
                  <div className="mt-5 rounded-2xl border border-dashed border-emerald-200 bg-white p-5 text-center text-sm text-gray-500">
                    이번 진료에서 접종하지 않았다면 추가하지 않아도 됩니다.
                  </div>
                ) : (
                  <div className="mt-5 space-y-5">
                    {vaccinations.map((vaccination, vaccinationIndex) => (
                      <article
                        key={vaccination.clientId}
                        className="rounded-3xl border border-gray-200 bg-white p-5"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <h4 className="font-bold">
                            예방접종 {vaccinationIndex + 1}
                          </h4>

                          <button
                            type="button"
                            onClick={() =>
                              removeVaccination(vaccination.clientId)
                            }
                            disabled={isSavingMedicalRecord}
                            className="rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 disabled:opacity-50"
                          >
                            삭제
                          </button>
                        </div>

                        <div className="mt-5 grid gap-4 sm:grid-cols-2">
                          <label className="block">
                            <span className="text-sm font-semibold">
                              백신명 <span className="text-red-500">*</span>
                            </span>
                            <input
                              type="text"
                              value={vaccination.vaccineName}
                              onChange={(event) =>
                                updateVaccination(
                                  vaccination.clientId,
                                  "vaccineName",
                                  event.target.value,
                                )
                              }
                              placeholder="예: DHPPL 종합백신"
                              className="mt-2 w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-black"
                            />
                          </label>

                          <label className="block">
                            <span className="text-sm font-semibold">제조사</span>
                            <input
                              type="text"
                              value={vaccination.manufacturer}
                              onChange={(event) =>
                                updateVaccination(
                                  vaccination.clientId,
                                  "manufacturer",
                                  event.target.value,
                                )
                              }
                              placeholder="선택 입력"
                              className="mt-2 w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-black"
                            />
                          </label>

                          <label className="block">
                            <span className="text-sm font-semibold">
                              접종일 <span className="text-red-500">*</span>
                            </span>
                            <input
                              type="date"
                              value={vaccination.vaccinatedAt}
                              max={getTodayString()}
                              onChange={(event) =>
                                updateVaccination(
                                  vaccination.clientId,
                                  "vaccinatedAt",
                                  event.target.value,
                                )
                              }
                              className="mt-2 w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-black"
                            />
                          </label>

                          <label className="block">
                            <span className="text-sm font-semibold">
                              다음 접종 예정일
                            </span>
                            <input
                              type="date"
                              value={vaccination.nextDueDate}
                              min={vaccination.vaccinatedAt || getTodayString()}
                              onChange={(event) =>
                                updateVaccination(
                                  vaccination.clientId,
                                  "nextDueDate",
                                  event.target.value,
                                )
                              }
                              className="mt-2 w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-black"
                            />
                            <p className="mt-2 text-xs text-gray-500">
                              입력하면 예정일 7일 전 오전 9시에 알림이 생성됩니다.
                            </p>
                          </label>

                          <label className="block sm:col-span-2">
                            <span className="text-sm font-semibold">메모</span>
                            <textarea
                              value={vaccination.memo}
                              onChange={(event) =>
                                updateVaccination(
                                  vaccination.clientId,
                                  "memo",
                                  event.target.value,
                                )
                              }
                              placeholder="예: 2차 접종 완료, 접종 후 안정 필요"
                              rows={3}
                              className="mt-2 w-full resize-y rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-black"
                            />
                          </label>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <label className="block">
                <span className="text-sm font-semibold">다음 방문 권장일</span>
                <input
                  type="date"
                  value={medicalRecordForm.nextVisitDate}
                  min={getTodayString()}
                  onChange={(event) =>
                    updateMedicalRecordField(
                      "nextVisitDate",
                      event.target.value,
                    )
                  }
                  className="mt-2 w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-black"
                />
              </label>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={closeMedicalRecordModal}
                disabled={isSavingMedicalRecord}
                className="rounded-2xl border border-gray-300 px-5 py-4 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              >
                취소
              </button>

              <button
                type="button"
                onClick={handleMedicalRecordSubmit}
                disabled={isSavingMedicalRecord}
                className="rounded-2xl bg-blue-600 px-5 py-4 font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {isSavingMedicalRecord ? "저장 중..." : "저장 후 진료 완료"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}