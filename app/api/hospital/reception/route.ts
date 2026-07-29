import { NextResponse } from "next/server";
import { can, getHospitalAccess, readBearer } from "../../../../lib/hospital-access";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

async function accessOf(request: Request) {
  const access = await getHospitalAccess(readBearer(request));
  if (!access || !can(access, "manage_reservations")) return null;
  return access;
}

export async function GET(request: Request) {
  const access = await accessOf(request);
  if (!access) return NextResponse.json({ message: "접수 관리 권한이 필요합니다." }, { status: 403 });
  const date = new URL(request.url).searchParams.get("date") ?? new Date().toISOString().slice(0, 10);

  const [{ data: entries, error }, { data: reservations }] = await Promise.all([
    supabaseAdmin.from("hospital_waiting_entries").select("*")
      .eq("hospital_id", access.hospitalId).eq("waiting_date", date)
      .order("priority", { ascending: true }).order("waiting_number", { ascending: true }),
    supabaseAdmin.from("reservations").select("id,pet_id,pet_name,guardian_name,phone,reservation_time,visit_reason,symptoms,status,pets(name,species,breed)")
      .eq("hospital_id", access.hospitalId).eq("reservation_date", date)
      .in("status", ["approved", "requested"]).order("reservation_time"),
  ]);
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  const used = new Set((entries ?? []).map((row: any) => Number(row.reservation_id)).filter(Boolean));
  return NextResponse.json({ entries: entries ?? [], reservations: (reservations ?? []).filter((r: any) => !used.has(Number(r.id))) });
}

export async function POST(request: Request) {
  const access = await accessOf(request);
  if (!access) return NextResponse.json({ message: "접수 관리 권한이 필요합니다." }, { status: 403 });
  const body = await request.json();
  const date = String(body.waitingDate ?? new Date().toISOString().slice(0, 10));
  const { data: nextNumber, error: numberError } = await supabaseAdmin.rpc("pawu_next_waiting_number", { p_hospital_id: access.hospitalId, p_date: date });
  if (numberError) return NextResponse.json({ message: numberError.message }, { status: 400 });

  let source = "walk_in";
  let payload: any = {
    hospital_id: access.hospitalId, waiting_date: date, waiting_number: nextNumber,
    pet_name: String(body.petName ?? "").trim(), guardian_name: String(body.guardianName ?? "").trim() || null,
    phone: String(body.phone ?? "").trim() || null, visit_reason: String(body.visitReason ?? "").trim() || null,
    symptoms: String(body.symptoms ?? "").trim() || null, priority: body.priority ?? "normal", created_by: access.userId,
  };

  if (body.reservationId) {
    const { data: reservation } = await supabaseAdmin.from("reservations")
      .select("id,pet_id,pet_name,guardian_name,phone,visit_reason,symptoms,pets(name)")
      .eq("id", body.reservationId).eq("hospital_id", access.hospitalId).single();
    if (!reservation) return NextResponse.json({ message: "예약을 찾을 수 없습니다." }, { status: 404 });
    const pet: any = Array.isArray(reservation.pets) ? reservation.pets[0] : reservation.pets;
    source = "reservation";
    payload = { ...payload, reservation_id: reservation.id, pet_id: reservation.pet_id,
      pet_name: pet?.name ?? reservation.pet_name ?? "환자", guardian_name: reservation.guardian_name,
      phone: reservation.phone, visit_reason: reservation.visit_reason, symptoms: reservation.symptoms };
  }
  if (!payload.pet_name) return NextResponse.json({ message: "환자명을 입력해 주세요." }, { status: 400 });
  payload.source = source;
  const { data, error } = await supabaseAdmin.from("hospital_waiting_entries").insert(payload).select("*").single();
  if (error) return NextResponse.json({ message: error.code === "23505" ? "이미 접수된 예약입니다." : error.message }, { status: 400 });
  if (payload.reservation_id) await supabaseAdmin.from("reservations").update({ status: "arrived" }).eq("id", payload.reservation_id);
  return NextResponse.json({ entry: data });
}

export async function PATCH(request: Request) {
  const access = await accessOf(request);
  if (!access) return NextResponse.json({ message: "접수 관리 권한이 필요합니다." }, { status: 403 });
  const body = await request.json();
  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  for (const key of ["status", "priority", "room_name", "assigned_staff_name"] as const) if (body[key] !== undefined) updates[key] = body[key] || null;
  if (body.action === "call") { updates.status = "called"; updates.called_at = new Date().toISOString(); updates.call_count = Number(body.callCount ?? 0) + 1; }
  if (updates.status === "in_consultation") updates.consultation_started_at = new Date().toISOString();
  if (updates.status === "completed") updates.completed_at = new Date().toISOString();
  const { data, error } = await supabaseAdmin.from("hospital_waiting_entries").update(updates)
    .eq("id", body.id).eq("hospital_id", access.hospitalId).select("*").single();
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  return NextResponse.json({ entry: data });
}
