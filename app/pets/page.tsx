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
  return "미입력";
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
        .select(
          "id, name, species, breed, birth_date, gender, weight_kg, notes"
        )
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
    const shouldDelete = window.confirm(
      `${pet.name}의 정보를 정말 삭제하시겠습니까?`
    );

    if (!shouldDelete) {
      return;
    }

    const { error } = await supabase
      .from("pets")
      .delete()
      .eq("id", pet.id);

    if (error) {
      console.error("반려동물 삭제 오류:", error);
      alert(`삭제에 실패했습니다: ${error.message}`);
      return;
    }

    setPets((currentPets) =>
      currentPets.filter((currentPet) => currentPet.id !== pet.id)
    );

    alert("반려동물 정보가 삭제되었습니다.");
  }
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">내 반려동물</h1>

          <p className="mt-2 text-gray-600">
            예약에 사용할 반려동물을 등록하고 관리할 수 있습니다.
          </p>
        </div>

        <Link
          href="/pets/new"
          className="shrink-0 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white"
        >
          반려동물 등록
        </Link>
      </div>

      {isLoading && (
        <section className="rounded-xl border px-6 py-16 text-center">
          <p className="text-gray-600">반려동물을 불러오는 중입니다...</p>
        </section>
      )}

      {!isLoading && errorMessage && (
        <section className="rounded-xl border border-red-200 bg-red-50 px-6 py-6">
          <p className="text-sm text-red-600">{errorMessage}</p>
        </section>
      )}

      {!isLoading && !errorMessage && pets.length === 0 && (
        <section className="rounded-xl border border-dashed border-gray-300 px-6 py-16 text-center">
          <p className="text-lg font-medium">
            등록된 반려동물이 없습니다.
          </p>

          <p className="mt-2 text-sm text-gray-500">
            반려동물을 등록하면 예약할 때 바로 선택할 수 있습니다.
          </p>
        </section>
      )}

      {!isLoading && !errorMessage && pets.length > 0 && (
        <section className="space-y-4">
          {pets.map((pet) => (
            <article
              key={pet.id}
              className="rounded-xl border border-gray-200 p-6 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Link href={`/pets/${pet.id}`} className="text-xl font-bold text-[#153f34] hover:underline">{pet.name}</Link>

                  <p className="mt-1 text-sm text-gray-600">
                    {getSpeciesLabel(pet.species)}
                    {pet.breed ? ` · ${pet.breed}` : ""}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                    {getGenderLabel(pet.gender)}
                  </span>

                  <Link href={`/pets/${pet.id}/edit`} className="rounded-lg border px-3 py-1.5 text-xs font-medium">수정</Link>

                  <button
                    type="button"
                    onClick={() => handleDelete(pet)}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    삭제
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <span className="text-gray-500">생년월일</span>
                  <p className="mt-1 font-medium">
                    {pet.birth_date ?? "미입력"}
                  </p>
                </div>

                <div>
                  <span className="text-gray-500">몸무게</span>
                  <p className="mt-1 font-medium">
                    {pet.weight_kg !== null
                      ? `${pet.weight_kg}kg`
                      : "미입력"}
                  </p>
                </div>
              </div>

              {pet.notes && (
                <div className="mt-5 rounded-lg bg-gray-50 p-4">
                  <span className="text-sm text-gray-500">특이사항</span>
                  <p className="mt-1 whitespace-pre-wrap text-sm">
                    {pet.notes}
                  </p>
                </div>
              )}
            </article>
          ))}
        </section>
      )}
    </main>
  );
}