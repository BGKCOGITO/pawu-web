import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type TimelineKind =
  | "reservation"
  | "visit"
  | "prescription"
  | "vaccination"
  | "weight"
  | "hospitalization"
  | "inpatient_update"
  | "health_event"
  | "follow_up";

type TimelineEvent = {
  id: string;
  petId: number;
  kind: TimelineKind;
  occurredAt: string;
  title: string;
  summary: string | null;
  hospitalName: string | null;
  status: string | null;
  meta?: Record<string, string | number | boolean | null>;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function safeQuery<T>(label: string, query: PromiseLike<{ data: T | null; error: { message: string } | null }>) {
  const result = await query;
  if (result.error) {
    console.warn(`[health-timeline] ${label}:`, result.error.message);
    return [] as unknown as T;
  }
  return (result.data ?? []) as T;
}

export async function POST(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";

  if (!token) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(token);

  if (userError || !user) {
    return NextResponse.json(
      { message: "로그인 정보가 유효하지 않습니다." },
      { status: 401 },
    );
  }

  let body: {
    petId?: number;
    weightKg?: number;
    measuredAt?: string;
    memo?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "입력값을 확인해 주세요." }, { status: 400 });
  }

  const petId = Number(body.petId);
  const weightKg = Number(body.weightKg);
  const measuredAt = typeof body.measuredAt === "string" ? body.measuredAt : "";
  const memo = typeof body.memo === "string" ? body.memo.trim().slice(0, 200) : null;

  if (!Number.isInteger(petId) || !Number.isFinite(weightKg) || weightKg <= 0 || weightKg > 300) {
    return NextResponse.json({ message: "체중을 올바르게 입력해 주세요." }, { status: 400 });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(measuredAt)) {
    return NextResponse.json({ message: "측정 날짜를 확인해 주세요." }, { status: 400 });
  }

  const { data: pet, error: petError } = await supabaseAdmin
    .from("pets")
    .select("id")
    .eq("id", petId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (petError || !pet) {
    return NextResponse.json({ message: "반려동물 정보를 확인할 수 없습니다." }, { status: 404 });
  }

  const { data: record, error: insertError } = await supabaseAdmin
    .from("weight_records")
    .insert({
      user_id: user.id,
      pet_id: petId,
      weight_kg: weightKg,
      measured_at: measuredAt,
      memo,
    })
    .select("id,pet_id,weight_kg,measured_at,memo,created_at")
    .single();

  if (insertError) {
    console.error("[health-timeline] weight insert:", insertError.message);
    return NextResponse.json({ message: "체중 기록을 저장하지 못했습니다." }, { status: 500 });
  }

  await supabaseAdmin
    .from("pets")
    .update({ weight_kg: weightKg })
    .eq("id", petId)
    .eq("user_id", user.id);

  return NextResponse.json({ record });
}

