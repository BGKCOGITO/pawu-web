import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabase-admin";
import { getHospitalAccess, readBearer } from "../../../../../lib/hospital-access";

export async function GET(request: Request) {
  const access = await getHospitalAccess(readBearer(request));
  if (!access) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

  const hospitalId = access.hospitalId;
  const [{ data: beds, error: bedsError }, { data: admissions, error: admissionsError }, { data: tasks, error: tasksError }, { data: surgeries, error: surgeriesError }] = await Promise.all([
    supabaseAdmin.from("hospital_beds").select("id,name,ward,bed_type,is_active,occupied").eq("hospital_id", hospitalId).order("ward").order("name"),
    supabaseAdmin.from("hospital_admissions").select("id,patient_id,patient_name,guardian_name,guardian_phone,bed_id,bed_name,reason,status,admitted_at,expected_discharge_at").eq("hospital_id", hospitalId).in("status", ["planned", "admitted"]).order("created_at", { ascending: false }),
    supabaseAdmin.from("hospital_admission_tasks").select("id,admission_id,title,due_at,status,assignee_name,note").eq("hospital_id", hospitalId).neq("status", "cancelled").order("due_at"),
    supabaseAdmin.from("hospital_surgeries").select("id,patient_id,patient_name,admission_id,title,surgeon_name,operating_room,scheduled_start,scheduled_end,status,consent_confirmed,fasting_confirmed,preop_test_confirmed,anesthesia_confirmed,note").eq("hospital_id", hospitalId).in("status", ["scheduled", "ready", "in_progress", "recovery"]).order("scheduled_start"),
  ]);

  const error = bedsError ?? admissionsError ?? tasksError ?? surgeriesError;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ beds: beds ?? [], admissions: admissions ?? [], tasks: tasks ?? [], surgeries: surgeries ?? [] });
}
