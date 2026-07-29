"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { MyHospitalPet } from "@/lib/v7-0-2-my-hospital-types";

type Props = {
  hospitalId: number;
  hospitalName: string;
  compact?: boolean;
};

type Mode = "idle" | "loading" | "saving";

export default function MyHospitalButton({ hospitalId, hospitalName, compact = false }: Props) {
  const [open, setOpen] = useState(false);
  const [pets, setPets] = useState<MyHospitalPet[]>([]);
  const [selectedPetIds, setSelectedPetIds] = useState<number[]>([]);
  const [savedPetIds, setSavedPetIds] = useState<number[]>([]);
  const [mode, setMode] = useState<Mode>("loading");
  const [message, setMessage] = useState("");
  const isFavorite = savedPetIds.length > 0;

  const hasChanges = useMemo(() => {
    const selected = [...selectedPetIds].sort((a, b) => a - b).join(",");
    const saved = [...savedPetIds].sort((a, b) => a - b).join(",");
    return selected !== saved;
  }, [savedPetIds, selectedPetIds]);

  useEffect(() => {
    let active = true;

    async function loadStatus() {
      setMode("loading");
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) {
        setMode("idle");
        return;
      }

      const { data } = await supabase
        .from("guardian_pet_hospitals")
        .select("pet_id")
        .eq("user_id", user.id)
        .eq("hospital_id", hospitalId);

      if (!active) return;
      const ids = (data ?? []).map((row: { pet_id: number }) => Number(row.pet_id));
      setSavedPetIds(ids);
      setSelectedPetIds(ids);
      setMode("idle");
    }

    void loadStatus();
    return () => { active = false; };
  }, [hospitalId]);

  useEffect(() => {
    if (!open) return;
    let active = true;

    async function loadPets() {
      setMode("loading");
      setMessage("");
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) {
        setMessage("즐겨찾는 병원은 로그인 후 사용할 수 있습니다.");
        setMode("idle");
        return;
      }

      const [{ data: petRows, error: petError }, { data: relationRows, error: relationError }] = await Promise.all([
        supabase.from("pets").select("id,name,species").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("guardian_pet_hospitals").select("pet_id").eq("user_id", user.id).eq("hospital_id", hospitalId),
      ]);

      if (!active) return;
      if (petError || relationError) {
        setMessage(petError?.message ?? relationError?.message ?? "정보를 불러오지 못했습니다.");
      }

      const ids = (relationRows ?? []).map((row: { pet_id: number }) => Number(row.pet_id));
      setPets((petRows ?? []) as MyHospitalPet[]);
      setSavedPetIds(ids);
      setSelectedPetIds(ids);
      setMode("idle");
    }

    void loadPets();
    return () => { active = false; };
  }, [hospitalId, open]);

  function togglePet(id: number) {
    setSelectedPetIds((current) => current.includes(id) ? current.filter((petId) => petId !== id) : [...current, id]);
  }

  async function save() {
    setMode("saving");
    setMessage("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setMessage("로그인이 필요합니다.");
      setMode("idle");
      return;
    }

    const addIds = selectedPetIds.filter((id) => !savedPetIds.includes(id));
    const removeIds = savedPetIds.filter((id) => !selectedPetIds.includes(id));

    if (removeIds.length > 0) {
      const { error } = await supabase
        .from("guardian_pet_hospitals")
        .delete()
        .eq("user_id", user.id)
        .eq("hospital_id", hospitalId)
        .in("pet_id", removeIds);
      if (error) {
        setMessage(error.message);
        setMode("idle");
        return;
      }
    }

    for (const petId of addIds) {
      // V10.7.2: 오래된 DB에 RPC 함수가 없어도 저장되도록
      // 기존 RLS 정책을 이용해 클라이언트에서 직접 기본 병원을 갱신합니다.
      const { error: clearPrimaryError } = await supabase
        .from("guardian_pet_hospitals")
        .update({ is_primary: false, updated_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("pet_id", petId);

      if (clearPrimaryError) {
        setMessage(clearPrimaryError.message);
        setMode("idle");
        return;
      }

      const { error: saveError } = await supabase
        .from("guardian_pet_hospitals")
        .upsert(
          {
            user_id: user.id,
            pet_id: petId,
            hospital_id: hospitalId,
            is_primary: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,pet_id,hospital_id" },
        );

      if (saveError) {
        setMessage(saveError.message);
        setMode("idle");
        return;
      }
    }

    setSavedPetIds(selectedPetIds);
    setMessage(selectedPetIds.length > 0 ? `${hospitalName}을(를) 즐겨찾는 병원으로 저장했습니다.` : "즐겨찾기에서 해제했습니다.");
    setMode("idle");
    window.setTimeout(() => setOpen(false), 800);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={mode === "loading"}
        className={compact
          ? `rounded-xl border px-3 py-2 text-xs font-black transition ${isFavorite ? "border-[#ff725e] bg-[#fff1ee] text-[#d95845]" : "border-[#d8e1dd] bg-white text-[#24473f]"}`
          : `rounded-full border px-4 py-2.5 text-sm font-black shadow-sm transition active:scale-95 ${isFavorite ? "border-[#ff725e] bg-[#fff1ee] text-[#d95845]" : "border-[#d8e1dd] bg-white text-[#24473f]"}`}
      >
        {isFavorite ? "★ 즐겨찾는 병원" : "☆ 즐겨찾기"}
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-5" onMouseDown={() => setOpen(false)}>
          <section className="w-full max-w-lg rounded-t-[30px] bg-white p-6 pb-[max(24px,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[30px] sm:p-7" onMouseDown={(event) => event.stopPropagation()}>
            <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-[#dfe5e1] sm:hidden" />
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black tracking-[0.18em] text-[#ff725e]">FAVORITE HOSPITAL</p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#143b34]">{hospitalName}</h2>
                <p className="mt-2 text-sm leading-6 text-[#657a74]">이 병원을 자주 이용하는 아이를 선택해 주세요. 홈과 내 병원에서 예약·전화·길찾기를 바로 이용할 수 있어요.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="shrink-0 rounded-full bg-[#f1f4f2] px-3 py-2 text-sm font-black text-[#46625b]">✕</button>
            </div>

            {mode === "loading" ? (
              <div className="mt-7 h-28 animate-pulse rounded-2xl bg-[#f1f4f2]" />
            ) : pets.length === 0 ? (
              <div className="mt-7 rounded-2xl border border-dashed border-[#cfdad5] bg-[#f8faf8] p-6 text-center">
                <p className="font-black text-[#24473f]">등록된 반려동물이 없습니다.</p>
                <Link href="/pets/new" className="mt-4 inline-flex rounded-xl bg-[#173f37] px-4 py-3 text-sm font-black text-white">반려동물 먼저 등록하기</Link>
              </div>
            ) : (
              <div className="mt-7 space-y-2">
                {pets.map((pet) => {
                  const checked = selectedPetIds.includes(pet.id);
                  return (
                    <label key={pet.id} className={`flex cursor-pointer items-center justify-between rounded-2xl border p-4 transition ${checked ? "border-[#ff9b8c] bg-[#fff4f1]" : "border-[#dfe5e1] bg-white"}`}>
                      <span>
                        <strong className="text-[#24473f]">{pet.name}</strong>
                        <span className="ml-2 text-sm text-[#788a85]">{pet.species === "dog" ? "강아지" : pet.species === "cat" ? "고양이" : "기타"}</span>
                      </span>
                      <input type="checkbox" checked={checked} onChange={() => togglePet(pet.id)} className="h-5 w-5 accent-[#ff725e]" />
                    </label>
                  );
                })}
              </div>
            )}

            {message && <p className="mt-4 rounded-xl bg-[#f3f6f4] px-4 py-3 text-sm font-semibold text-[#36574f]">{message}</p>}

            {pets.length > 0 && (
              <button type="button" onClick={save} disabled={mode === "saving" || !hasChanges} className="mt-6 w-full rounded-2xl bg-[#173f37] px-5 py-4 font-black text-white disabled:opacity-40">
                {mode === "saving" ? "저장 중..." : selectedPetIds.length > 0 ? "즐겨찾기 저장" : "즐겨찾기 해제"}
              </button>
            )}
          </section>
        </div>
      )}
    </>
  );
}
