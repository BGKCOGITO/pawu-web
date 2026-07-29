import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import { buildMedicalSummary } from "../../../../lib/pawu-ai-safety";
import { getAuthUser, readBearer } from "../../../../lib/chat-access";

export async function POST(request: Request) {
  const user = await getAuthUser(readBearer(request));
  if (!user) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await request.json()) as { medicalRecordId?: number };
  const medicalRecordId = Number(body.medicalRecordId);

  const { data: record } = await supabaseAdmin
    .from("medical_records")
    .select("id, user_id, hospital_id, diagnosis, exam_results, care_instructions, medication_instructions, next_visit_date")
    .eq("id", medicalRecordId)
    .maybeSingle();

  if (!record) {
    return NextResponse.json({ ok: false, message: "진료기록을 찾지 못했습니다." }, { status: 404 });
  }

  let allowed = record.user_id === user.id;

  if (!allowed) {
    const { data: staff } = await supabaseAdmin
      .from("hospital_staff")
      .select("id")
      .eq("user_id", user.id)
      .eq("hospital_id", record.hospital_id)
      .eq("is_active", true)
      .maybeSingle();

    const { data: admin } = await supabaseAdmin
      .from("hospital_admins")
      .select("id")
      .eq("user_id", user.id)
      .eq("hospital_id", record.hospital_id)
      .maybeSingle();

    allowed = Boolean(staff || admin);
  }

  if (!allowed) {
    return NextResponse.json({ ok: false, message: "진료기록 접근 권한이 없습니다." }, { status: 403 });
  }

  const summary = buildMedicalSummary(record);

  await supabaseAdmin
    .from("medical_records")
    .update({
      easy_explanation: summary,
      ai_summary_updated_at: new Date().toISOString(),
    })
    .eq("id", medicalRecordId);

  return NextResponse.json({ ok: true, summary });
}
