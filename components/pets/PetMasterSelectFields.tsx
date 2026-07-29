"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

export type PetMasterInitialValues = {
  species?: string;
  breedId?: number | null;
  breedText?: string | null;
  foodBrandId?: number | null;
  foodBrandText?: string | null;
  foodProductId?: number | null;
  foodProductText?: string | null;
  feedingType?: "scheduled" | "free";
  feedingTimesPerDay?: number | null;
};

type Breed = {
  id: number;
  species: "dog" | "cat";
  name_ko: string;
};

type FoodBrand = {
  id: number;
  name_ko: string;
  supported_species: string[];
};

type FoodProduct = {
  id: number;
  brand_id: number;
  species: "dog" | "cat" | "all";
  name_ko: string;
};

const UNKNOWN = "__unknown__";
const CUSTOM = "__custom__";

export default function PetMasterSelectFields({
  initialValues,
  inputClass,
}: {
  initialValues?: PetMasterInitialValues;
  inputClass: string;
}) {
  const initialSpecies = initialValues?.species ?? "";

  const [species, setSpecies] = useState(initialSpecies);
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [brands, setBrands] = useState<FoodBrand[]>([]);
  const [products, setProducts] = useState<FoodProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [masterError, setMasterError] = useState("");

  const initialBreedChoice = initialValues?.breedId
    ? String(initialValues.breedId)
    : initialValues?.breedText
      ? CUSTOM
      : UNKNOWN;

  const initialBrandChoice = initialValues?.foodBrandId
    ? String(initialValues.foodBrandId)
    : initialValues?.foodBrandText === "모름"
      ? UNKNOWN
      : initialValues?.foodBrandText
        ? CUSTOM
        : "";

  const initialProductChoice = initialValues?.foodProductId
    ? String(initialValues.foodProductId)
    : initialValues?.foodProductText === "모름"
      ? UNKNOWN
      : initialValues?.foodProductText
        ? CUSTOM
        : "";

  const [breedChoice, setBreedChoice] = useState(initialBreedChoice);
  const [brandChoice, setBrandChoice] = useState(initialBrandChoice);
  const [productChoice, setProductChoice] = useState(initialProductChoice);
  const [feedingType, setFeedingType] = useState<"scheduled" | "free">(
    initialValues?.feedingType ?? "scheduled",
  );

  useEffect(() => {
    let cancelled = false;

    async function loadMasterData() {
      setLoading(true);
      setMasterError("");

      const [
        { data: breedData, error: breedError },
        { data: brandData, error: brandError },
        { data: productData, error: productError },
      ] = await Promise.all([
        supabase
          .from("pet_breeds")
          .select("id,species,name_ko")
          .eq("is_active", true)
          .order("sort_order")
          .order("name_ko"),
        supabase
          .from("pet_food_brands")
          .select("id,name_ko,supported_species")
          .eq("is_active", true)
          .order("sort_order")
          .order("name_ko"),
        supabase
          .from("pet_food_products")
          .select("id,brand_id,species,name_ko")
          .eq("is_active", true)
          .order("sort_order")
          .order("name_ko"),
      ]);

      if (cancelled) return;

      if (breedError || brandError || productError) {
        setMasterError(
          `선택 목록을 불러오지 못했습니다: ${
            breedError?.message ??
            brandError?.message ??
            productError?.message ??
            "알 수 없는 오류"
          }`,
        );
      }

      setBreeds((breedData as Breed[] | null) ?? []);
      setBrands((brandData as FoodBrand[] | null) ?? []);
      setProducts((productData as FoodProduct[] | null) ?? []);
      setLoading(false);
    }

    void loadMasterData();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredBreeds = useMemo(
    () => breeds.filter((breed) => breed.species === species),
    [breeds, species],
  );

  const filteredBrands = useMemo(
    () =>
      brands.filter(
        (brand) =>
          !species ||
          brand.supported_species.length === 0 ||
          brand.supported_species.includes(species),
      ),
    [brands, species],
  );

  const filteredProducts = useMemo(() => {
    const brandId = Number(brandChoice);

    if (!Number.isFinite(brandId)) return [];

    return products.filter(
      (product) =>
        product.brand_id === brandId &&
        (product.species === "all" || product.species === species),
    );
  }, [brandChoice, products, species]);

  function handleSpeciesChange(value: string) {
    setSpecies(value);
    setBreedChoice(UNKNOWN);
    setBrandChoice("");
    setProductChoice("");
  }

  function handleBrandChange(value: string) {
    setBrandChoice(value);
    setProductChoice("");
  }

  return (
    <>
      <label>
        종류 *
        <select
          name="species"
          required
          value={species}
          onChange={(event) => handleSpeciesChange(event.target.value)}
          className={inputClass}
        >
          <option value="" disabled>
            강아지 또는 고양이 선택
          </option>
          <option value="dog">강아지</option>
          <option value="cat">고양이</option>
        </select>
      </label>

      <label>
        품종
        <select
          name="breed_choice"
          value={breedChoice}
          onChange={(event) => setBreedChoice(event.target.value)}
          disabled={!species || loading}
          className={inputClass}
        >
          {!species && <option value={UNKNOWN}>종류를 먼저 선택하세요</option>}
          {species && (
            <>
              <option value={UNKNOWN}>잘 모르겠어요</option>
              {filteredBreeds.map((breed) => (
                <option key={breed.id} value={breed.id}>
                  {breed.name_ko}
                </option>
              ))}
              <option value={CUSTOM}>직접 입력하기</option>
            </>
          )}
        </select>

        {breedChoice === CUSTOM && (
          <input
            name="breed_custom"
            required
            defaultValue={initialValues?.breedText ?? ""}
            placeholder="품종을 직접 입력해주세요"
            className={inputClass}
          />
        )}
      </label>

      <label>
        사료 브랜드 *
        <select
          name="food_brand_choice"
          required
          value={brandChoice}
          onChange={(event) => handleBrandChange(event.target.value)}
          disabled={!species || loading}
          className={inputClass}
        >
          <option value="" disabled>
            브랜드 선택
          </option>
          <option value={UNKNOWN}>잘 모르겠어요</option>
          {filteredBrands.map((brand) => (
            <option key={brand.id} value={brand.id}>
              {brand.name_ko}
            </option>
          ))}
          <option value={CUSTOM}>직접 입력하기</option>
        </select>

        {brandChoice === CUSTOM && (
          <input
            name="food_brand_custom"
            required
            defaultValue={initialValues?.foodBrandText ?? ""}
            placeholder="사료 브랜드를 직접 입력해주세요"
            className={inputClass}
          />
        )}
      </label>

      <label>
        사료 제품명 *
        <select
          name="food_product_choice"
          required
          value={productChoice}
          onChange={(event) => setProductChoice(event.target.value)}
          disabled={!brandChoice || loading}
          className={inputClass}
        >
          <option value="" disabled>
            {brandChoice ? "제품 선택" : "브랜드를 먼저 선택하세요"}
          </option>
          <option value={UNKNOWN}>잘 모르겠어요</option>

          {brandChoice !== CUSTOM &&
            brandChoice !== UNKNOWN &&
            filteredProducts.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name_ko}
              </option>
            ))}

          <option value={CUSTOM}>직접 입력하기</option>
        </select>

        {productChoice === CUSTOM && (
          <input
            name="food_product_custom"
            required
            defaultValue={initialValues?.foodProductText ?? ""}
            placeholder="제품명을 직접 입력해주세요"
            className={inputClass}
          />
        )}

        {brandChoice !== CUSTOM &&
          brandChoice !== UNKNOWN &&
          brandChoice &&
          filteredProducts.length === 0 && (
            <small className="mt-2 block text-[#8a6c55]">
              등록된 제품이 없으면 ‘직접 입력하기’를 선택해주세요.
            </small>
          )}
      </label>

      <label>
        하루 급여 방식 *
        <select
          name="feeding_choice"
          required
          value={
            feedingType === "free"
              ? "free"
              : String(initialValues?.feedingTimesPerDay ?? 2)
          }
          onChange={(event) =>
            setFeedingType(event.target.value === "free" ? "free" : "scheduled")
          }
          className={inputClass}
        >
          <option value="1">하루 1회</option>
          <option value="2">하루 2회</option>
          <option value="3">하루 3회</option>
          <option value="4">하루 4회</option>
          <option value="5">하루 5회</option>
          <option value="free">자유급식</option>
        </select>
      </label>

      {masterError && (
        <p className="sm:col-span-2 rounded-2xl bg-red-50 p-4 text-sm text-red-700">
          {masterError}
        </p>
      )}
    </>
  );
}

export const PET_MASTER_UNKNOWN = UNKNOWN;
export const PET_MASTER_CUSTOM = CUSTOM;
