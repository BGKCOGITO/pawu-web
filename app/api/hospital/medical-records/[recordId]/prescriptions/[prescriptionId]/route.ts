import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireHospitalContext } from "@/lib/hospital-api-auth";

export async function DELETE(
  request: NextRequest,
  { params }: {
    params: Promise<{ recordId: string; prescriptionId: string }>;
  },
) {
  const context = await requireHospitalContext(request);

  if ("error" in context) {
    return NextResponse.json(
      { message: context.error },
      { status: context.status },
    );
  }

  const resolved = await params;
  const recordId = Number(resolved.recordId);
  const prescriptionId = Number(resolved.prescriptionId);

  if (!Number.isInteger(recordId) || !Number.isInteger(prescriptionId)) {
    return NextResponse.json(
      { message: "처방 삭제 요청이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const { data: prescription, error: readError } = await supabaseAdmin
    .from("medical_prescriptions")
    .select("id,medical_record_id,hospital_id")
    .eq("id", prescriptionId)
    .eq("medical_record_id", recordId)
    .eq("hospital_id", context.hospitalId)
    .maybeSingle();

  if (readError) {
    return NextResponse.json({ message: readError.message }, { status: 500 });
  }

  if (!prescription) {
    return NextResponse.json(
      { message: "삭제할 처방을 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const { error: deleteError } = await supabaseAdmin
    .from("medical_prescriptions")
    .delete()
    .eq("id", prescriptionId)
    .eq("medical_record_id", recordId)
    .eq("hospital_id", context.hospitalId);

  if (deleteError) {
    return NextResponse.json(
      { message: deleteError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
