import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  isHospitalDiagnosticAuthError,
  requireHospitalDiagnosticContext,
} from "@/lib/hospital-diagnostic-auth";

type CreateDiagnosticBody = {
  category?: string;
  testCode?: string | null;
  testName?: string;
  bodySite?: string | null;
  priority?: string;
  scheduledAt?: string | null;
  clinicalNote?: string | null;
};

const categories = new Set([
  "laboratory",
  "xray",
  "ultrasound",
  "ct",
  "mri",
  "endoscopy",
  "pathology",
  "other",
]);

const priorities = new Set(["routine", "urgent", "stat"]);

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ recordId: string }>;
  },
) {
  const context = await requireHospitalDiagnosticContext(request);

  if (isHospitalDiagnosticAuthError(context)) {
    return NextResponse.json(
      { message: context.error },
      { status: context.status },
    );
  }

  const { recordId: recordIdParam } = await params;
  const recordId = Number(recordIdParam);

  if (!Number.isInteger(recordId)) {
    return NextResponse.json(
      { message: "전자차트 번호가 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const { data: record, error: recordError } = await supabaseAdmin
    .from("medical_records")
    .select("id,hospital_id")
    .eq("id", recordId)
    .eq("hospital_id", context.hospitalId)
    .maybeSingle();

  if (recordError) {
    return NextResponse.json(
      { message: recordError.message },
      { status: 500 },
    );
  }

  if (!record) {
    return NextResponse.json(
      { message: "전자차트를 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from("diagnostic_orders")
    .select(`
      *,
      diagnostic_result_items(
        id,
        item_code,
        item_name,
        value_text,
        value_number,
        unit,
        reference_min,
        reference_max,
        reference_text,
        abnormal_flag,
        sort_order,
        note,
        created_at,
        updated_at
      ),
      diagnostic_files(
        id,
        storage_bucket,
        storage_path,
        original_filename,
        mime_type,
        size_bytes,
        file_kind,
        caption,
        is_guardian_visible,
        created_at
      )
    `)
    .eq("hospital_id", context.hospitalId)
    .eq("medical_record_id", recordId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    diagnostics: data ?? [],
  });
}

export async function POST(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ recordId: string }>;
  },
) {
  const context = await requireHospitalDiagnosticContext(request);

  if (isHospitalDiagnosticAuthError(context)) {
    return NextResponse.json(
      { message: context.error },
      { status: context.status },
    );
  }

  const { recordId: recordIdParam } = await params;
  const recordId = Number(recordIdParam);
  const body = (await request.json()) as CreateDiagnosticBody;

  const category = String(body.category ?? "").trim();
  const testName = String(body.testName ?? "").trim();
  const priority = String(body.priority ?? "routine").trim();

  if (!Number.isInteger(recordId)) {
    return NextResponse.json(
      { message: "전자차트 번호가 올바르지 않습니다." },
      { status: 400 },
    );
  }

  if (!categories.has(category)) {
    return NextResponse.json(
      { message: "검사 분류가 올바르지 않습니다." },
      { status: 400 },
    );
  }

  if (!testName) {
    return NextResponse.json(
      { message: "검사명을 입력해 주세요." },
      { status: 400 },
    );
  }

  if (!priorities.has(priority)) {
    return NextResponse.json(
      { message: "검사 우선순위가 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const { data: record, error: recordError } = await supabaseAdmin
    .from("medical_records")
    .select(`
      id,
      hospital_id,
      hospital_patient_id,
      reservation_id
    `)
    .eq("id", recordId)
    .eq("hospital_id", context.hospitalId)
    .maybeSingle();

  if (recordError) {
    return NextResponse.json(
      { message: recordError.message },
      { status: 500 },
    );
  }

  if (!record) {
    return NextResponse.json(
      { message: "전자차트를 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const payload = {
    hospital_id: context.hospitalId,
    medical_record_id: recordId,
    hospital_patient_id: record.hospital_patient_id ?? null,
    reservation_id: record.reservation_id ?? null,
    category,
    test_code: String(body.testCode ?? "").trim() || null,
    test_name: testName,
    body_site: String(body.bodySite ?? "").trim() || null,
    priority,
    status: body.scheduledAt ? "scheduled" : "ordered",
    ordered_by: context.userId,
    scheduled_at: body.scheduledAt || null,
    clinical_note:
      String(body.clinicalNote ?? "").trim() || null,
  };

  const { data, error } = await supabaseAdmin
    .from("diagnostic_orders")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { message: error.message },
      { status: 500 },
    );
  }

  await supabaseAdmin.from("diagnostic_audit_logs").insert({
    hospital_id: context.hospitalId,
    diagnostic_order_id: data.id,
    actor_user_id: context.userId,
    action: "diagnostic_created",
    after_data: data,
  });

  return NextResponse.json(
    {
      success: true,
      diagnostic: data,
    },
    { status: 201 },
  );
}
