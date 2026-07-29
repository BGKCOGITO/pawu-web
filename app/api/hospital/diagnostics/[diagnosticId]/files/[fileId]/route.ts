import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  isHospitalDiagnosticAuthError,
  requireHospitalDiagnosticContext,
} from "@/lib/hospital-diagnostic-auth";

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ diagnosticId: string; fileId: string }>;
  },
) {
  const context = await requireHospitalDiagnosticContext(request);

  if (isHospitalDiagnosticAuthError(context)) {
    return NextResponse.json(
      { message: context.error },
      { status: context.status },
    );
  }

  const resolved = await params;
  const diagnosticId = Number(resolved.diagnosticId);
  const fileId = Number(resolved.fileId);

  const { data: file, error } = await supabaseAdmin
    .from("diagnostic_files")
    .select(`
      *,
      diagnostic_orders!inner(
        id,
        hospital_id
      )
    `)
    .eq("id", fileId)
    .eq("diagnostic_order_id", diagnosticId)
    .eq("diagnostic_orders.hospital_id", context.hospitalId)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { message: error.message },
      { status: 500 },
    );
  }

  if (!file) {
    return NextResponse.json(
      { message: "검사 파일을 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const { data: signed, error: signedError } =
    await supabaseAdmin.storage
      .from(file.storage_bucket)
      .createSignedUrl(file.storage_path, 60 * 10);

  if (signedError || !signed) {
    return NextResponse.json(
      {
        message:
          signedError?.message ??
          "파일 열람 주소를 생성하지 못했습니다.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    file,
    signedUrl: signed.signedUrl,
    expiresIn: 600,
  });
}

export async function DELETE(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ diagnosticId: string; fileId: string }>;
  },
) {
  const context = await requireHospitalDiagnosticContext(request);

  if (isHospitalDiagnosticAuthError(context)) {
    return NextResponse.json(
      { message: context.error },
      { status: context.status },
    );
  }

  const resolved = await params;
  const diagnosticId = Number(resolved.diagnosticId);
  const fileId = Number(resolved.fileId);

  const { data: file, error } = await supabaseAdmin
    .from("diagnostic_files")
    .select(`
      *,
      diagnostic_orders!inner(
        id,
        hospital_id
      )
    `)
    .eq("id", fileId)
    .eq("diagnostic_order_id", diagnosticId)
    .eq("diagnostic_orders.hospital_id", context.hospitalId)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { message: error.message },
      { status: 500 },
    );
  }

  if (!file) {
    return NextResponse.json(
      { message: "삭제할 검사 파일을 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const { error: storageError } = await supabaseAdmin.storage
    .from(file.storage_bucket)
    .remove([file.storage_path]);

  if (storageError) {
    return NextResponse.json(
      { message: storageError.message },
      { status: 500 },
    );
  }

  const { error: deleteError } = await supabaseAdmin
    .from("diagnostic_files")
    .delete()
    .eq("id", fileId)
    .eq("diagnostic_order_id", diagnosticId);

  if (deleteError) {
    return NextResponse.json(
      { message: deleteError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    deletedFileId: fileId,
  });
}
