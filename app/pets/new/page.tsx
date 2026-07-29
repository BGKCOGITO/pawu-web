"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PetMasterSelectFields from "@/components/pets/PetMasterSelectFields";
import {
  MASTER_CUSTOM,
  MASTER_UNKNOWN,
  resolveMasterSelection,
  type MasterLookupItem,
} from "@/lib/pet-master-form";

type FoodProductLookup = MasterLookupItem & {
  brand_id: number;
};

export default function NewPetPage() {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [breeds, setBreeds] = useState<MasterLookupItem[]>([]);
  const [brands, setBrands] = useState<MasterLookupItem[]>([]);
  const [products, setProducts] = useState<FoodProductLookup[]>([]);

  useEffect(() => {
    async function loadLookups() {
      const [{ data: breedData }, { data: brandData }, { data: productData }] =
        await Promise.all([
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

      setBreeds((breedData as MasterLookupItem[] | null) ?? []);
      setBrands((brandData as MasterLookupItem[] | null) ?? []);
      setProducts((productData as FoodProductLookup[] | null) ?? []);
    }

    void loadLookups();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setErrorMessage("");

    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const species = String(form.get("species") ?? "");
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
    } = await supabase.auth.getUser();

    if (!user) {
      setErrorMessage("로그인이 필요합니다.");
      setIsSaving(false);
      return;
    }

    const weightText = String(form.get("weight_kg") ?? "").trim();

    const { data: pet, error: petError } = await supabase
      .from("pets")
      .insert({
        user_id: user.id,
        name,
        species,
        breed_id: breed.id,
        breed: breed.text || null,
        birth_date: String(form.get("birth_date") ?? "") || null,
        gender: String(form.get("gender") ?? "unknown"),
        weight_kg: weightText ? Number(weightText) : null,
        notes: String(form.get("notes") ?? "").trim() || null,
      })
      .select("id")
      .single();

    if (petError || !pet) {
      setErrorMessage(
        `등록에 실패했습니다: ${petError?.message ?? "알 수 없는 오류"}`,
      );
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
      .insert({
        pet_id: pet.id,
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
        living_environment: String(
          form.get("living_environment") ?? "indoor",
        ),
      });

    if (profileError) {
      await supabase.from("pets").delete().eq("id", pet.id);
      setErrorMessage(
        `생활정보 저장에 실패했습니다: ${profileError.message}`,
      );
      setIsSaving(false);
      return;
    }

    router.push(`/pets/${pet.id}`);
    router.refresh();
  }

  const input =
    "mt-2 w-full rounded-2xl border border-[#d8d3c8] bg-white px-4 py-3 outline-none focus:border-[#174c3c]";

  return (
    <main className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
      <p className="text-sm font-semibold text-[#d86c57]">
        PAWU LIFE PROFILE
      </p>
      <h1 className="mt-2 text-3xl font-black text-[#153f34]">
        우리 아이 등록
      </h1>
      <p className="mt-3 text-[#6e746f]">
        잘 모르는 정보는 목록에서 ‘잘 모르겠어요’를 선택할 수 있습니다.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <section className="rounded-[28px] bg-[#fffaf0] p-5 shadow-sm sm:p-7">
          <h2 className="text-xl font-bold text-[#153f34]">기본 정보</h2>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label>
              이름 *
              <input name="name" required className={input} />
            </label>

            <PetMasterSelectFields inputClass={input} />

            <label>
              생년월일
              <input name="birth_date" type="date" className={input} />
            </label>

            <label>
              성별
              <select
                name="gender"
                defaultValue="unknown"
                className={input}
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
                className={input}
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
                className={input}
              />
            </label>

            <label>
              중성화
              <select
                name="neutered"
                defaultValue="unknown"
                className={input}
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
                defaultValue="indoor"
                className={input}
              >
                <option value="indoor">실내</option>
                <option value="outdoor">실외</option>
                <option value="mixed">실내·실외</option>
              </select>
            </label>

            <label>
              간식
              <input name="treats" className={input} />
            </label>

            <label className="sm:col-span-2">
              알레르기
              <input
                name="allergies"
                placeholder="없으면 '없음'"
                className={input}
              />
            </label>

            <label className="sm:col-span-2">
              현재 복용약
              <input
                name="current_medications"
                placeholder="없으면 '없음'"
                className={input}
              />
            </label>

            <label>
              영양제
              <input name="supplements" className={input} />
            </label>

            <label className="sm:col-span-2">
              기타 메모
              <textarea name="notes" rows={3} className={input} />
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
          {isSaving ? "저장 중..." : "우리 아이 등록 완료"}
        </button>
      </form>
    </main>
  );
}
