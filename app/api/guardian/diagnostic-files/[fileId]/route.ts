import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ fileId: string }>;
  },
) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return NextResponse.json(
      { message: "로그인 세션이 필요합니다." },
      { status: 401 },
    );
  }

  const accessToken = authorization.slice("Bearer ".length);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { message: "Supabase 환경변수가 필요합니다." },
      { status: 500 },
    );
  }

  const authClient = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser(accessToken);

  if (userError || !user) {
    return NextResponse.json(
      { message: "로그인 세션이 만료되었습니다." },
      { status: 401 },
    );
  }

  const { fileId: fileIdParam } = await params;
  const fileId = Number(fileIdParam);

  if (!Number.isInteger(fileId)) {
    return NextResponse.json(
      { message: "검사 파일 번호가 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const { data: file, error } = await supabaseAdmin
    .from("diagnostic_files")
    .select(`
      id,
      storage_bucket,
      storage_path,
      original_filename,
      mime_type,
      file_kind,
      caption,
      is_guardian_visible,
      diagnostic_orders!inner(
        id,
        status,
        is_guardian_visible,
        medical_records!inner(
          id,
          reservations!inner(
            id,
            user_id
          )
        )
      )
    `)
    .eq("id", fileId)
    .eq("is_guardian_visible", true)
    .eq("diagnostic_orders.status", "completed")
    .eq("diagnostic_orders.is_guardian_visible", true)
    .eq("diagnostic_orders.medical_records.reservations.user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { message: error.message },
      { status: 500 },
    );
  }

  if (!file) {
    return NextResponse.json(
      { message: "공개된 검사 파일을 찾을 수 없습니다." },
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
          "검사 파일 열람 주소를 생성하지 못했습니다.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    file: {
      id: file.id,
      originalFilename: file.original_filename,
      mimeType: file.mime_type,
      fileKind: file.file_kind,
      caption: file.caption,
    },
    signedUrl: signed.signedUrl,
    expiresIn: 600,
  });
}
