import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-admin";

export type HospitalDiagnosticContext = {
  userId: string;
  hospitalId: number;
};

export type HospitalDiagnosticAuthResult =
  | HospitalDiagnosticContext
  | {
      error: string;
      status: number;
    };

export async function requireHospitalDiagnosticContext(
  request: Request,
): Promise<HospitalDiagnosticAuthResult> {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return {
      error: "병원 관리자 로그인 세션이 필요합니다.",
      status: 401,
    };
  }

  const accessToken = authorization.slice("Bearer ".length);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return {
      error: "Supabase 공개 환경변수가 설정되지 않았습니다.",
      status: 500,
    };
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
    return {
      error: "로그인 세션이 만료되었거나 올바르지 않습니다.",
      status: 401,
    };
  }

  const { data: hospitalAdmin, error: adminError } =
    await supabaseAdmin
      .from("hospital_admins")
      .select("hospital_id")
      .eq("user_id", user.id)
      .maybeSingle();

  if (adminError) {
    return {
      error: adminError.message,
      status: 500,
    };
  }

  const hospitalId = Number(hospitalAdmin?.hospital_id);

  if (!Number.isInteger(hospitalId)) {
    return {
      error: "연결된 병원 관리자 정보를 찾을 수 없습니다.",
      status: 403,
    };
  }

  return {
    userId: user.id,
    hospitalId,
  };
}

export function isHospitalDiagnosticAuthError(
  value: HospitalDiagnosticAuthResult,
): value is { error: string; status: number } {
  return "error" in value;
}
