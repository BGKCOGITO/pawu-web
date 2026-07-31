"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Pet = {
  id: number;
  name: string;
  species: "dog" | "cat" | "other";
  breed: string | null;
  birth_date: string | null;
  gender: "male" | "female" | "unknown" | null;
  weight_kg: number | null;
  notes: string | null;
};

function getSpeciesLabel(species: Pet["species"]) {
  if (species === "dog") return "강아지";
  if (species === "cat") return "고양이";
  return "기타";
}

function getGenderLabel(gender: Pet["gender"]) {
  if (gender === "male") return "수컷";
  if (gender === "female") return "암컷";
  return "성별 미입력";
}

function getAgeLabel(birthDate: string | null) {
  if (!birthDate) return "나이 미입력";

  const birth = new Date(`${birthDate}T00:00:00`);
  const today = new Date();
  let years = today.getFullYear() - birth.getFullYear();
  let months = today.getMonth() - birth.getMonth();

  if (today.getDate() < birth.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  if (years <= 0) return `${Math.max(months, 0)}개월`;
  if (months === 0) return `${years}세`;
  return `${years}세 ${months}개월`;
}

function PetSymbol({ species }: { species: Pet["species"] }) {
  return (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] bg-[#e4f3ed] text-[#173c34] shadow-[inset_0_0_0_1px_rgba(23,60,52,0.05)]">
      {species === "cat" ? (
        <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M6.5 9.2 5 4.8l4.1 2.1A8.5 8.5 0 0 1 12 6.4c1 0 2 .2 2.9.5L19 4.8l-1.5 4.4a7 7 0 1 1-11 0Z" />
          <path d="M9 13h.01M15 13h.01M10 16c1.2.8 2.8.8 4 0M8 15l-3 .8M16 15l3 .8" />
        </svg>
      ) : species === "dog" ? (
        <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M8 7 5.2 4.8 4 9.5v3A8 8 0 0 0 12 20a8 8 0 0 0 8-7.5v-3l-1.2-4.7L16 7" />
          <path d="M9 13h.01M15 13h.01M10 16c1.2.8 2.8.8 4 0" />
        </svg>
      ) : (
        <span className="text-2xl font-black">P</span>
      )}
    </div>
  );
}

export default function PetsPage() {
  const [pets, setPets] = useState<Pet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadPets() {
      setIsLoading(true);
      setErrorMessage("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setErrorMessage("로그인이 필요합니다.");
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("pets")
        .select("id, name, species, breed, birth_date, gender, weight_kg, notes")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("반려동물 조회 오류:", error);
        setErrorMessage(`목록을 불러오지 못했습니다: ${error.message}`);
        setIsLoading(false);
        return;
      }

      setPets(data ?? []);
      setIsLoading(false);
    }

    loadPets();
  }, []);

  async function handleDelete(pet: Pet) {
    const shouldDelete = window.confirm(`${pet.name}의 정보를 정말 삭제하시겠습니까?`);
    if (!shouldDelete) return;

    const { error } = await supabase.from("pets").delete().eq("id", pet.id);

    if (error) {
      console.error("반려동물 삭제 오류:", error);
      alert(`삭제에 실패했습니다: ${error.message}`);
      return;
    }

    setPets((currentPets) => currentPets.filter((currentPet) => currentPet.id !== pet.id));
    alert("반려동물 정보가 삭제되었습니다.");
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl bg-[#fbfaf6] px-5 pb-36 pt-7 sm:px-7 sm:pt-10">
      <section className="mb-7 rounded-[30px] bg-[#173c34] px-6 py-7 text-white shadow-[0_18px_40px_rgba(23,60,52,0.16)] sm:px-8">
        <div className="flex items-start justify-between gap-5">
          <div className="min-w-0">
            <p className="text-[11px] font-bold tracking-[0.24em] text-[#a9d7c7]">MY PET</p>
            <h1 className="mt-2 !text-white text-[32px] font-black leading-[1.08] tracking-[-0.04em] sm:text-4xl">우리 아이</h1>
            <p className="mt-3 max-w-[18rem] break-keep text-[14px] leading-6 text-white/80 sm:max-w-md">
              예약과 건강기록에 사용할 반려동물 정보를 한곳에서 관리하세요.
            </p>
          </div>

          <Link
            href="/pets/new"
            className="flex h-12 shrink-0 items-center gap-2 rounded-2xl bg-[#bfe7d8] px-4 text-sm font-extrabold text-[#173c34] transition active:scale-[0.98]"
          >
            <span className="text-xl leading-none">+</span>
            등록
          </Link>
        </div>

        {!isLoading && !errorMessage && (
          <div className="mt-6 flex flex-col items-start gap-2 border-t border-white/15 pt-5 sm:flex-row sm:items-center sm:gap-3">
            <div className="shrink-0 whitespace-nowrap rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90">
              등록된 아이 {pets.length}마리
            </div>
            <p className="break-keep text-xs leading-5 text-white/60">카드를 눌러 정보를 관리할 수 있어요.</p>
          </div>
        )}
      </section>

      {isLoading && (
        <section className="rounded-[28px] border border-[#e5e4dc] bg-white px-6 py-16 text-center shadow-sm">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-[#dfeee8] border-t-[#173c34]" />
          <p className="mt-4 text-sm font-medium text-[#69736f]">반려동물을 불러오는 중입니다.</p>
        </section>
      )}

      {!isLoading && errorMessage && (
        <section className="rounded-[28px] border border-[#f3d5d3] bg-[#fff7f6] px-6 py-8 text-center">
          <p className="text-sm font-semibold text-[#bc3a31]">{errorMessage}</p>
          <Link href="/auth/login" className="mt-5 inline-flex rounded-xl bg-[#173c34] px-5 py-3 text-sm font-bold text-white">
            로그인하기
          </Link>
        </section>
      )}

      {!isLoading && !errorMessage && pets.length === 0 && (
        <section className="rounded-[30px] border border-dashed border-[#ccd7d2] bg-white px-7 py-16 text-center shadow-[0_14px_36px_rgba(32,61,53,0.06)]">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] bg-[#e4f3ed] text-4xl">🐾</div>
          <h2 className="mt-6 text-xl font-extrabold tracking-[-0.03em] text-[#173c34]">아직 등록된 아이가 없어요</h2>
          <p className="mt-2 text-sm leading-6 text-[#74807c]">반려동물을 등록하면 예약과 건강기록을 더 편리하게 이용할 수 있습니다.</p>
          <Link href="/pets/new" className="mt-7 inline-flex h-12 items-center rounded-2xl bg-[#173c34] px-6 text-sm font-bold text-white">
            첫 반려동물 등록하기
          </Link>
        </section>
      )}

      {!isLoading && !errorMessage && pets.length > 0 && (
        <section className="space-y-4">
          {pets.map((pet) => (
            <article
              key={pet.id}
              className="overflow-hidden rounded-[30px] border border-[#e5e5de] bg-white shadow-[0_14px_34px_rgba(31,58,51,0.07)]"
            >
              <div className="p-5 sm:p-6">
                <div className="flex items-start gap-4">
                  <PetSymbol species={pet.species} />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate text-[25px] font-black leading-tight tracking-[-0.035em] text-[#173c34]">{pet.name}</h2>
                        <p className="mt-1 line-clamp-2 break-keep text-[13px] font-medium leading-5 text-[#6e7975]">
                          {getSpeciesLabel(pet.species)}
                          {pet.breed ? ` · ${pet.breed}` : ""}
                        </p>
                      </div>

                      <span className="shrink-0 whitespace-nowrap rounded-full bg-[#f0f4f2] px-3 py-1.5 text-xs font-bold text-[#45635b]">
                        {getGenderLabel(pet.gender)}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2.5">
                      <div className="rounded-2xl bg-[#f7f7f3] px-3.5 py-3">
                        <p className="text-[11px] font-bold text-[#8a9490]">나이</p>
                        <p className="mt-1 whitespace-nowrap text-[14px] font-extrabold leading-5 text-[#203e36]">{getAgeLabel(pet.birth_date)}</p>
                      </div>
                      <div className="rounded-2xl bg-[#f7f7f3] px-3.5 py-3">
                        <p className="text-[11px] font-bold text-[#8a9490]">몸무게</p>
                        <p className="mt-1 whitespace-nowrap text-[14px] font-extrabold leading-5 text-[#203e36]">
                          {pet.weight_kg !== null ? `${pet.weight_kg}kg` : "미입력"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {pet.notes && (
                  <div className="mt-4 rounded-2xl border border-[#edf0ed] bg-[#fafbf9] px-4 py-3.5">
                    <p className="text-[11px] font-bold text-[#84908b]">특이사항</p>
                    <p className="mt-1.5 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-[#4d5d57]">{pet.notes}</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-[1fr_auto] border-t border-[#ecece6] bg-[#fcfcfa]">
                <Link
                  href={`/pets/${pet.id}/edit`}
                  className="flex min-h-14 items-center justify-center gap-2 text-sm font-extrabold text-[#173c34] transition active:bg-[#f0f5f2]"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
                  </svg>
                  정보 수정
                </Link>
                <button
                  type="button"
                  onClick={() => handleDelete(pet)}
                  className="flex min-h-14 items-center justify-center border-l border-[#ecece6] px-5 text-sm font-bold text-[#c34a42] transition active:bg-[#fff3f2]"
                >
                  삭제
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
