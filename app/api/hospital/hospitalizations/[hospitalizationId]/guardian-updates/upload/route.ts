import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireHospitalContext } from "@/lib/hospital-api-auth";

const BUCKET = "hospitalization-guardian-media";
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function extensionFor(file: File) {
  const byType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  return byType[file.type] ?? "bin";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ hospitalizationId: string }> },
) {
  const context = await requireHospitalContext(request);
  if ("error" in context) {
    return NextResponse.json({ message: context.error }, { status: context.status });
  }

  const { hospitalizationId: rawId } = await params;
  const hospitalizationId = Number(rawId);
  if (!Number.isInteger(hospitalizationId)) {
    return NextResponse.json({ message: "입원 기록 번호가 올바르지 않습니다." }, { status: 400 });
  }

  const { data: hospitalization, error: hospitalizationError } = await supabaseAdmin
    .from("hospitalizations")
    .select("id")
    .eq("id", hospitalizationId)
    .eq("hospital_id", context.hospitalId)
    .maybeSingle();

  if (hospitalizationError) {
    return NextResponse.json({ message: hospitalizationError.message }, { status: 500 });
  }
  if (!hospitalization) {
    return NextResponse.json({ message: "입원 기록을 찾을 수 없습니다." }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ message: "업로드할 사진을 선택해 주세요." }, { status: 400 });
  }
  if (!allowedTypes.has(file.type)) {
    return NextResponse.json({ message: "JPG, PNG, WEBP, GIF 이미지만 업로드할 수 있습니다." }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ message: "사진은 10MB 이하만 업로드할 수 있습니다." }, { status: 400 });
  }

  const path = `${context.hospitalId}/${hospitalizationId}/${Date.now()}-${randomUUID()}.${extensionFor(file)}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json({ message: uploadError.message }, { status: 500 });
  }

  return NextResponse.json({ storagePath: path, message: "사진이 업로드되었습니다." });
}
