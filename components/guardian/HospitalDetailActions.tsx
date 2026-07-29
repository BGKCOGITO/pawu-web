"use client";

import { useEffect, useState } from "react";

type Props = {
  name: string;
  address: string;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
};

export default function HospitalDetailActions({
  name,
  address,
  phone,
  latitude,
  longitude,
}: Props) {
  const [navigationOpen, setNavigationOpen] = useState(false);
  const hasCoordinates =
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude !== 0 &&
    longitude !== 0;

  useEffect(() => {
    if (!navigationOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setNavigationOpen(false);
      }
    }

    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [navigationOpen]);

  const encodedName = encodeURIComponent(name);
  const encodedAddress = encodeURIComponent(address || name);
  const naverSearch = `https://map.naver.com/p/search/${encodedName}%20${encodedAddress}`;
  const navigationLinks = hasCoordinates
    ? [
        {
          label: "네이버 지도",
          description: "네이버 지도에서 자동차 길찾기",
          href: `https://map.naver.com/p/directions/-/-/${longitude},${latitude},${encodedName}/-/car`,
        },
        {
          label: "카카오맵",
          description: "카카오맵에서 목적지 열기",
          href: `https://map.kakao.com/link/to/${encodedName},${latitude},${longitude}`,
        },
        {
          label: "티맵",
          description: "티맵 앱에서 길안내 시작",
          href: `tmap://route?goalname=${encodedName}&goalx=${longitude}&goaly=${latitude}`,
        },
      ]
    : [
        {
          label: "네이버 지도",
          description: "병원명과 주소로 검색",
          href: naverSearch,
        },
      ];

  async function shareHospital() {
    const shareData = {
      title: name,
      text: `${name}\n${address}`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      await navigator.clipboard.writeText(window.location.href);
      window.alert("병원 링크를 복사했습니다.");
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        window.alert("공유할 수 없습니다. 잠시 후 다시 시도해 주세요.");
      }
    }
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
        {phone ? (
          <a
            href={`tel:${phone}`}
            className="flex min-h-14 items-center justify-center rounded-2xl border border-[#dce5e0] bg-white px-4 text-sm font-black text-[#173d35] transition active:scale-[0.98]"
          >
            전화
          </a>
        ) : (
          <button
            type="button"
            disabled
            className="min-h-14 rounded-2xl bg-neutral-100 px-4 text-sm font-bold text-neutral-400"
          >
            전화 없음
          </button>
        )}

        <button
          type="button"
          onClick={() => setNavigationOpen(true)}
          className="min-h-14 rounded-2xl border border-[#dce5e0] bg-white px-4 text-sm font-black text-[#173d35] transition active:scale-[0.98]"
          aria-haspopup="dialog"
          aria-expanded={navigationOpen}
        >
          길찾기
        </button>

        <button
          type="button"
          onClick={shareHospital}
          className="min-h-14 rounded-2xl border border-[#dce5e0] bg-white px-4 text-sm font-black text-[#173d35] transition active:scale-[0.98]"
        >
          공유
        </button>
      </div>

      {navigationOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) {
              setNavigationOpen(false);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="navigation-title"
            className="w-full rounded-t-[28px] bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-[28px]"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black tracking-[0.16em] text-[#ff6f61]">
                  NAVIGATION
                </p>
                <h2
                  id="navigation-title"
                  className="mt-1 text-xl font-black text-[#123b32]"
                >
                  길찾기 앱 선택
                </h2>
                <p className="mt-1 line-clamp-2 text-sm text-[#71817c]">
                  {name}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setNavigationOpen(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#eef4f1] text-lg font-black text-[#173d35]"
                aria-label="길찾기 선택 닫기"
              >
                ×
              </button>
            </div>

            <div className="space-y-2">
              {navigationLinks.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setNavigationOpen(false)}
                  className="flex min-h-[68px] items-center justify-between rounded-2xl border border-[#dfe8e4] bg-white px-4 py-3 transition hover:bg-[#f3f7f5] active:scale-[0.99]"
                >
                  <span>
                    <span className="block text-base font-black text-[#173d35]">
                      {item.label}
                    </span>
                    <span className="mt-0.5 block text-xs font-medium text-[#7a8984]">
                      {item.description}
                    </span>
                  </span>
                  <span className="text-lg font-black text-[#ff6f61]">→</span>
                </a>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setNavigationOpen(false)}
              className="mt-4 min-h-12 w-full rounded-2xl bg-[#173d35] px-4 text-sm font-black text-white"
            >
              취소
            </button>
          </section>
        </div>
      )}
    </>
  );
}
