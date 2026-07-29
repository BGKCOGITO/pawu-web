"use client";

import { useMemo, useState } from "react";

export type ConsentState = {
  terms: boolean;
  privacy: boolean;
  identity: boolean;
  age14: boolean;
  marketing: boolean;
};

type ConsentChecklistProps = {
  value: ConsentState;
  onChange: (next: ConsentState) => void;
  disabled?: boolean;
  hospitalMode?: boolean;
};

type PolicyKey =
  | "terms"
  | "privacy"
  | "identity"
  | "age14"
  | "marketing"
  | "hospital";

const policyText: Record<PolicyKey, { title: string; body: string }> = {
  terms: {
    title: "PAWU 이용약관",
    body:
      "PAWU 서비스 이용에 필요한 기본 권리와 의무, 계정 관리, 서비스 이용 제한, 책임 범위 등을 안내합니다. 실제 서비스 공개 전 법률 검토를 거친 최종 약관 문구로 교체하세요.",
  },
  privacy: {
    title: "개인정보 수집·이용 동의",
    body:
      "수집 항목: 이메일, 휴대폰 번호, 계정 유형 및 서비스 이용기록. 이용 목적: 회원 식별, 계정 관리, 예약 및 고객지원. 보유 기간: 회원 탈퇴 시까지 또는 관계 법령에 따른 기간. 동의를 거부할 수 있으나 필수 정보 동의 거부 시 회원가입이 제한됩니다.",
  },
  identity: {
    title: "본인확인 서비스 이용 동의",
    body:
      "휴대폰 번호의 사용 가능 여부 또는 본인확인기관을 통한 명의자 확인을 위해 인증정보를 처리합니다. 실제 PASS 본인확인 연동 시 인증기관이 제공하는 동의문과 개인정보 처리 내용을 반드시 반영해야 합니다.",
  },
  age14: {
    title: "만 14세 이상 확인",
    body:
      "PAWU 일반 회원가입은 만 14세 이상을 대상으로 합니다. 만 14세 미만 회원의 가입을 지원하려면 법정대리인 동의 절차를 별도로 구축해야 합니다.",
  },
  marketing: {
    title: "마케팅 정보 수신 동의",
    body:
      "이벤트, 서비스 안내 및 혜택 정보를 이메일, 문자 또는 앱 알림으로 받을 수 있습니다. 선택 동의이며 동의하지 않아도 서비스 이용에는 제한이 없습니다.",
  },
  hospital: {
    title: "병원 관리자 심사 및 정보 확인 동의",
    body:
      "제출한 병원 정보와 사업자등록증을 PAWU 관리자가 가입 심사와 병원 운영권한 확인 목적으로 검토하는 것에 동의합니다.",
  },
};

export default function ConsentChecklist({
  value,
  onChange,
  disabled = false,
  hospitalMode = false,
}: ConsentChecklistProps) {
  const [openPolicy, setOpenPolicy] = useState<PolicyKey | null>(null);

  const allChecked = useMemo(
    () =>
      value.terms &&
      value.privacy &&
      value.identity &&
      value.age14 &&
      value.marketing,
    [value],
  );

  function setOne(key: keyof ConsentState, checked: boolean) {
    onChange({
      ...value,
      [key]: checked,
    });
  }

  function setAll(checked: boolean) {
    onChange({
      terms: checked,
      privacy: checked,
      identity: checked,
      age14: checked,
      marketing: checked,
    });
  }

  const items: Array<{
    key: keyof ConsentState;
    label: string;
    required: boolean;
    policyKey: PolicyKey;
  }> = [
    {
      key: "terms",
      label: "PAWU 이용약관 동의",
      required: true,
      policyKey: "terms",
    },
    {
      key: "privacy",
      label: "개인정보 수집·이용 동의",
      required: true,
      policyKey: "privacy",
    },
    {
      key: "identity",
      label: "본인확인 서비스 이용 동의",
      required: true,
      policyKey: "identity",
    },
    {
      key: "age14",
      label: "만 14세 이상입니다",
      required: true,
      policyKey: "age14",
    },
    {
      key: "marketing",
      label: "마케팅 정보 수신 동의",
      required: false,
      policyKey: "marketing",
    },
  ];

  return (
    <section className="rounded-3xl border border-gray-200 bg-white p-5">
      <div className="flex items-start gap-3 border-b border-gray-100 pb-4">
        <input
          id="consent-all"
          type="checkbox"
          checked={allChecked}
          disabled={disabled}
          onChange={(event) => setAll(event.target.checked)}
          className="mt-1 h-5 w-5 rounded border-gray-300"
        />

        <label htmlFor="consent-all" className="cursor-pointer">
          <span className="block text-sm font-bold">
            약관 전체 동의
          </span>
          <span className="mt-1 block text-xs leading-5 text-gray-500">
            선택 동의를 포함해 모두 동의합니다.
          </span>
        </label>
      </div>

      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div
            key={item.key}
            className="flex items-center justify-between gap-3"
          >
            <label className="flex min-w-0 items-center gap-3">
              <input
                type="checkbox"
                checked={value[item.key]}
                disabled={disabled}
                onChange={(event) =>
                  setOne(item.key, event.target.checked)
                }
                className="h-4 w-4 rounded border-gray-300"
              />

              <span className="text-sm text-gray-700">
                <strong
                  className={
                    item.required
                      ? "font-semibold text-black"
                      : "font-medium text-gray-500"
                  }
                >
                  [{item.required ? "필수" : "선택"}]
                </strong>{" "}
                {item.label}
              </span>
            </label>

            <button
              type="button"
              onClick={() => setOpenPolicy(item.policyKey)}
              className="shrink-0 text-xs font-medium text-gray-500 underline"
            >
              보기
            </button>
          </div>
        ))}

        {hospitalMode && (
          <div className="rounded-2xl bg-gray-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-gray-700">
                병원 관리자 심사 및 정보 확인 안내
              </p>
              <button
                type="button"
                onClick={() => setOpenPolicy("hospital")}
                className="text-xs font-medium text-gray-500 underline"
              >
                보기
              </button>
            </div>
          </div>
        )}
      </div>

      {openPolicy && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-5"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-lg font-bold">
                {policyText[openPolicy].title}
              </h2>
              <button
                type="button"
                onClick={() => setOpenPolicy(null)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>

            <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-gray-600">
              {policyText[openPolicy].body}
            </p>

            <button
              type="button"
              onClick={() => setOpenPolicy(null)}
              className="mt-6 w-full rounded-2xl bg-black px-5 py-3 font-semibold text-white"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
