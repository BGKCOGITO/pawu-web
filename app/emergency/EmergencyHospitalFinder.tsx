"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Hospital = {
  id: number;
  name: string;
  address: string;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  night_care_available: boolean | null;
  emergency_care_available: boolean | null;
  business_status: string | null;
  detailed_business_status: string | null;
  is_active: boolean;
  source_type: "public_data" | "pawu_partner";
};

type CurrentLocation = {
  latitude: number;
  longitude: number;
};

type FilterMode = "all" | "emergency" | "night";

const SELECT_COLUMNS =
  "id,name,address,phone,latitude,longitude,night_care_available,emergency_care_available,business_status,detailed_business_status,is_active,source_type";

function distanceKm(from: CurrentLocation, hospital: Hospital) {
  if (hospital.latitude == null || hospital.longitude == null) return null;
  const rad = (value: number) => (value * Math.PI) / 180;
  const dLat = rad(hospital.latitude - from.latitude);
  const dLon = rad(hospital.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(from.latitude)) *
      Math.cos(rad(hospital.latitude)) *
      Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function navigationUrl(hospital: Hospital) {
  const name = encodeURIComponent(hospital.name);
  const address = encodeURIComponent(hospital.address || hospital.name);
  if (hospital.latitude != null && hospital.longitude != null) {
    return `https://map.naver.com/p/directions/-/-/${hospital.longitude},${hospital.latitude},${name}/-/car`;
  }
  return `https://map.naver.com/p/search/${name}%20${address}`;
}

function availabilityText(hospital: Hospital) {
  if (hospital.emergency_care_available && hospital.night_care_available) {
    return "응급 · 야간 진료 정보 등록";
  }
  if (hospital.emergency_care_available) return "응급 진료 정보 등록";
  return "야간 진료 정보 등록";
}

export default function EmergencyHospitalFinder() {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [location, setLocation] = useState<CurrentLocation | null>(null);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(
    "현재 위치를 허용하면 가까운 병원부터 보여드려요.",
  );

  useEffect(() => {
    let mounted = true;

    async function loadHospitals() {
      const { data, error } = await supabase
        .from("hospitals")
        .select(SELECT_COLUMNS)
        .eq("is_active", true)
        .or("emergency_care_available.eq.true,night_care_available.eq.true")
        .limit(12000);

      if (!mounted) return;

      if (error) {
        setMessage("병원 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
      } else {
        setHospitals((data ?? []) as Hospital[]);
      }
      setLoading(false);
    }

    void loadHospitals();

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (!mounted) return;
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          setMessage("현재 위치에서 가까운 순서로 정렬했어요.");
        },
        () => {
          if (!mounted) return;
          setMessage("위치 권한이 없어 병원명 순으로 보여드려요.");
        },
        { enableHighAccuracy: false, timeout: 6000, maximumAge: 300000 },
      );
    }

    return () => {
      mounted = false;
    };
  }, []);

  const visibleHospitals = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const rows = hospitals.filter((hospital) => {
      if (
        keyword &&
        !`${hospital.name} ${hospital.address}`.toLowerCase().includes(keyword)
      ) {
        return false;
      }
      if (filter === "emergency" && !hospital.emergency_care_available) {
        return false;
      }
      if (filter === "night" && !hospital.night_care_available) return false;
      return true;
    });

    return [...rows].sort((a, b) => {
      if (location) {
        const distanceA = distanceKm(location, a);
        const distanceB = distanceKm(location, b);
        if (distanceA != null && distanceB != null) return distanceA - distanceB;
        if (distanceA != null) return -1;
        if (distanceB != null) return 1;
      }
      return a.name.localeCompare(b.name, "ko");
    });
  }, [filter, hospitals, location, query]);

  function findMyLocation() {
    if (!navigator.geolocation) {
      setMessage("현재 위치 기능을 사용할 수 없습니다.");
      return;
    }

    setMessage("현재 위치를 확인하고 있어요.");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setMessage("현재 위치에서 가까운 순서로 정렬했어요.");
      },
      () => setMessage("브라우저에서 위치 권한을 허용해 주세요."),
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 300000 },
    );
  }

  return (
    <main className="min-h-[calc(100dvh-74px)] bg-[#f7f5ef] pb-24 text-[#173d35]">
      <header className="sticky top-0 z-40 border-b border-[#eadfd8] bg-[#fffaf5]/95 px-4 pb-4 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur-xl">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f0ebe4] text-2xl font-black"
              aria-label="홈으로 돌아가기"
            >
              ‹
            </Link>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black tracking-[.18em] text-[#f06453]">
                PAWU EMERGENCY
              </p>
              <h1 className="text-xl font-black">응급·야간 병원 찾기</h1>
            </div>
            <button
              type="button"
              onClick={findMyLocation}
              className="rounded-2xl bg-[#173d35] px-4 py-3 text-xs font-black text-white"
            >
              ◎ 내 위치
            </button>
          </div>

          <div className="mt-4 rounded-2xl border border-[#ffc8bd] bg-[#fff0ec] p-4">
            <strong className="text-sm font-black text-[#b54132]">
              방문 전 반드시 전화로 진료 가능 여부를 확인해 주세요.
            </strong>
            <p className="mt-1 text-xs leading-5 text-[#8b5f57]">
              PAWU의 응급·야간 표시는 병원이 등록한 정보이며, 현재 운영 여부와
              실시간 접수 가능 상태를 보장하지 않습니다.
            </p>
          </div>

          <div className="mt-3 flex items-center rounded-2xl border border-[#e2ddd1] bg-white px-3">
            <span className="text-lg">⌕</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="병원명 또는 지역 검색"
              className="h-12 min-w-0 flex-1 bg-transparent px-3 text-sm font-bold outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="text-xs font-black text-[#78827d]"
              >
                지우기
              </button>
            )}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {([
              ["all", "전체"],
              ["emergency", "응급 진료"],
              ["night", "야간 진료"],
            ] as const).map(([value, label]) => (
              <button
                type="button"
                key={value}
                onClick={() => setFilter(value)}
                className={
                  filter === value
                    ? "rounded-xl bg-[#f06453] px-3 py-3 text-xs font-black text-white"
                    : "rounded-xl bg-white px-3 py-3 text-xs font-black shadow-sm"
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-4 py-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-[#77827d]">{message}</p>
            <h2 className="mt-1 text-lg font-black">
              {loading ? "병원을 찾고 있어요" : `${visibleHospitals.length}곳`}
            </h2>
          </div>
          <Link href="/map" className="text-xs font-black text-[#f06453]">
            전체 병원 보기 →
          </Link>
        </div>

        {!loading && visibleHospitals.length === 0 && (
          <div className="mt-5 rounded-[26px] bg-white p-7 text-center shadow-sm">
            <strong className="text-base font-black">검색 결과가 없습니다.</strong>
            <p className="mt-2 text-sm leading-6 text-[#77827d]">
              지역명이나 병원명을 바꿔 다시 검색해 주세요.
            </p>
          </div>
        )}

        <div className="mt-4 space-y-3">
          {visibleHospitals.map((hospital) => {
            const distance = location ? distanceKm(location, hospital) : null;
            const status =
              hospital.detailed_business_status || hospital.business_status;

            return (
              <article
                key={hospital.id}
                className="rounded-[26px] border border-[#ebe4d9] bg-white p-5 shadow-[0_10px_30px_rgba(33,62,54,.06)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-[#fff0ec] px-2.5 py-1 text-[10px] font-black text-[#c84d3d]">
                        {availabilityText(hospital)}
                      </span>
                      {hospital.source_type === "pawu_partner" && (
                        <span className="rounded-full bg-[#e7f3ed] px-2.5 py-1 text-[10px] font-black text-[#28715e]">
                          PAWU 병원
                        </span>
                      )}
                    </div>
                    <h3 className="mt-3 truncate text-lg font-black">
                      {hospital.name}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#77827d]">
                      {hospital.address}
                    </p>
                    {status && (
                      <p className="mt-2 text-[11px] font-bold text-[#8a938e]">
                        공공데이터 상태: {status}
                      </p>
                    )}
                  </div>
                  {distance != null && (
                    <strong className="shrink-0 text-sm text-[#f06453]">
                      {distance.toFixed(1)}km
                    </strong>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  {hospital.phone ? (
                    <a
                      href={`tel:${hospital.phone}`}
                      className="rounded-xl bg-[#f06453] px-2 py-3 text-center text-xs font-black text-white"
                    >
                      지금 전화
                    </a>
                  ) : (
                    <span className="rounded-xl bg-[#efede8] px-2 py-3 text-center text-xs font-bold text-[#aaa]">
                      전화 없음
                    </span>
                  )}
                  <a
                    href={navigationUrl(hospital)}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl bg-[#edf2ef] px-2 py-3 text-center text-xs font-black"
                  >
                    길찾기
                  </a>
                  <Link
                    href={`/hospital/${hospital.id}`}
                    className="rounded-xl bg-[#173d35] px-2 py-3 text-center text-xs font-black text-white"
                  >
                    상세
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
