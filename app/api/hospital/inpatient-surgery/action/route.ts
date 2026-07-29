import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabase-admin";
import { can, getHospitalAccess, readBearer } from "../../../../../lib/hospital-access";

type Body = { action?: string; [key: string]: unknown };
const text = (v: unknown) => typeof v === "string" ? v.trim() : "";
const num = (v: unknown) => Number(v);

export async function POST(request: Request) {
  const access = await getHospitalAccess(readBearer(request));
  if (!access) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  if (!can(access, "write_medical_records") && !can(access, "manage_billing_status")) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  const body = await request.json() as Body;
  const action = text(body.action);
  const hospitalId = access.hospitalId;

  if (action === "create_bed") {
    const name = text(body.name); if (!name) return NextResponse.json({ error: "병상명을 입력하세요." }, { status: 400 });
    const { error } = await supabaseAdmin.from("hospital_beds").insert({ hospital_id: hospitalId, name, ward: text(body.ward) || null, bed_type: text(body.bed_type) || "general" });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  } else if (action === "admit") {
    const patientName = text(body.patient_name); const bedId = num(body.bed_id);
    if (!patientName || !Number.isFinite(bedId)) return NextResponse.json({ error: "환자와 병상을 확인하세요." }, { status: 400 });
    const { data: bed } = await supabaseAdmin.from("hospital_beds").select("id,name,occupied").eq("hospital_id", hospitalId).eq("id", bedId).single();
    if (!bed || bed.occupied) return NextResponse.json({ error: "사용 가능한 병상이 아닙니다." }, { status: 409 });
    const { error } = await supabaseAdmin.rpc("pawu_admit_patient_v659", { p_hospital_id: hospitalId, p_patient_id: Number.isFinite(num(body.patient_id)) ? num(body.patient_id) : null, p_patient_name: patientName, p_guardian_name: text(body.guardian_name) || null, p_guardian_phone: text(body.guardian_phone) || null, p_bed_id: bedId, p_reason: text(body.reason) || null, p_expected_discharge_at: text(body.expected_discharge_at) || null, p_actor_id: access.userId });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  } else if (action === "discharge") {
    const { error } = await supabaseAdmin.rpc("pawu_discharge_patient_v659", { p_hospital_id: hospitalId, p_admission_id: num(body.admission_id), p_actor_id: access.userId });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  } else if (action === "create_task") {
    const { error } = await supabaseAdmin.from("hospital_admission_tasks").insert({ hospital_id: hospitalId, admission_id: num(body.admission_id), title: text(body.title), due_at: text(body.due_at), assignee_name: text(body.assignee_name) || null, note: text(body.note) || null, created_by: access.userId });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  } else if (action === "complete_task") {
    const { error } = await supabaseAdmin.from("hospital_admission_tasks").update({ status: "done", completed_at: new Date().toISOString(), completed_by: access.userId }).eq("hospital_id", hospitalId).eq("id", num(body.task_id));
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  } else if (action === "create_surgery") {
    const { error } = await supabaseAdmin.from("hospital_surgeries").insert({ hospital_id: hospitalId, patient_id: Number.isFinite(num(body.patient_id)) ? num(body.patient_id) : null, patient_name: text(body.patient_name), admission_id: Number.isFinite(num(body.admission_id)) ? num(body.admission_id) : null, title: text(body.title), surgeon_name: text(body.surgeon_name) || null, operating_room: text(body.operating_room) || null, scheduled_start: text(body.scheduled_start), scheduled_end: text(body.scheduled_end) || null, note: text(body.note) || null, created_by: access.userId });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  } else if (action === "update_surgery") {
    const allowed = ["scheduled", "ready", "in_progress", "recovery", "completed", "cancelled"];
    const status = text(body.status); if (!allowed.includes(status)) return NextResponse.json({ error: "잘못된 수술 상태입니다." }, { status: 400 });
    const patch = { status, consent_confirmed: Boolean(body.consent_confirmed), fasting_confirmed: Boolean(body.fasting_confirmed), preop_test_confirmed: Boolean(body.preop_test_confirmed), anesthesia_confirmed: Boolean(body.anesthesia_confirmed), updated_at: new Date().toISOString() };
    const { error } = await supabaseAdmin.from("hospital_surgeries").update(patch).eq("hospital_id", hospitalId).eq("id", num(body.surgery_id));
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  } else return NextResponse.json({ error: "지원하지 않는 작업입니다." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
