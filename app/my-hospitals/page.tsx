"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { MyHospitalSummary } from "@/lib/v7-0-2-my-hospital-types";

export default function MyHospitalsPage() {
  const [items, setItems] = useState<MyHospitalSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setMessage("로그인이 필요합니다."); setLoading(false); return; }

    const { data, error } = await supabase
      .from("guardian_pet_hospitals")
      .select("id,pet_id,hospital_id,is_primary,pets!inner(name),hospitals!inner(name,address,phone,reservation_enabled,latitude,longitude)")
      .eq("user_id", user.id)
      .order("is_primary", { ascending: false })
      .order("updated_at", { ascending: false });

    if (error) setMessage(error.message);
    else setItems((data ?? []).map((row: any) => ({
      relationId: Number(row.id), petId: Number(row.pet_id), petName: String(row.pets?.name ?? "반려동물"),
      hospitalId: Number(row.hospital_id), hospitalName: String(row.hospitals?.name ?? "동물병원"),
      address: String(row.hospitals?.address ?? ""), phone: row.hospitals?.phone ?? null,
      reservationEnabled: Boolean(row.hospitals?.reservation_enabled), latitude: row.hospitals?.latitude ?? null,
      longitude: row.hospitals?.longitude ?? null, isPrimary: Boolean(row.is_primary),
    })));
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function remove(item: MyHospitalSummary) {
    if (!window.confirm(`${item.petName}의 즐겨찾기에서 ${item.hospitalName}을(를) 삭제할까요?`)) return;
    const { error } = await supabase.from("guardian_pet_hospitals").delete().eq("id", item.relationId);
    if (error) window.alert(error.message);
    else setItems((current) => current.filter((row) => row.relationId !== item.relationId));
  }

  return (
    <main className="min-h-screen bg-[#f5f4ee] px-4 py-5 text-[#143b34] sm:px-7 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between gap-3">
          <Link href="/" className="rounded-full border border-[#d8e1dd] bg-white px-4 py-2.5 text-sm font-black shadow-sm">← 홈으로</Link>
          <Link href="/map" className="rounded-full bg-[#173f37] px-4 py-2.5 text-sm font-black text-white shadow-sm">병원 찾기</Link>
        </header>

        <section className="mt-7 rounded-[30px] border border-[#dfe5e1] bg-white p-6 shadow-[0_18px_60px_rgba(20,59,52,0.08)] sm:p-9">
          <p className="text-xs font-black tracking-[0.2em] text-[#ff725e]">FAVORITE HOSPITAL</p>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] sm:text-4xl">즐겨찾는 병원</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#61756f] sm:text-base">아이별로 자주 가는 병원을 저장하고 예약·전화·길찾기를 빠르게 이용하세요.</p>
        </section>

        {message && <p className="mt-5 rounded-2xl border border-[#ffc9c0] bg-[#fff1ee] p-4 text-sm font-semibold text-[#a84435]">{message}</p>}

        {loading ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2"><div className="h-60 animate-pulse rounded-[28px] bg-white" /><div className="h-60 animate-pulse rounded-[28px] bg-white" /></div>
        ) : items.length === 0 ? (
          <section className="mt-6 rounded-[28px] border border-dashed border-[#cbd8d2] bg-white p-10 text-center sm:p-14">
            <div className="text-3xl text-[#ff725e]">☆</div>
            <h2 className="mt-4 text-xl font-black">저장한 병원이 없습니다.</h2>
            <p className="mt-2 text-sm leading-6 text-[#71817c]">병원 상세 화면에서 즐겨찾기를 누르고 함께 다니는 아이를 선택해 주세요.</p>
            <Link href="/map" className="mt-6 inline-flex rounded-2xl bg-[#173f37] px-5 py-3.5 text-sm font-black text-white">병원 찾아보기</Link>
          </section>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {items.map((item) => (
              <article key={item.relationId} className="rounded-[28px] border border-[#dfe5e1] bg-white p-5 shadow-sm sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-black tracking-[0.12em] text-[#ff725e]">{item.petName}의 병원</p>
                    <h2 className="mt-2 truncate text-2xl font-black tracking-[-0.03em]">{item.hospitalName}</h2>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#71817c]">{item.address || "주소 정보 없음"}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[#fff1ee] px-3 py-1.5 text-xs font-black text-[#d95845]">★ 저장됨</span>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-2">
                  <Link href={item.reservationEnabled ? `/hospital/${item.hospitalId}/reserve?petId=${item.petId}` : `/hospital/${item.hospitalId}`} className="rounded-xl bg-[#173f37] px-3 py-3.5 text-center text-sm font-black text-white">{item.reservationEnabled ? "예약하기" : "병원 보기"}</Link>
                  {item.phone ? <a href={`tel:${item.phone}`} className="rounded-xl border border-[#d8e1dd] px-3 py-3.5 text-center text-sm font-black">전화하기</a> : <span className="rounded-xl bg-[#f1f4f2] px-3 py-3.5 text-center text-sm font-semibold text-[#91a09b]">전화 정보 없음</span>}
                  <a href={`https://map.naver.com/p/search/${encodeURIComponent(`${item.hospitalName} ${item.address}`)}`} target="_blank" rel="noreferrer" className="rounded-xl border border-[#d8e1dd] px-3 py-3.5 text-center text-sm font-black">길찾기</a>
                  <Link href={`/hospital/${item.hospitalId}`} className="rounded-xl border border-[#d8e1dd] px-3 py-3.5 text-center text-sm font-black">상세보기</Link>
                </div>

                <button type="button" onClick={() => remove(item)} className="mt-3 w-full rounded-xl px-3 py-2.5 text-sm font-bold text-[#a85a4d] hover:bg-[#fff5f2]">즐겨찾기 삭제</button>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
