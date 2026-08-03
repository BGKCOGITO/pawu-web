"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { MyHospitalSummary } from "@/lib/v7-0-2-my-hospital-types";

const CACHE_TTL_MS = 60_000;

export default function MyHospitalHomeCard() {
  const [items, setItems] = useState<MyHospitalSummary[]>([]);
  const [ready, setReady] = useState(false);
  const requestInFlightRef = useRef(false);

  useEffect(() => {
    let active = true;

    async function load(force = false) {
      if (requestInFlightRef.current) return;
      requestInFlightRef.current = true;

      try {
        const { data } = await supabase.auth.getSession();
        const user = data.session?.user;
        if (!user) {
          if (active) setReady(true);
          return;
        }

        const cacheKey = `pawu-my-hospitals-home-v980:${user.id}`;
        if (!force) {
          try {
            const cached = JSON.parse(sessionStorage.getItem(cacheKey) || "null") as
              | { savedAt: number; items: MyHospitalSummary[] }
              | null;
            if (cached && Date.now() - cached.savedAt < CACHE_TTL_MS) {
              if (active) {
                setItems(cached.items);
                setReady(true);
              }
              return;
            }
          } catch {
            sessionStorage.removeItem(cacheKey);
          }
        }

        const { data: rows, error } = await supabase
          .from("guardian_pet_hospitals")
          .select("id,pet_id,hospital_id,is_primary,pets!inner(name),hospitals!inner(name,address,phone,reservation_enabled,latitude,longitude)")
          .eq("user_id", user.id)
          .order("is_primary", { ascending: false })
          .order("updated_at", { ascending: false })
          .limit(3);

        if (!active) return;
        if (!error) {
          const nextItems = (rows ?? []).map((row: any) => ({
            relationId: Number(row.id),
            petId: Number(row.pet_id),
            petName: String(row.pets?.name ?? "반려동물"),
            hospitalId: Number(row.hospital_id),
            hospitalName: String(row.hospitals?.name ?? "동물병원"),
            address: String(row.hospitals?.address ?? ""),
            phone: row.hospitals?.phone ?? null,
            reservationEnabled: Boolean(row.hospitals?.reservation_enabled),
            latitude: row.hospitals?.latitude ?? null,
            longitude: row.hospitals?.longitude ?? null,
            isPrimary: Boolean(row.is_primary),
          }));
          setItems(nextItems);
          try {
            sessionStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), items: nextItems }));
          } catch {
            // 캐시 저장에 실패해도 화면 표시는 계속합니다.
          }
        }
        setReady(true);
      } finally {
        requestInFlightRef.current = false;
      }
    }

    void load();

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void load(false);
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      active = false;
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  if (!ready || items.length === 0) return null;

  return (
    <section className="home-section">
      <div className="section-heading">
        <div><span>FAVORITE HOSPITAL</span><h2>자주 가는 병원</h2></div>
        <Link href="/my-hospitals">전체 관리 ↗</Link>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {items.map((item) => (
          <article key={item.relationId} className="rounded-[26px] border border-[#dfe5e1] bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-black tracking-[0.12em] text-[#ff725e]">{item.petName}의 병원</p>
                <h3 className="mt-2 truncate text-xl font-black tracking-[-0.025em] text-[#173f37]">{item.hospitalName}</h3>
              </div>
              <span className="text-lg text-[#ff725e]">★</span>
            </div>
            <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-[#71817c]">{item.address || "주소 정보 없음"}</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Link href={item.reservationEnabled ? `/hospital/${item.hospitalId}/reserve?petId=${item.petId}` : `/hospital/${item.hospitalId}`} className="rounded-xl bg-[#173f37] px-3 py-3 text-center text-sm font-black text-white">{item.reservationEnabled ? "예약하기" : "병원 보기"}</Link>
              {item.phone ? <a href={`tel:${item.phone}`} className="rounded-xl border border-[#d8e1dd] px-3 py-3 text-center text-sm font-black text-[#24473f]">전화하기</a> : <Link href={`/hospital/${item.hospitalId}`} className="rounded-xl border border-[#d8e1dd] px-3 py-3 text-center text-sm font-black text-[#24473f]">상세보기</Link>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
