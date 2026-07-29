import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireHospitalContext } from "@/lib/hospital-api-auth";

export async function DELETE(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      hospitalizationId: string;
      eventId: string;
    }>;
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
  const hospitalizationId = Number(resolved.hospitalizationId);
  const eventId = Number(resolved.eventId);

  if (
    !Number.isInteger(hospitalizationId) ||
    !Number.isInteger(eventId)
  ) {
    return NextResponse.json(
      { message: "기록 번호가 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const { data: hospitalization, error: hospitalizationError } =
    await supabaseAdmin
      .from("hospitalizations")
      .select("id")
      .eq("id", hospitalizationId)
      .eq("hospital_id", context.hospitalId)
      .maybeSingle();

  if (hospitalizationError) {
    return NextResponse.json(
      { message: hospitalizationError.message },
      { status: 500 },
    );
  }

  if (!hospitalization) {
    return NextResponse.json(
      { message: "입원 기록을 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const { data: current, error: currentError } = await supabaseAdmin
    .from("hospitalization_events")
    .select("*")
    .eq("id", eventId)
    .eq("hospitalization_id", hospitalizationId)
    .maybeSingle();

  if (currentError) {
    return NextResponse.json(
      { message: currentError.message },
      { status: 500 },
    );
  }

  if (!current) {
    return NextResponse.json(
      { message: "삭제할 기록을 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const { error } = await supabaseAdmin
    .from("hospitalization_events")
    .delete()
    .eq("id", eventId)
    .eq("hospitalization_id", hospitalizationId);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  await supabaseAdmin.from("inpatient_surgery_audit_logs").insert({
    hospital_id: context.hospitalId,
    hospitalization_id: hospitalizationId,
    actor_user_id: context.user.id,
    action: "hospitalization_event_deleted",
    before_data: current,
  });

  return NextResponse.json({ message: "입원 기록이 삭제되었습니다." });
}
