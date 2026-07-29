"use client";

type IdentityVerificationPanelProps = {
  phone: string;
  onPhoneChange: (value: string) => void;
  otp: string;
  onOtpChange: (value: string) => void;
  otpSent: boolean;
  isLoading: boolean;
  onSendOtp: () => void;
  onVerifyOtp: () => void;
  requiredConsentsAccepted: boolean;
  label?: string;
};

export default function IdentityVerificationPanel({
  phone,
  onPhoneChange,
  otp,
  onOtpChange,
  otpSent,
  isLoading,
  onSendOtp,
  onVerifyOtp,
  requiredConsentsAccepted,
  label = "휴대폰 번호",
}: IdentityVerificationPanelProps) {
  async function startPassVerification() {
    if (!requiredConsentsAccepted) {
      window.alert("필수 약관에 먼저 동의해 주세요.");
      return;
    }

    const response = await fetch("/api/identity/pass/start", {
      method: "POST",
    });

    const result = (await response.json()) as {
      ok?: boolean;
      redirectUrl?: string;
      message?: string;
    };

    if (!response.ok || !result.redirectUrl) {
      window.alert(
        result.message ??
          "PASS 본인인증을 시작하지 못했습니다.",
      );
      return;
    }

    window.location.href = result.redirectUrl;
  }

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={startPassVerification}
          disabled={isLoading || !requiredConsentsAccepted}
          className="rounded-2xl bg-black px-5 py-4 text-sm font-bold text-white disabled:bg-gray-300"
        >
          PASS 앱으로 본인인증
        </button>

        <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs leading-5 text-gray-500">
          PASS 실서비스는 본인확인기관 계약과 환경변수 설정 후 활성화됩니다.
        </div>
      </div>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-gray-200" />
        <span className="text-xs font-medium text-gray-400">
          또는 문자 인증
        </span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      <label
        htmlFor="identity-phone"
        className="mb-2 block text-sm font-medium"
      >
        {label}
      </label>

      <div className="flex gap-2">
        <input
          id="identity-phone"
          value={phone}
          onChange={(event) => onPhoneChange(event.target.value)}
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          placeholder="010-1234-5678"
          disabled={isLoading}
          className="min-w-0 flex-1 rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-black disabled:bg-gray-100"
        />

        <button
          type="button"
          onClick={onSendOtp}
          disabled={isLoading || !requiredConsentsAccepted}
          className="shrink-0 rounded-2xl border border-black px-4 py-3 text-sm font-medium disabled:border-gray-300 disabled:text-gray-400"
        >
          {otpSent ? "재발송" : "인증번호 발송"}
        </button>
      </div>

      {otpSent && (
        <div className="mt-5">
          <label
            htmlFor="identity-otp"
            className="mb-2 block text-sm font-medium"
          >
            인증번호
          </label>

          <input
            id="identity-otp"
            value={otp}
            onChange={(event) => onOtpChange(event.target.value)}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="6자리 인증번호"
            disabled={isLoading}
            className="w-full rounded-2xl border border-gray-300 px-4 py-3 tracking-[0.35em] outline-none focus:border-black disabled:bg-gray-100"
          />

          <button
            type="button"
            onClick={onVerifyOtp}
            disabled={isLoading}
            className="mt-4 w-full rounded-2xl bg-black px-5 py-4 font-medium text-white disabled:bg-gray-400"
          >
            {isLoading ? "확인 중..." : "문자 인증 완료"}
          </button>
        </div>
      )}
    </div>
  );
}
