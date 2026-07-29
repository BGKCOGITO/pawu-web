import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const BUCKET = "hospitalization-guardian-media";

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export async function GET(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";

  if (!token) {
    return NextResponse.json(
      { message: "로그인이 필요합니다." },
      { status: 401 },
    );
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

  const { data: updateRows, error: updateError } = await supabaseAdmin
    .from("hospitalization_guardian_updates")
    .select(`
      id,
      category,
      title,
      message,
      image_url,
      image_storage_path,
      published_at,
      hospitalization_id,
      hospitals(name, phone, address),
      pets(id, name, species, breed)
    `)
    .eq("guardian_user_id", user.id)
    .is("retracted_at", null)
    .order("published_at", { ascending: false })
    .limit(200);

  if (updateError) {
    return NextResponse.json(
      { message: updateError.message },
      { status: 500 },
    );
  }

  const updates = await Promise.all(
    (updateRows ?? []).map(async (item) => {
      if (!item.image_storage_path) return item;

      const { data: signed } = await supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUrl(item.image_storage_path, 60 * 60);

      return { ...item, image_url: signed?.signedUrl ?? null };
    }),
  );

  const [{ data: ownedPets, error: petsError }, { data: reservations, error: reservationsError }] =
    await Promise.all([
      supabaseAdmin.from("pets").select("id").eq("user_id", user.id),
      supabaseAdmin.from("reservations").select("id").eq("user_id", user.id),
    ]);

  if (petsError) {
    return NextResponse.json({ message: petsError.message }, { status: 500 });
  }

  if (reservationsError) {
    return NextResponse.json(
      { message: reservationsError.message },
      { status: 500 },
    );
  }

  const petIds = (ownedPets ?? []).map((row) => Number(row.id));
  const reservationIds = (reservations ?? []).map((row) => Number(row.id));

  const { data: patientRows, error: patientError } = petIds.length
    ? await supabaseAdmin
        .from("hospital_patients")
        .select("id")
        .in("pet_id", petIds)
    : { data: [], error: null };

  if (patientError) {
    return NextResponse.json(
      { message: patientError.message },
      { status: 500 },
    );
  }

  const hospitalPatientIds = (patientRows ?? []).map((row) => Number(row.id));
  const selectHospitalization = `
    id,
    hospital_id,
    hospital_patient_id,
    reservation_id,
    status,
    admission_reason,
    admitted_at,
    expected_discharge_at,
    discharged_at,
    updated_at,
    hospitals(name, phone, address),
    hospital_patients(
      pet_id,
      pets(id, name, species, breed)
    )
  `;

  const hospitalizationQueries: PromiseLike<any>[] = [];

  if (hospitalPatientIds.length) {
    hospitalizationQueries.push(
      supabaseAdmin
        .from("hospitalizations")
        .select(selectHospitalization)
        .in("hospital_patient_id", hospitalPatientIds)
        .order("admitted_at", { ascending: false })
        .limit(100),
    );
  }

  if (reservationIds.length) {
    hospitalizationQueries.push(
      supabaseAdmin
        .from("hospitalizations")
        .select(selectHospitalization)
        .in("reservation_id", reservationIds)
        .order("admitted_at", { ascending: false })
        .limit(100),
    );
  }

  const hospitalizationResults = await Promise.all(hospitalizationQueries);
  const hospitalizationMap = new Map<number, any>();

  for (const result of hospitalizationResults) {
    if (result.error) {
      return NextResponse.json(
        { message: result.error.message },
        { status: 500 },
      );
    }

    for (const row of result.data ?? []) {
      hospitalizationMap.set(Number(row.id), row);
    }
  }

  const updateCounts = new Map<number, number>();
  const latestUpdateAt = new Map<number, string>();

  for (const update of updates) {
    const hospitalizationId = Number(update.hospitalization_id);
    updateCounts.set(
      hospitalizationId,
      (updateCounts.get(hospitalizationId) ?? 0) + 1,
    );

    if (!latestUpdateAt.has(hospitalizationId)) {
      latestUpdateAt.set(hospitalizationId, String(update.published_at));
    }
  }

  const hospitalizations = Array.from(hospitalizationMap.values())
    .map((row) => {
      const patient = one(row.hospital_patients as any);
      const pet = one(patient?.pets);
      const hospital = one(row.hospitals as any);

      return {
        id: Number(row.id),
        status: String(row.status),
        admission_reason: row.admission_reason ?? null,
        admitted_at: row.admitted_at,
        expected_discharge_at: row.expected_discharge_at ?? null,
        discharged_at: row.discharged_at ?? null,
        updated_at: row.updated_at ?? null,
        hospital: hospital
          ? {
              name: hospital.name ?? "동물병원",
              phone: hospital.phone ?? null,
              address: hospital.address ?? null,
            }
          : null,
        pet: pet
          ? {
              id: pet.id ?? patient?.pet_id ?? null,
              name: pet.name ?? "반려동물",
              species: pet.species ?? null,
              breed: pet.breed ?? null,
            }
          : null,
        update_count: updateCounts.get(Number(row.id)) ?? 0,
        latest_update_at: latestUpdateAt.get(Number(row.id)) ?? null,
      };
    })
    .sort(
      (a, b) =>
        new Date(b.admitted_at).getTime() - new Date(a.admitted_at).getTime(),
    );

  return NextResponse.json({ updates, hospitalizations });
}
