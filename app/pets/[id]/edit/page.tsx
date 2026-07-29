"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PetMasterSelectFields from "@/components/pets/PetMasterSelectFields";
import {
  MASTER_UNKNOWN,
  resolveMasterSelection,
  type MasterLookupItem,
} from "@/lib/pet-master-form";

type FoodProductLookup = MasterLookupItem & {
  brand_id: number;
};

type Pet = {
  id: number;
  user_id: string;
  name: string;
  species: "dog" | "cat";
  breed_id: number | null;
  breed: string | null;
  birth_date: string | null;
  gender: "male" | "female" | "unknown" | null;
  weight_kg: number | null;
  notes: string | null;
};

type LifestyleProfile = {
  food_brand_id: number | null;
  food_product_id: number | null;
  food_brand: string;
  food_product: string;
  feeding_type: "scheduled" | "free";
  feeding_times_per_day: number | null;
  feeding_amount_per_day_g: number | null;
  treats: string | null;
  allergies: string | null;
  current_medications: string | null;
  supplements: string | null;
  neutered: boolean | null;
  living_environment: "indoor" | "outdoor" | "mixed" | null;
};

export default function EditPetPage() {
  const params = useParams();
  const router = useRouter();
  const petId = Number(params.id);

  const [pet, setPet] = useState<Pet | null>(null);
  const [profile, setProfile] = useState<LifestyleProfile | null>(null);
  const [breeds, setBreeds] = useState<MasterLookupItem[]>([]);
  const [brands, setBrands] = useState<MasterLookupItem[]>([]);
  const [products, setProducts] = useState<FoodProductLookup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setErrorMessage("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        if (!cancelled) {
          setErrorMessage("로그인이 필요합니다.");
          setIsLoading(false);
        }
        return;
      }

      const [
        { data: petData, error: petError },
        { data: profileData, error: profileError },
        { data: breedData },
        { data: brandData },
        { data: productData },
      ] = await Promise.all([
        supabase
          .from("pets")
          .select(
            "id,user_id,name,species,breed_id,breed,birth_date,gender,weight_kg,notes",
          )
          .eq("id", petId)
          .eq("user_id", user.id)
          .single(),
        supabase
          .from("pet_lifestyle_profiles")
          .select(
            "food_brand_id,food_product_id,food_brand,food_product,feeding_type,feeding_times_per_day,feeding_amount_per_day_g,treats,allergies,current_medications,supplements,neutered,living_environment",
          )
          .eq("pet_id", petId)
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase.from("pet_breeds").select("id,name_ko").eq("is_active", true),
        supabase
          .from("pet_food_brands")
          .select("id,name_ko")
          .eq("is_active", true),
        supabase
          .from("pet_food_products")
          .select("id,brand_id,name_ko")
          .eq("is_active", true),
      ]);

      if (petError || !petData) {
        if (!cancelled) {
          setErrorMessage(
            `반려동물 정보를 불러오지 못했습니다: ${
              petError?.message ?? "정보 없음"
            }`,
          );
          setIsLoading(false);
        }
        return;
      }

      if (profileError) {
        console.error("생활 프로필 조회 오류:", profileError);
      }

      if (!cancelled) {
        setPet(petData as Pet);
        setProfile((profileData as LifestyleProfile | null) ?? null);
        setBreeds((breedData as MasterLookupItem[] | null) ?? []);
        setBrands((brandData as MasterLookupItem[] | null) ?? []);
        setProducts((productData as FoodProductLookup[] | null) ?? []);
        setIsLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [petId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!pet) return;

    setIsSaving(true);
    setErrorMessage("");

    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const species = String(form.get("species") ?? "") as Pet["species"];
    const breedChoice = String(form.get("breed_choice") ?? MASTER_UNKNOWN);
    const brandChoice = String(form.get("food_brand_choice") ?? "");
    const productChoice = String(form.get("food_product_choice") ?? "");
    const feedingChoice = String(form.get("feeding_choice") ?? "2");

    const breed = resolveMasterSelection({
      choice: breedChoice,
      customValue: String(form.get("breed_custom") ?? ""),
      items: breeds,
      unknownText: "품종 모름",
    });

    const foodBrand = resolveMasterSelection({
      choice: brandChoice,
      customValue: String(form.get("food_brand_custom") ?? ""),
      items: brands,
    });

    const foodProduct = resolveMasterSelection({
      choice: productChoice,
      customValue: String(form.get("food_product_custom") ?? ""),
      items: products,
    });

    if (
      !name ||
      !species ||
      !brandChoice ||
      !productChoice ||
      !foodBrand.text ||
      !foodProduct.text
    ) {
      setErrorMessage("이름, 종류, 사료 브랜드, 제품명과 급여 방식은 필수입니다.");
      setIsSaving(false);
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setErrorMessage("로그인이 필요합니다.");
      setIsSaving(false);
      return;
    }

    const weightText = String(form.get("weight_kg") ?? "").trim();

    const { error: petError } = await supabase
      .from("pets")
      .update({
        name,
        species,
        breed_id: breed.id,
        breed: breed.text || null,
        birth_date: String(form.get("birth_date") ?? "") || null,
        gender: String(form.get("gender") ?? "unknown"),
        weight_kg: weightText ? Number(weightText) : null,
        notes: String(form.get("notes") ?? "").trim() || null,
      })
      .eq("id", petId)
      .eq("user_id", user.id);

    if (petError) {
      setErrorMessage(`기본정보 저장에 실패했습니다: ${petError.message}`);
      setIsSaving(false);
      return;
    }

    const feedingType = feedingChoice === "free" ? "free" : "scheduled";
    const feedingTimes =
      feedingType === "free" ? null : Number(feedingChoice);
    const amountText = String(
      form.get("feeding_amount_per_day_g") ?? "",
    ).trim();

    const { error: profileError } = await supabase
      .from("pet_lifestyle_profiles")
      .upsert(
        {
          pet_id: petId,
          user_id: user.id,
          food_brand_id: foodBrand.id,
          food_product_id: foodProduct.id,
          food_brand: foodBrand.text,
          food_product: foodProduct.text,
          feeding_type: feedingType,
          feeding_times_per_day: feedingTimes,
          feeding_amount_per_day_g: amountText ? Number(amountText) : null,
          treats: String(form.get("treats") ?? "").trim() || null,
          allergies: String(form.get("allergies") ?? "").trim() || null,
          current_medications:
            String(form.get("current_medications") ?? "").trim() || null,
          supplements: String(form.get("supplements") ?? "").trim() || null,
          neutered:
            String(form.get("neutered") ?? "unknown") === "yes"
              ? true
              : String(form.get("neutered")) === "no"
                ? false
                : null,
          living_environment:
            String(form.get("living_environment") ?? "indoor") || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "pet_id" },
      );

    if (profileError) {
      setErrorMessage(`생활정보 저장에 실패했습니다: ${profileError.message}`);
      setIsSaving(false);
      return;
    }

    router.push(`/pets/${petId}`);
    router.refresh();
  }

  const inputClass =
    "mt-2 w-full rounded-2xl border border-[#d8d3c8] bg-white px-4 py-3 outline-none transition focus:border-[#174c3c] focus:ring-2 focus:ring-[#174c3c]/10";

  if (isLoading) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-12 text-center text-[#6e746f]">
        정보를 불러오는 중입니다...
      </main>
    );
  }

  if (errorMessage && !pet) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-12">
        <p className="rounded-2xl bg-red-50 p-5 text-red-700">
          {errorMessage}
        </p>
      </main>
    );
  }

  if (!pet) return null;

  return (
    <main className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
      <Link href={`/pets/${petId}`} className="text-sm font-bold text-[#153f34]">
        ← 우리 아이로 돌아가기
      </Link>

      <p className="mt-7 text-sm font-bold text-[#d86c57]">LIFE PROFILE</p>
      <h1 className="mt-2 text-3xl font-black text-[#153f34]">
        {pet.name} 정보 수정
      </h1>
      <p className="mt-3 text-[#6e746f]">
        목록에서 선택하고, 목록에 없는 정보만 직접 입력할 수 있습니다.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <section className="rounded-[28px] bg-[#fffaf0] p-5 shadow-sm sm:p-7">
          <h2 className="text-xl font-bold text-[#153f34]">기본 정보</h2>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label>
              이름 *
              <input
                name="name"
                required
                defaultValue={pet.name}
                className={inputClass}
              />
            </label>

            <PetMasterSelectFields
              key={`${pet.id}-${profile?.food_brand_id ?? "legacy"}`}
              inputClass={inputClass}
              initialValues={{
                species: pet.species,
                breedId: pet.breed_id,
                breedText: pet.breed,
                foodBrandId: profile?.food_brand_id,
                foodBrandText: profile?.food_brand,
                foodProductId: profile?.food_product_id,
                foodProductText: profile?.food_product,
                feedingType: profile?.feeding_type ?? "scheduled",
                feedingTimesPerDay: profile?.feeding_times_per_day ?? 2,
              }}
            />

            <label>
              생년월일
              <input
                name="birth_date"
                type="date"
                defaultValue={pet.birth_date ?? ""}
                className={inputClass}
              />
            </label>

            <label>
              성별
              <select
                name="gender"
                defaultValue={pet.gender ?? "unknown"}
                className={inputClass}
              >
                <option value="unknown">미입력</option>
                <option value="male">수컷</option>
                <option value="female">암컷</option>
              </select>
            </label>

            <label>
              몸무게(kg)
              <input
                name="weight_kg"
                type="number"
                min="0"
                step="0.01"
                defaultValue={pet.weight_kg ?? ""}
                className={inputClass}
              />
            </label>
          </div>
        </section>

        <section className="rounded-[28px] bg-[#eef5f1] p-5 shadow-sm sm:p-7">
          <h2 className="text-xl font-bold text-[#153f34]">추가 생활정보</h2>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label>
              하루 총 급여량(g)
              <input
                name="feeding_amount_per_day_g"
                type="number"
                min="0"
                step="0.1"
                defaultValue={profile?.feeding_amount_per_day_g ?? ""}
                className={inputClass}
              />
            </label>

            <label>
              중성화
              <select
                name="neutered"
                defaultValue={
                  profile?.neutered === true
                    ? "yes"
                    : profile?.neutered === false
                      ? "no"
                      : "unknown"
                }
                className={inputClass}
              >
                <option value="unknown">미입력</option>
                <option value="yes">완료</option>
                <option value="no">미완료</option>
              </select>
            </label>

            <label>
              생활환경
              <select
                name="living_environment"
                defaultValue={profile?.living_environment ?? "indoor"}
                className={inputClass}
              >
                <option value="indoor">실내</option>
                <option value="outdoor">실외</option>
                <option value="mixed">실내·실외</option>
              </select>
            </label>

            <label>
              간식
              <input
                name="treats"
                defaultValue={profile?.treats ?? ""}
                className={inputClass}
              />
            </label>

            <label className="sm:col-span-2">
              알레르기
              <input
                name="allergies"
                defaultValue={profile?.allergies ?? ""}
                placeholder="없으면 '없음'"
                className={inputClass}
              />
            </label>

            <label className="sm:col-span-2">
              현재 복용약
              <input
                name="current_medications"
                defaultValue={profile?.current_medications ?? ""}
                placeholder="없으면 '없음'"
                className={inputClass}
              />
            </label>

            <label>
              영양제
              <input
                name="supplements"
                defaultValue={profile?.supplements ?? ""}
                className={inputClass}
              />
            </label>

            <label className="sm:col-span-2">
              기타 메모
              <textarea
                name="notes"
                rows={4}
                defaultValue={pet.notes ?? ""}
                className={inputClass}
              />
            </label>
          </div>
        </section>

        {errorMessage && (
          <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">
            {errorMessage}
          </p>
        )}

        <button
          disabled={isSaving}
          className="w-full rounded-2xl bg-[#153f34] px-6 py-4 font-bold text-white disabled:opacity-50"
        >
          {isSaving ? "저장 중..." : "변경사항 저장"}
        </button>
      </form>
    </main>
  );
}