export async function GET(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";

  if (!token) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(token);

  if (userError || !user) {
    return NextResponse.json(
      { message: "로그인 정보가 유효하지 않습니다." },
      { status: 401 },
    );
  }

  const petParam = Number(new URL(request.url).searchParams.get("petId"));

  const pets = await safeQuery<any[]>(
    "pets",
    supabaseAdmin
      .from("pets")
      .select("id,name,species,breed,birth_date,gender,weight_kg,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
  );

  const ownedPetIds = pets.map((pet) => Number(pet.id));
  const selectedPetIds = Number.isInteger(petParam) && ownedPetIds.includes(petParam)
    ? [petParam]
    : ownedPetIds;

  if (!selectedPetIds.length) {
    return NextResponse.json({ pets, events: [], weightRecords: [], summary: {} });
  }

  const [reservations, emrRecords, medicationOrders, healthEvents, weightRecords, patientRows, guardianUpdates] =
    await Promise.all([
      safeQuery<any[]>(
        "reservations",
        supabaseAdmin
          .from("reservations")
          .select("id,pet_id,reservation_date,reservation_time,visit_reason,symptoms,status,created_at,hospitals(name)")
          .eq("user_id", user.id)
          .in("pet_id", selectedPetIds)
          .order("reservation_date", { ascending: false }),
      ),
      safeQuery<any[]>(
        "emr_records",
        supabaseAdmin
          .from("emr_records")
          .select(`
            id,pet_id,status,diagnosis_summary,treatment_summary,guardian_summary,
            follow_up_date,finalized_at,created_at,hospitals(name),
            emr_prescriptions(id,medication_name,dosage,unit,frequency,duration_days,route,instructions),
            emr_followups(id,follow_up_type,due_date,title,note,status)
          `)
          .in("pet_id", selectedPetIds)
          .eq("status", "finalized")
          .order("finalized_at", { ascending: false }),
      ),
      safeQuery<any[]>(
        "medication_orders",
        supabaseAdmin
          .from("medication_orders")
          .select(`
            id,pet_id,diagnosis_summary,guardian_note,start_date,end_date,finalized_at,status,
            hospitals(name),medication_order_items(id,medication_name,dose_amount,dose_unit,route,frequency,duration_days,instructions)
          `)
          .in("pet_id", selectedPetIds)
          .eq("status", "finalized")
          .eq("guardian_visible", true)
          .order("finalized_at", { ascending: false }),
      ),
      safeQuery<any[]>(
        "pet_health_events",
        supabaseAdmin
          .from("pet_health_events")
          .select("id,pet_id,occurred_at,event_type,severity,priority,count_value,title,note,share_with_hospital")
          .eq("user_id", user.id)
          .in("pet_id", selectedPetIds)
          .order("occurred_at", { ascending: false }),
      ),
      safeQuery<any[]>(
        "weight_records",
        supabaseAdmin
          .from("weight_records")
          .select("id,pet_id,weight_kg,measured_at,memo,created_at")
          .eq("user_id", user.id)
          .in("pet_id", selectedPetIds)
          .order("measured_at", { ascending: true }),
      ),
      safeQuery<any[]>(
        "hospital_patients",
        supabaseAdmin
          .from("hospital_patients")
          .select("id,pet_id")
          .in("pet_id", selectedPetIds),
      ),
      safeQuery<any[]>(
        "hospitalization_guardian_updates",
        supabaseAdmin
          .from("hospitalization_guardian_updates")
          .select("id,pet_id,hospitalization_id,category,title,message,published_at,hospitals(name)")
          .eq("guardian_user_id", user.id)
          .in("pet_id", selectedPetIds)
          .is("retracted_at", null)
          .order("published_at", { ascending: false }),
      ),
    ]);

  const patientToPet = new Map<number, number>();
  patientRows.forEach((row) => patientToPet.set(Number(row.id), Number(row.pet_id)));
  const patientIds = [...patientToPet.keys()];

  const hospitalizations = patientIds.length
    ? await safeQuery<any[]>(
        "hospitalizations",
        supabaseAdmin
          .from("hospitalizations")
          .select("id,hospital_patient_id,status,admission_reason,admitted_at,expected_discharge_at,discharged_at,updated_at,hospitals(name)")
          .in("hospital_patient_id", patientIds)
          .order("admitted_at", { ascending: false }),
      )
    : [];

  const events: TimelineEvent[] = [];

  reservations.forEach((row) => {
    const hospital = one<any>(row.hospitals);
    const occurredAt = `${row.reservation_date}T${row.reservation_time || "00:00"}:00`;
    events.push({
      id: `reservation-${row.id}`,
      petId: Number(row.pet_id),
      kind: "reservation",
      occurredAt,
      title: row.status === "completed" ? "진료 예약 완료" : "진료 예약",
      summary: text(row.visit_reason) || text(row.symptoms),
      hospitalName: hospital?.name ?? null,
      status: row.status ?? null,
      meta: { reservationDate: row.reservation_date, reservationTime: row.reservation_time },
    });
  });

  emrRecords.forEach((row) => {
    const hospital = one<any>(row.hospitals);
    const occurredAt = row.finalized_at || row.created_at;
    events.push({
      id: `visit-${row.id}`,
      petId: Number(row.pet_id),
      kind: "visit",
      occurredAt,
      title: "진료 기록",
      summary: text(row.guardian_summary) || text(row.diagnosis_summary) || text(row.treatment_summary),
      hospitalName: hospital?.name ?? null,
      status: row.status ?? null,
    });

    (row.emr_prescriptions ?? []).forEach((item: any) => {
      events.push({
        id: `emr-prescription-${item.id}`,
        petId: Number(row.pet_id),
        kind: "prescription",
        occurredAt,
        title: item.medication_name || "처방약",
        summary: [item.dosage, item.unit, item.frequency, item.duration_days ? `${item.duration_days}일` : null, item.instructions]
          .filter(Boolean)
          .join(" · ") || null,
        hospitalName: hospital?.name ?? null,
        status: "prescribed",
      });
    });

    (row.emr_followups ?? []).forEach((item: any) => {
      if (!item.due_date) return;
      events.push({
        id: `follow-up-${item.id}`,
        petId: Number(row.pet_id),
        kind: "follow_up",
        occurredAt: `${item.due_date}T09:00:00`,
        title: item.title || "예정된 관리",
        summary: text(item.note),
        hospitalName: hospital?.name ?? null,
        status: item.status ?? "scheduled",
      });
    });
  });

  medicationOrders.forEach((row) => {
    const hospital = one<any>(row.hospitals);
    (row.medication_order_items ?? []).forEach((item: any) => {
      events.push({
        id: `medication-order-${row.id}-${item.id}`,
        petId: Number(row.pet_id),
        kind: "prescription",
        occurredAt: row.finalized_at || `${row.start_date}T09:00:00`,
        title: item.medication_name || "처방약",
        summary: [
          item.dose_amount && item.dose_unit ? `${item.dose_amount}${item.dose_unit}` : null,
          item.frequency,
          item.duration_days ? `${item.duration_days}일` : null,
          item.instructions,
        ].filter(Boolean).join(" · ") || text(row.guardian_note) || text(row.diagnosis_summary),
        hospitalName: hospital?.name ?? null,
        status: "prescribed",
        meta: { startDate: row.start_date, endDate: row.end_date },
      });
    });
  });

  const healthLabels: Record<string, string> = {
    vomiting: "구토 기록",
    diarrhea: "설사 기록",
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
    accident: "사고 기록",
    other: "건강 기록",
  };

  healthEvents.forEach((row) => {
    events.push({
      id: `health-${row.id}`,
      petId: Number(row.pet_id),
      kind: row.event_type === "weight" ? "weight" : "health_event",
      occurredAt: row.occurred_at,
      title: row.title || healthLabels[row.event_type] || "건강 기록",
      summary: text(row.note),
      hospitalName: null,
      status: row.priority ?? null,
      meta: { severity: row.severity, count: row.count_value, shared: Boolean(row.share_with_hospital) },
    });
  });

  weightRecords.forEach((row) => {
    events.push({
      id: `weight-${row.id}`,
      petId: Number(row.pet_id),
      kind: "weight",
      occurredAt: `${row.measured_at}T12:00:00`,
      title: `체중 ${Number(row.weight_kg).toFixed(1)}kg`,
      summary: text(row.memo),
      hospitalName: null,
      status: null,
      meta: { weightKg: Number(row.weight_kg) },
    });
  });

  hospitalizations.forEach((row) => {
    const petId = patientToPet.get(Number(row.hospital_patient_id));
    if (!petId) return;
    const hospital = one<any>(row.hospitals);
    events.push({
      id: `hospitalization-admit-${row.id}`,
      petId,
      kind: "hospitalization",
      occurredAt: row.admitted_at,
      title: "입원",
      summary: text(row.admission_reason),
      hospitalName: hospital?.name ?? null,
      status: row.status ?? "admitted",
    });
    if (row.discharged_at) {
      events.push({
        id: `hospitalization-discharge-${row.id}`,
        petId,
        kind: "hospitalization",
        occurredAt: row.discharged_at,
        title: "퇴원 완료",
        summary: null,
        hospitalName: hospital?.name ?? null,
        status: "discharged",
      });
    }
  });

  guardianUpdates.forEach((row) => {
    const hospital = one<any>(row.hospitals);
    events.push({
      id: `inpatient-update-${row.id}`,
      petId: Number(row.pet_id),
      kind: "inpatient_update",
      occurredAt: row.published_at,
      title: row.title || "입원 경과",
      summary: text(row.message),
      hospitalName: hospital?.name ?? null,
      status: row.category ?? null,
    });
  });

  events.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const summary = {
    total: events.length,
    visits: events.filter((event) => event.kind === "visit").length,
    prescriptions: events.filter((event) => event.kind === "prescription").length,
    hospitalizations: events.filter((event) => event.kind === "hospitalization" && event.title === "입원").length,
    upcoming: events.filter((event) => ["reservation", "follow_up"].includes(event.kind) && new Date(event.occurredAt) >= today).length,
  };

  return NextResponse.json({ pets, events, weightRecords, summary });
}
