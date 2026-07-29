import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireHospitalContext } from "@/lib/hospital-api-auth";

type Props = { params: Promise<{ reviewId: string }> };

export async function PATCH(request: NextRequest, { params }: Props) {
  const context = await requireHospitalContext(request);
  if ("error" in context) return NextResponse.json({ message: context.error }, { status: context.status });
  const { reviewId } = await params;
  const id = Number(reviewId);
  const body = await request.json();
  const reply = String(body.reply ?? "").trim();
  if (!Number.isInteger(id) || reply.length < 2 || reply.length > 2000) return NextResponse.json({ message: "답글은 2자 이상 2000자 이하로 작성해 주세요." }, { status: 400 });
  const { error } = await supabaseAdmin.from("hospital_visit_reviews").update({ hospital_reply: reply, hospital_replied_at: new Date().toISOString(), hospital_replied_by: context.user.id, updated_at: new Date().toISOString() }).eq("id", id).eq("hospital_id", context.hospitalId).eq("status", "published");
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ message: "병원 답글이 등록되었습니다." });
}
