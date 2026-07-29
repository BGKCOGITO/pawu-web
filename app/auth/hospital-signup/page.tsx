"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useState } from "react";
import { supabase } from "../../../lib/supabase";

type Step = "phone" | "application" | "complete";

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

function normalizeUsername(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9._]/g, "").slice(0, 20);
}

function formatBusinessNumber(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

async function functionMessage(error: unknown, fallback: string) {
  const context = (error as { context?: Response })?.context;
  if (context) {
    try {
      const body = await context.json();
      return String(body?.message ?? fallback);
    } catch {}
  }
  return fallback;
}

export default function HospitalSignupPage() {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [requestId, setRequestId] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const [username, setUsername] = useState("");
  const [usernameChecked, setUsernameChecked] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  function resetMessages() {
    setMessage("");
    setErrorMessage("");
  }

  async function sendCode() {
    resetMessages();
    const normalized = normalizePhone(phone);

    if (!/^01[016789]\d{7,8}$/.test(normalized)) {
      setErrorMessage("올바른 관리자 휴대폰 번호를 입력해 주세요.");
      return;
    }

    setIsLoading(true);
    const { data, error } = await supabase.functions.invoke(
      "send-phone-verification",
      { body: { phone: normalized, purpose: "signup_hospital" } },
    );

    if (error || !data?.requestId) {
      setErrorMessage(
        await functionMessage(error, "인증번호를 발송하지 못했습니다."),
      );
      setIsLoading(false);
      return;
    }

    setRequestId(String(data.requestId));
    setCode("");
    setMessage("인증번호를 발송했습니다. 3분 안에 입력해 주세요.");
    setIsLoading(false);
  }

  async function verifyCode() {
    resetMessages();

    if (!requestId || !/^\d{6}$/.test(code)) {
      setErrorMessage("발송된 6자리 인증번호를 입력해 주세요.");
      return;
    }

    setIsLoading(true);
    const { data, error } = await supabase.functions.invoke(
      "verify-phone-verification",
      {
        body: {
          phone: normalizePhone(phone),
          purpose: "signup_hospital",
          requestId,
          code,
        },
      },
    );

    if (error || !data?.verificationToken) {
      setErrorMessage(
        await functionMessage(error, "인증번호를 확인하지 못했습니다."),
      );
      setIsLoading(false);
      return;
    }

    setVerificationToken(String(data.verificationToken));
    setStep("application");
    setIsLoading(false);
  }

  async function checkUsername() {
    resetMessages();

    if (!/^[a-z0-9._]{4,20}$/.test(username)) {
      setErrorMessage("아이디는 영문 소문자, 숫자, _, . 조합 4~20자로 입력해 주세요.");
      return;
    }

    setIsLoading(true);
    const { data, error } = await supabase.rpc(
      "is_username_available",
      { candidate: username },
    );

    if (error) {
      setErrorMessage("아이디 중복확인을 완료하지 못했습니다.");
    } else {
      setUsernameChecked(true);
      setUsernameAvailable(Boolean(data));
      setMessage(data ? "사용 가능한 아이디입니다." : "이미 사용 중인 아이디입니다.");
    }
    setIsLoading(false);
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    resetMessages();
    const file = event.target.files?.[0] ?? null;
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (!allowed.includes(file.type) || file.size > 10 * 1024 * 1024) {
      event.target.value = "";
      setSelectedFile(null);
      setErrorMessage("PDF, JPG, PNG, WEBP 파일을 10MB 이하로 첨부해 주세요.");
      return;
    }

    setSelectedFile(file);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetMessages();

    if (!verificationToken) {
      setErrorMessage("휴대폰 인증을 다시 진행해 주세요.");
      setStep("phone");
      return;
    }

    if (!usernameChecked || !usernameAvailable) {
      setErrorMessage("아이디 중복확인을 완료해 주세요.");
      return;
    }

    if (!selectedFile) {
      setErrorMessage("사업자등록증을 첨부해 주세요.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const hospitalName = String(formData.get("hospitalName") ?? "").trim();
    const address = String(formData.get("address") ?? "").trim();
    const hospitalPhone = String(formData.get("hospitalPhone") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const passwordConfirm = String(formData.get("passwordConfirm") ?? "");
    const businessNumber = String(formData.get("businessNumber") ?? "").replace(/\D/g, "");

    if (password.length < 6 || password !== passwordConfirm) {
      setErrorMessage(
        password.length < 6
          ? "비밀번호는 6자 이상이어야 합니다."
          : "비밀번호 확인이 일치하지 않습니다.",
      );
      return;
    }

    if (!/^\d{10}$/.test(businessNumber)) {
      setErrorMessage("사업자등록번호 10자리를 확인해 주세요.");
      return;
    }

    setIsLoading(true);

    const { data: registerData, error: registerError } =
      await supabase.functions.invoke("register-account", {
        body: {
          username,
          email,
          password,
          phone: normalizePhone(phone),
          verificationToken,
          accountType: "hospital",
        },
      });

    if (registerError || !registerData?.ok) {
      setErrorMessage(
        await functionMessage(registerError, "병원 관리자 계정을 만들지 못했습니다."),
      );
      setIsLoading(false);
      return;
    }

    const { data: loginData, error: loginError } =
      await supabase.auth.signInWithPassword({ email, password });

    if (loginError || !loginData.user) {
      setErrorMessage("계정은 생성됐지만 가입 신청을 이어가지 못했습니다. 로그인 후 다시 시도해 주세요.");
      setIsLoading(false);
      return;
    }

    const userId = loginData.user.id;
    const extension = selectedFile.name.split(".").pop()?.toLowerCase() ?? "file";
    const filePath = `${userId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("hospital-business-licenses")
      .upload(filePath, selectedFile, {
        contentType: selectedFile.type,
        upsert: false,
      });

    if (uploadError) {
      setErrorMessage("사업자등록증을 업로드하지 못했습니다.");
      setIsLoading(false);
      return;
    }

    const { error: requestError } = await supabase
      .from("hospital_signup_requests")
      .insert({
        user_id: userId,
        hospital_name: hospitalName,
        address,
        phone: hospitalPhone,
        manager_phone: normalizePhone(phone),
        business_registration_number: businessNumber,
        business_license_path: filePath,
        status: "pending",
      });

    if (requestError) {
      await supabase.storage
        .from("hospital-business-licenses")
        .remove([filePath]);

      setErrorMessage(
        requestError.code === "23505"
          ? "이미 신청된 계정 또는 사업자등록번호입니다."
          : "병원 가입 신청을 저장하지 못했습니다.",
      );
      setIsLoading(false);
      return;
    }

    await supabase.auth.signOut();
    setStep("complete");
    setIsLoading(false);
  }

  if (step === "complete") {
    return (
      <main className="min-h-screen bg-gray-50 px-5 py-8 text-black">
        <section className="mx-auto mt-20 w-full max-w-md rounded-3xl border border-gray-200 bg-white p-8 text-center">
          <div className="text-4xl">✓</div>
          <h1 className="mt-5 text-2xl font-bold">병원 가입 신청 완료</h1>
          <p className="mt-4 text-sm leading-7 text-gray-600">
            사업자등록증 확인과 관리자 승인 후 이용할 수 있습니다.
          </p>
          <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
            승인 또는 반려 결과는 인증한 휴대폰 번호로 문자 안내드립니다.
          </div>
          <Link href="/auth/login" className="mt-8 block rounded-2xl bg-black px-5 py-4 font-medium text-white">
            로그인 화면으로
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-5 py-8 text-black">
      <div className="mx-auto w-full max-w-xl">
        <Link href="/auth/login" className="inline-block rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm">
          ← 로그인으로
        </Link>

        <header className="mt-10">
          <p className="text-sm text-gray-500">PAWU 병원 관리자 계정</p>
          <h1 className="mt-2 text-3xl font-bold">병원 회원가입</h1>
        </header>

        <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
          사업자등록증 확인과 관리자 승인 후 이용할 수 있습니다.
          승인 또는 반려 결과는 인증한 관리자 휴대폰 번호로 문자 안내드립니다.
        </div>

        <section className="mt-5 rounded-3xl border border-gray-200 bg-white p-6">
          <p className="text-sm font-semibold">
            {step === "phone" ? "1. 관리자 휴대폰 인증" : "2. 병원 가입 신청"}
          </p>

          {step === "phone" ? (
            <div className="mt-6">
              <label className="mb-2 block text-sm font-medium">관리자 휴대폰 번호</label>
              <div className="flex gap-2">
                <input
                  value={phone}
                  onChange={(event) => {
                    setPhone(formatPhone(event.target.value));
                    setRequestId("");
                    setCode("");
                    resetMessages();
                  }}
                  type="tel"
                  inputMode="numeric"
                  placeholder="010-1234-5678"
                  className="min-w-0 flex-1 rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-black"
                />
                <button type="button" onClick={sendCode} disabled={isLoading} className="shrink-0 rounded-2xl border border-black px-4 py-3 text-sm font-medium">
                  {requestId ? "재발송" : "인증번호 발송"}
                </button>
              </div>

              {requestId && (
                <>
                  <input
                    value={code}
                    onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    placeholder="6자리 인증번호"
                    className="mt-5 w-full rounded-2xl border border-gray-300 px-4 py-3 tracking-[0.3em] outline-none focus:border-black"
                  />
                  <button type="button" onClick={verifyCode} disabled={isLoading} className="mt-4 w-full rounded-2xl bg-black px-5 py-4 font-medium text-white">
                    인증번호 확인
                  </button>
                </>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6">
              <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
                관리자 휴대폰 인증 완료: {phone}
              </div>

              <label className="mt-5 mb-2 block text-sm font-medium">아이디</label>
              <div className="flex gap-2">
                <input
                  value={username}
                  onChange={(event) => {
                    setUsername(normalizeUsername(event.target.value));
                    setUsernameChecked(false);
                    setUsernameAvailable(false);
                    resetMessages();
                  }}
                  placeholder="영문 소문자·숫자 4~20자"
                  className="min-w-0 flex-1 rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-black"
                />
                <button type="button" onClick={checkUsername} className="shrink-0 rounded-2xl border border-black px-4 py-3 text-sm font-medium">
                  중복확인
                </button>
              </div>

              {[
                ["hospitalName", "병원명", "PAWU 동물병원", "text"],
                ["address", "주소", "병원 주소", "text"],
                ["hospitalPhone", "병원 전화번호", "02-1234-5678", "tel"],
                ["email", "관리자 이메일", "비밀번호 찾기용 이메일", "email"],
              ].map(([name, label, placeholder, type]) => (
                <div key={name} className="mt-5">
                  <label className="mb-2 block text-sm font-medium">{label}</label>
                  <input name={name} type={type} required placeholder={placeholder} className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-black" />
                </div>
              ))}

              <label className="mt-5 mb-2 block text-sm font-medium">비밀번호</label>
              <input name="password" type="password" required minLength={6} placeholder="6자 이상" className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-black" />

              <label className="mt-5 mb-2 block text-sm font-medium">비밀번호 확인</label>
              <input name="passwordConfirm" type="password" required minLength={6} placeholder="비밀번호 다시 입력" className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-black" />

              <label className="mt-5 mb-2 block text-sm font-medium">사업자등록번호</label>
              <input
                name="businessNumber"
                required
                inputMode="numeric"
                placeholder="123-45-67890"
                onChange={(event) => {
                  event.currentTarget.value = formatBusinessNumber(event.currentTarget.value);
                }}
                className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-black"
              />

              <label className="mt-5 mb-2 block text-sm font-medium">사업자등록증 첨부</label>
              <input
                type="file"
                required
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={handleFile}
                className="block w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm"
              />

              <button type="submit" disabled={isLoading} className="mt-6 w-full rounded-2xl bg-black px-5 py-4 font-medium text-white disabled:bg-gray-400">
                {isLoading ? "신청 중..." : "병원 가입 신청"}
              </button>
            </form>
          )}

          {message && (
            <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">{message}</div>
          )}
          {errorMessage && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{errorMessage}</div>
          )}
        </section>

        <p className="mt-6 text-center text-sm text-gray-500">
          개인회원인가요?{" "}
          <Link href="/auth/signup" className="font-semibold text-black underline">
            개인회원 가입
          </Link>
        </p>
      </div>
    </main>
  );
}
