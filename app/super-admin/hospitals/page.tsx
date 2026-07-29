"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

type RequestStatus = "pending" | "approved" | "rejected";

type SignupRequest = {
  id: number;
  user_id: string;
  hospital_name: string;
  address: string;
  phone: string;
  manager_phone: string;
  business_registration_number: string;
  business_license_path: string;
  status: RequestStatus;
  rejection_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
};

function formatDate(value: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

async function getFunctionErrorMessage(
  error: unknown,
  fallback: string,
) {
  const context =
    (error as { context?: Response })?.context;

  if (context) {
    try {
      const body = await context.json();
      return String(body?.message ?? fallback);
    } catch {
      return fallback;
    }
  }

  return fallback;
}

export default function HospitalApprovalAdminPage() {
  const router = useRouter();

  const [requests, setRequests] =
    useState<SignupRequest[]>([]);
  const [statusFilter, setStatusFilter] =
    useState<RequestStatus>("pending");
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] =
    useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [noticeMessage, setNoticeMessage] = useState("");

  const visibleRequests = useMemo(
    () =>
      requests.filter(
        (request) => request.status === statusFilter,
      ),
    [requests, statusFilter],
  );

  async function loadRequests() {
    setIsLoading(true);
    setErrorMessage("");

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      router.replace("/auth/login");
      return;
    }

    const { data: superAdmin, error: adminError } =
      await supabase
        .from("super_admins")
        .select("user_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

    if (adminError || !superAdmin) {
      setErrorMessage(
        "최고관리자 권한이 없는 계정입니다.",
      );
      setIsLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("hospital_signup_requests")
      .select(
        `
          id,
          user_id,
          hospital_name,
          address,
          phone,
          manager_phone,
          business_registration_number,
          business_license_path,
          status,
          rejection_reason,
          reviewed_at,
          created_at
        `,
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("병원 가입 신청 조회 실패:", error);
      setErrorMessage(
        "병원 가입 신청 목록을 불러오지 못했습니다.",
      );
      setIsLoading(false);
      return;
    }

    setRequests((data ?? []) as SignupRequest[]);
    setIsLoading(false);
  }

  useEffect(() => {
    void loadRequests();
  }, []);

  async function openLicense(path: string) {
    setErrorMessage("");

    const { data, error } = await supabase.storage
      .from("hospital-business-licenses")
      .createSignedUrl(path, 60);

    if (error || !data?.signedUrl) {
      setErrorMessage(
        "사업자등록증 파일을 열지 못했습니다.",
      );
      return;
    }

    window.open(
      data.signedUrl,
      "_blank",
      "noopener,noreferrer",
    );
  }

  async function reviewRequest(
    request: SignupRequest,
    action: "approve" | "reject",
  ) {
    setNoticeMessage("");
    setErrorMessage("");

    let reason = "";

    if (action === "approve") {
      const confirmed = window.confirm(
        `${request.hospital_name} 가입을 승인할까요?\n승인 후 병원 관리자 권한이 생성되고 안내 문자가 발송됩니다.`,
      );

      if (!confirmed) return;
    } else {
      const enteredReason = window.prompt(
        `${request.hospital_name} 신청의 반려 사유를 입력해 주세요.`,
      );

      if (enteredReason === null) return;

      reason = enteredReason.trim();

      if (!reason) {
        setErrorMessage("반려 사유를 입력해 주세요.");
        return;
      }
    }

    setProcessingId(request.id);

    const { data, error } = await supabase.functions.invoke(
      "review-hospital-signup",
      {
        body: {
          requestId: request.id,
          action,
          reason,
        },
      },
    );

    if (error || !data?.ok) {
      setErrorMessage(
        await getFunctionErrorMessage(
          error,
          action === "approve"
            ? "병원 가입을 승인하지 못했습니다."
            : "병원 가입을 반려하지 못했습니다.",
        ),
      );
      setProcessingId(null);
      return;
    }

    setNoticeMessage(String(data.message));
    setProcessingId(null);
    await loadRequests();
  }

  return (
    <main className="min-h-screen bg-gray-50 px-5 py-8 text-black">
      <div className="mx-auto w-full max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-gray-500">
              PAWU 최고관리자
            </p>

            <h1 className="mt-2 text-3xl font-bold">
              병원 가입 승인
            </h1>

            <p className="mt-3 text-sm leading-6 text-gray-600">
              제출된 사업자등록증을 확인한 뒤 승인 또는
              반려해 주세요.
            </p>
          </div>

          <Link
            href="/"
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm"
          >
            PAWU 홈
          </Link>
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          {(
            [
              ["pending", "승인 대기"],
              ["approved", "승인 완료"],
              ["rejected", "반려"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatusFilter(value)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                statusFilter === value
                  ? "bg-black text-white"
                  : "border border-gray-300 bg-white text-gray-600"
              }`}
            >
              {label}
            </button>
          ))}

          <button
            type="button"
            onClick={() => void loadRequests()}
            disabled={isLoading}
            className="ml-auto rounded-full border border-gray-300 bg-white px-4 py-2 text-sm disabled:text-gray-400"
          >
            새로고침
          </button>
        </div>

        {noticeMessage && (
          <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm leading-6 text-green-700">
            {noticeMessage}
          </div>
        )}

        {errorMessage && (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
            {errorMessage}
          </div>
        )}

        {isLoading ? (
          <div className="mt-6 rounded-3xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
            병원 가입 신청을 불러오고 있습니다...
          </div>
        ) : visibleRequests.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
            해당 상태의 병원 가입 신청이 없습니다.
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            {visibleRequests.map((request) => (
              <article
                key={request.id}
                className="rounded-3xl border border-gray-200 bg-white p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-xl font-bold">
                        {request.hospital_name}
                      </h2>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          request.status === "pending"
                            ? "bg-amber-100 text-amber-700"
                            : request.status === "approved"
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                        }`}
                      >
                        {request.status === "pending"
                          ? "승인 대기"
                          : request.status === "approved"
                            ? "승인 완료"
                            : "반려"}
                      </span>
                    </div>

                    <p className="mt-2 text-sm text-gray-500">
                      신청일 {formatDate(request.created_at)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      void openLicense(
                        request.business_license_path,
                      )
                    }
                    className="rounded-2xl border border-gray-300 px-4 py-3 text-sm font-semibold"
                  >
                    사업자등록증 보기
                  </button>
                </div>

                <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl bg-gray-50 p-4">
                    <dt className="text-xs text-gray-400">
                      병원 주소
                    </dt>
                    <dd className="mt-1 text-sm font-medium">
                      {request.address}
                    </dd>
                  </div>

                  <div className="rounded-2xl bg-gray-50 p-4">
                    <dt className="text-xs text-gray-400">
                      병원 전화번호
                    </dt>
                    <dd className="mt-1 text-sm font-medium">
                      {request.phone}
                    </dd>
                  </div>

                  <div className="rounded-2xl bg-gray-50 p-4">
                    <dt className="text-xs text-gray-400">
                      관리자 휴대폰
                    </dt>
                    <dd className="mt-1 text-sm font-medium">
                      {request.manager_phone}
                    </dd>
                  </div>

                  <div className="rounded-2xl bg-gray-50 p-4">
                    <dt className="text-xs text-gray-400">
                      사업자등록번호
                    </dt>
                    <dd className="mt-1 text-sm font-medium">
                      {request.business_registration_number}
                    </dd>
                  </div>
                </dl>

                {request.status === "rejected" &&
                  request.rejection_reason && (
                    <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
                      <p className="text-xs font-semibold text-red-500">
                        반려 사유
                      </p>
                      <p className="mt-1 text-sm leading-6 text-red-700">
                        {request.rejection_reason}
                      </p>
                    </div>
                  )}

                {request.reviewed_at && (
                  <p className="mt-4 text-xs text-gray-400">
                    처리일 {formatDate(request.reviewed_at)}
                  </p>
                )}

                {request.status === "pending" && (
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() =>
                        void reviewRequest(
                          request,
                          "approve",
                        )
                      }
                      disabled={processingId === request.id}
                      className="rounded-2xl bg-black px-5 py-4 font-semibold text-white disabled:bg-gray-400"
                    >
                      {processingId === request.id
                        ? "처리 중..."
                        : "승인"}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        void reviewRequest(
                          request,
                          "reject",
                        )
                      }
                      disabled={processingId === request.id}
                      className="rounded-2xl border border-red-300 px-5 py-4 font-semibold text-red-600 disabled:text-gray-400"
                    >
                      반려
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
