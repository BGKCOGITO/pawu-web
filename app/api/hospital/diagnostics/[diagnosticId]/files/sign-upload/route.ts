import { NextResponse } from "next/server";
import crypto from "node:crypto";
import path from "node:path";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  isHospitalDiagnosticAuthError,
  requireHospitalDiagnosticContext,
} from "@/lib/hospital-diagnostic-auth";

type Body = {
  filename?: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  fileKind?: string;
  caption?: string | null;
  isGuardianVisible?: boolean;
};

const fileKinds = new Set([
  "image",
  "dicom",
  "pdf",
  "report",
  "video",
  "other",
]);

function safeFilename(filename: string) {
  const extension = path.extname(filename).toLowerCase();
  const stem = path
    .basename(filename, extension)
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return `${stem || "file"}${extension}`;
}

export async function POST(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ diagnosticId: string }>;
  },
) {
  const context = await requireHospitalDiagnosticContext(request);

  if (isHospitalDiagnosticAuthError(context)) {
    return NextResponse.json(
      { message: context.error },
      { status: context.status },
    );
  }

  const { diagnosticId: diagnosticIdParam } = await params;
  const diagnosticId = Number(diagnosticIdParam);
  const body = (await request.json()) as Body;
  const filename = String(body.filename ?? "").trim();
  const fileKind = String(body.fileKind ?? "other").trim();

  if (!Number.isInteger(diagnosticId)) {
    return NextResponse.json(
      { message: "검사 번호가 올바르지 않습니다." },
      { status: 400 },
    );
  }

  if (!filename) {
    return NextResponse.json(
      { message: "파일명이 필요합니다." },
      { status: 400 },
    );
  }

  if (!fileKinds.has(fileKind)) {
    return NextResponse.json(
      { message: "파일 종류가 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const sizeBytes = Number(body.sizeBytes ?? 0);

  if (sizeBytes > 52428800) {
    return NextResponse.json(
      { message: "파일은 최대 50MB까지 업로드할 수 있습니다." },
      { status: 400 },
    );
  }

  const { data: order, error: orderError } = await supabaseAdmin
    .from("diagnostic_orders")
    .select("id,hospital_id,medical_record_id")
    .eq("id", diagnosticId)
    .eq("hospital_id", context.hospitalId)
    .maybeSingle();

  if (orderError) {
    return NextResponse.json(
      { message: orderError.message },
      { status: 500 },
    );
  }

  if (!order) {
    return NextResponse.json(
      { message: "검사 기록을 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const storagePath = [
    `hospital-${context.hospitalId}`,
    `record-${order.medical_record_id}`,
    `diagnostic-${diagnosticId}`,
    `${Date.now()}-${crypto.randomUUID()}-${safeFilename(filename)}`,
  ].join("/");

  const { data: signedUpload, error: uploadError } =
    await supabaseAdmin.storage
      .from("diagnostic-files")
      .createSignedUploadUrl(storagePath);

  if (uploadError || !signedUpload) {
    return NextResponse.json(
      {
        message:
          uploadError?.message ??
          "업로드 URL을 생성하지 못했습니다.",
      },
      { status: 500 },
    );
  }

  const { data: file, error: fileError } = await supabaseAdmin
    .from("diagnostic_files")
    .insert({
      diagnostic_order_id: diagnosticId,
      storage_bucket: "diagnostic-files",
      storage_path: storagePath,
      original_filename: filename,
      mime_type:
        String(body.mimeType ?? "").trim() || null,
      size_bytes:
        Number.isFinite(sizeBytes) && sizeBytes > 0
          ? sizeBytes
          : null,
      file_kind: fileKind,
      caption: String(body.caption ?? "").trim() || null,
      is_guardian_visible:
        body.isGuardianVisible === true,
      uploaded_by: context.userId,
    })
    .select("*")
    .single();

  if (fileError) {
    return NextResponse.json(
      { message: fileError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    file,
    upload: {
      path: signedUpload.path,
      token: signedUpload.token,
      signedUrl: signedUpload.signedUrl,
    },
  });
}
