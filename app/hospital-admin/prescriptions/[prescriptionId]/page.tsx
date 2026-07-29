"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../../../lib/supabase";
import {
  FREQUENCY_OPTIONS,
  ROUTE_OPTIONS,
} from "../../../../lib/prescription-config";

type MedicationOption = {
  id: number;
  hospital_alias: string | null;
  inventory_item_id: number | null;
  stock_unit: string | null;
  dispensing_unit: string | null;
  storage_location: string | null;
  is_active: boolean;
  central_medications: {
    id: number;
    product_name_ko: string;
    product_name_en: string | null;
    ingredient_name_ko: string | null;
    ingredient_name_en: string | null;
    manufacturer_name: string | null;
    dosage_form: string | null;
    strength_text: string | null;
    route_hint: string | null;
    medication_category: string | null;
    is_anesthetic: boolean;
    is_controlled: boolean;
  } | null;
};

type ItemForm = {
  medicationName: string;
  activeIngredient: string;
  inventoryItemId: string;
  centralMedicationId: string;
  hospitalMedicationId: string;
  productStrengthSnapshot: string;
  dosageFormSnapshot: string;
  manufacturerSnapshot: string;
  doseAmount: string;
  doseUnit: string;
  route: string;
  frequency: string;
  durationDays: string;
  totalQuantity: string;
  instructions: string;
  warningNote: string;
};

const EMPTY_ITEM: ItemForm = {
  medicationName: "",
  activeIngredient: "",
  inventoryItemId: "",
  centralMedicationId: "",
  hospitalMedicationId: "",
  productStrengthSnapshot: "",
  dosageFormSnapshot: "",
  manufacturerSnapshot: "",
  doseAmount: "",
  doseUnit: "",
  route: "경구",
  frequency: "하루 2회",
  durationDays: "",
  totalQuantity: "",
  instructions: "",
  warningNote: "",
};

const FREQUENCY_MULTIPLIER: Record<string, number> = {
  "하루 1회": 1,
  "하루 2회": 2,
  "하루 3회": 3,
  "하루 4회": 4,
};

const ROUTE_CODE: Record<string, string> = {
  경구: "PO",
  피하: "SC",
  근육: "IM",
  정맥: "IV",
  점안: "OPH",
  점이: "OTIC",
  외용: "TOP",
};

const FREQUENCY_CODE: Record<string, string> = {
  "하루 1회": "SID",
  "하루 2회": "BID",
  "하루 3회": "TID",
  "하루 4회": "QID",
  "필요 시": "PRN",
};

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function ageText(birthDate?: string | null) {
  if (!birthDate) return "-";
  const birth = new Date(birthDate);
  const now = new Date();
  let months =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    now.getMonth() -
    birth.getMonth();
  if (now.getDate() < birth.getDate()) months -= 1;
  if (months < 0) return "-";
  if (months < 12) return `${months}개월`;
  return `${Math.floor(months / 12)}세 ${months % 12}개월`;
}

export default function PrescriptionDetailPage() {
  const params = useParams<{ prescriptionId: string }>();
  const searchRef = useRef<HTMLInputElement>(null);
  const [prescription, setPrescription] = useState<any>(null);
  const [hospitalMedications, setHospitalMedications] = useState<MedicationOption[]>([]);
  const [medicationSearch, setMedicationSearch] = useState("");
  const [showMedicationResults, setShowMedicationResults] = useState(false);
  const [form, setForm] = useState({
    diagnosisSummary: "",
    guardianNote: "",
    startDate: "",
    endDate: "",
    guardianVisible: false,
  });
  const [item, setItem] = useState<ItemForm>(EMPTY_ITEM);
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState("");
  const [savingItem, setSavingItem] = useState(false);

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function load() {
    const accessToken = await token();
    if (!accessToken) return;

    const [prescriptionResponse, medicationResponse] = await Promise.all([
      fetch(`/api/hospital/prescriptions/${params.prescriptionId}`, {
        headers: { authorization: `Bearer ${accessToken}` },
      }),
      fetch("/api/hospital/medications", {
        headers: { authorization: `Bearer ${accessToken}` },
      }),
    ]);

    const result = await prescriptionResponse.json();
    const medicationResult = await medicationResponse.json();

    if (!prescriptionResponse.ok) {
      setMessage(result.message ?? "처방전을 불러오지 못했습니다.");
      return;
    }

    setPrescription(result.prescription);
    setForm({
      diagnosisSummary: result.prescription.diagnosis_summary ?? "",
      guardianNote: result.prescription.guardian_note ?? "",
      startDate: result.prescription.start_date ?? "",
      endDate: result.prescription.end_date ?? "",
      guardianVisible: result.prescription.guardian_visible === true,
    });

    if (medicationResponse.ok) {
      setHospitalMedications(
        (medicationResult.medications ?? []).filter(
          (medication: MedicationOption) => medication.is_active,
        ),
      );
    }
  }

  useEffect(() => {
    void load();
  }, [params.prescriptionId]);

  useEffect(() => {
    const multiplier = FREQUENCY_MULTIPLIER[item.frequency];
    const dose = Number(item.doseAmount);
    const days = Number(item.durationDays);
    if (
      multiplier &&
      Number.isFinite(dose) &&
      dose > 0 &&
      Number.isFinite(days) &&
      days > 0
    ) {
      const calculated = dose * multiplier * days;
      setItem((current) => ({
        ...current,
        totalQuantity: Number.isInteger(calculated)
          ? String(calculated)
          : calculated.toFixed(2).replace(/0+$/, "").replace(/\.$/, ""),
      }));
    }
  }, [item.doseAmount, item.frequency, item.durationDays]);

  const filteredMedications = useMemo(() => {
    const q = medicationSearch.trim().toLowerCase();
    if (!q) return hospitalMedications.slice(0, 12);
    return hospitalMedications
      .filter((option) => {
        const m = option.central_medications;
        return [
          option.hospital_alias,
          m?.product_name_ko,
          m?.product_name_en,
          m?.ingredient_name_ko,
          m?.ingredient_name_en,
          m?.manufacturer_name,
          m?.strength_text,
        ].some((value) => value?.toLowerCase().includes(q));
      })
      .slice(0, 20);
  }, [hospitalMedications, medicationSearch]);

  function selectMedication(option: MedicationOption) {
    const m = option.central_medications;
    if (!m) return;

    const route =
      ROUTE_OPTIONS.find((value) => value === m.route_hint) ??
      (m.dosage_form?.includes("주") ? "피하" : "경구");

    setItem((current) => ({
      ...current,
      medicationName: option.hospital_alias || m.product_name_ko,
      activeIngredient: m.ingredient_name_ko || m.ingredient_name_en || "",
      inventoryItemId: option.inventory_item_id ? String(option.inventory_item_id) : "",
      centralMedicationId: String(m.id),
      hospitalMedicationId: String(option.id),
      productStrengthSnapshot: m.strength_text || "",
      dosageFormSnapshot: m.dosage_form || "",
      manufacturerSnapshot: m.manufacturer_name || "",
      doseUnit:
        option.dispensing_unit ||
        option.stock_unit ||
        (m.dosage_form?.includes("정") ? "정" : m.dosage_form?.includes("주") ? "mL" : ""),
      route,
    }));
    setMedicationSearch(option.hospital_alias || m.product_name_ko);
    setShowMedicationResults(false);
  }

  async function save() {
    const accessToken = await token();

    const response = await fetch(
      `/api/hospital/prescriptions/${params.prescriptionId}`,
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(form),
      },
    );

    const result = await response.json();
    setMessage(response.ok ? "처방전 정보를 저장했습니다." : result.message ?? "저장 실패");
    if (response.ok) await load();
  }

  async function addItem() {
    if (savingItem) return;
    setSavingItem(true);
    const accessToken = await token();

    const response = await fetch(
      `/api/hospital/prescriptions/${params.prescriptionId}/items`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(item),
      },
    );

    const result = await response.json();
    setSavingItem(false);

    if (!response.ok) {
      setMessage(result.message ?? "처방 항목을 추가하지 못했습니다.");
      return;
    }

    setMessage("처방 항목을 추가했습니다.");
    setItem(EMPTY_ITEM);
    setMedicationSearch("");
    await load();
    window.setTimeout(() => searchRef.current?.focus(), 50);
  }

  async function removeItem(itemId: number) {
    const accessToken = await token();

    const response = await fetch(
      `/api/hospital/prescriptions/${params.prescriptionId}/items`,
      {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ itemId }),
      },
    );

    if (response.ok) await load();
  }

  async function changeStatus(action: "finalize" | "reopen" | "cancel") {
    const accessToken = await token();
    if (action === "finalize") await save();

    const response = await fetch(
      `/api/hospital/prescriptions/${params.prescriptionId}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ action, reason }),
      },
    );

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.message ?? "상태를 변경하지 못했습니다.");
      return;
    }

    setMessage(
      action === "finalize"
        ? "처방전을 확정했습니다."
        : action === "reopen"
          ? "처방전을 작성 상태로 전환했습니다."
          : "처방전을 취소했습니다.",
    );
    setReason("");
    await load();
  }

  if (!prescription) {
    return (
      <main className="p-8 text-center text-slate-500">
        {message || "처방전을 불러오는 중입니다."}
      </main>
    );
  }

  const pet = one(prescription.pets);
  const readonly = prescription.status !== "draft";
  const items = [...(prescription.medication_order_items ?? [])].sort(
    (a: any, b: any) => a.sort_order - b.sort_order,
  );

  return (
    <main className="prescription-screen p-3 lg:p-5">
      <style jsx global>{`
        @media print {
          body * { visibility: hidden !important; }
          .prescription-print-area, .prescription-print-area * { visibility: visible !important; }
          .prescription-print-area {
            position: absolute;
            inset: 0;
            width: 100%;
            padding: 18mm;
            background: white;
          }
          .print-hidden { display: none !important; }
          .prescription-screen { padding: 0 !important; }
        }
      `}</style>

      <div className="mx-auto max-w-[1700px]">
        <header className="print-hidden flex flex-wrap items-end justify-between gap-3 border-b border-slate-300 pb-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
              PAWU Clinical Prescription
            </p>
            <h1 className="mt-1 text-2xl font-bold">{pet?.name ?? "환자"} 처방 오더</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="border border-slate-400 bg-white px-4 py-2 text-sm font-semibold"
            >
              처방전 출력
            </button>
            {prescription.emr_record_id && (
              <Link
                href={`/hospital-admin/emr/${prescription.emr_record_id}`}
                className="border border-slate-400 bg-white px-4 py-2 text-sm font-semibold"
              >
                전자차트
              </Link>
            )}
            <Link
              href="/hospital-admin/prescriptions"
              className="border border-slate-400 bg-white px-4 py-2 text-sm font-semibold"
            >
              목록
            </Link>
          </div>
        </header>

        {message && (
          <div className="print-hidden mt-3 border border-blue-300 bg-blue-50 px-4 py-2 text-sm text-blue-900">
            {message}
          </div>
        )}

        <div className="mt-3 grid gap-3 2xl:grid-cols-[minmax(0,1fr)_330px]">
          <section className="space-y-3">
            <section className="prescription-print-area border border-slate-400 bg-white">
              <div className="grid border-b border-slate-400 bg-slate-100 md:grid-cols-4">
                <InfoCell label="환자" value={pet?.name ?? "-"} strong />
                <InfoCell label="축종·품종" value={`${pet?.species ?? "-"} · ${pet?.breed ?? "-"}`} />
                <InfoCell label="나이·성별" value={`${ageText(pet?.birth_date)} · ${pet?.gender ?? "-"}`} />
                <InfoCell label="체중" value={pet?.weight_kg != null ? `${pet.weight_kg} kg` : "미등록"} alert={pet?.weight_kg == null} />
              </div>

              <div className="flex items-center justify-between border-b border-slate-400 px-4 py-2">
                <div>
                  <h2 className="text-sm font-bold">처방 약품</h2>
                  <p className="text-[11px] text-slate-500">
                    처방번호 #{prescription.id} · 상태 {prescription.status}
                  </p>
                </div>
                <p className="text-xs text-slate-500">
                  {form.startDate || "-"} ~ {form.endDate || "-"}
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[1080px] table-fixed text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <th className="w-10 border-r border-slate-300 px-2 py-2 text-center">No</th>
                      <th className="w-[250px] border-r border-slate-300 px-3 py-2">약품 / 성분</th>
                      <th className="w-24 border-r border-slate-300 px-3 py-2">1회량</th>
                      <th className="w-24 border-r border-slate-300 px-3 py-2">경로</th>
                      <th className="w-24 border-r border-slate-300 px-3 py-2">횟수</th>
                      <th className="w-20 border-r border-slate-300 px-3 py-2">기간</th>
                      <th className="w-24 border-r border-slate-300 px-3 py-2">총량</th>
                      <th className="px-3 py-2">복약 지시 / 주의</th>
                      <th className="print-hidden w-14 px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row: any, index: number) => (
                      <tr key={row.id} className="border-t border-slate-300 align-top">
                        <td className="border-r border-slate-200 px-2 py-3 text-center font-semibold">
                          {index + 1}
                        </td>
                        <td className="border-r border-slate-200 px-3 py-3">
                          <p className="font-bold text-slate-950">{row.medication_name}</p>
                          <p className="mt-0.5 text-[11px] text-slate-600">
                            {[row.active_ingredient, row.product_strength_snapshot]
                              .filter(Boolean)
                              .join(" · ") || "-"}
                          </p>
                          <p className="mt-0.5 text-[10px] text-slate-400">
                            {[row.dosage_form_snapshot, row.manufacturer_snapshot]
                              .filter(Boolean)
                              .join(" / ")}
                          </p>
                        </td>
                        <td className="border-r border-slate-200 px-3 py-3 font-semibold">
                          {row.dose_amount} {row.dose_unit}
                        </td>
                        <td className="border-r border-slate-200 px-3 py-3">
                          <strong>{ROUTE_CODE[row.route] || "-"}</strong>
                          <div className="text-[10px] text-slate-500">{row.route}</div>
                        </td>
                        <td className="border-r border-slate-200 px-3 py-3">
                          <strong>{FREQUENCY_CODE[row.frequency] || "-"}</strong>
                          <div className="text-[10px] text-slate-500">{row.frequency}</div>
                        </td>
                        <td className="border-r border-slate-200 px-3 py-3">
                          {row.duration_days ? `${row.duration_days}일` : "-"}
                        </td>
                        <td className="border-r border-slate-200 px-3 py-3 font-semibold">
                          {row.total_quantity != null
                            ? `${row.total_quantity} ${row.dose_unit}`
                            : "-"}
                        </td>
                        <td className="px-3 py-3 leading-5">
                          <p>{row.instructions || "-"}</p>
                          {row.warning_note && (
                            <p className="mt-1 font-semibold text-red-700">
                              주의: {row.warning_note}
                            </p>
                          )}
                        </td>
                        <td className="print-hidden px-2 py-3 text-right">
                          {!readonly && (
                            <button
                              onClick={() => void removeItem(row.id)}
                              className="text-xs font-semibold text-red-700"
                            >
                              삭제
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}

                    {!items.length && (
                      <tr>
                        <td colSpan={9} className="px-4 py-12 text-center text-slate-500">
                          처방 약품을 추가해 주세요.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="grid border-t border-slate-400 md:grid-cols-2">
                <div className="border-b border-slate-300 p-4 md:border-b-0 md:border-r">
                  <p className="text-[11px] font-bold text-slate-500">진단·처방 목적</p>
                  <p className="mt-2 min-h-12 whitespace-pre-wrap text-sm">
                    {form.diagnosisSummary || "-"}
                  </p>
                </div>
                <div className="p-4">
                  <p className="text-[11px] font-bold text-slate-500">보호자 복약 안내</p>
                  <p className="mt-2 min-h-12 whitespace-pre-wrap text-sm">
                    {form.guardianNote || "-"}
                  </p>
                </div>
              </div>
            </section>

            {!readonly && (
              <section className="print-hidden border border-slate-400 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-400 bg-slate-900 px-4 py-2 text-white">
                  <div>
                    <h2 className="text-sm font-bold">처방 입력</h2>
                    <p className="text-[11px] text-slate-300">
                      병원 약품 마스터 검색 후 한 줄로 처방합니다.
                    </p>
                  </div>
                  <Link
                    href="/hospital-admin/medications/search"
                    className="border border-slate-500 px-3 py-1 text-xs font-semibold"
                  >
                    병원 약품 추가
                  </Link>
                </div>

                <div className="relative border-b border-slate-300 p-3">
                  <label className="block text-xs font-bold text-slate-600">
                    약품 검색
                    <input
                      ref={searchRef}
                      value={medicationSearch}
                      onFocus={() => setShowMedicationResults(true)}
                      onChange={(event) => {
                        setMedicationSearch(event.target.value);
                        setShowMedicationResults(true);
                      }}
                      placeholder="제품명, 성분명, 병원 별칭 검색"
                      className="mt-1 w-full border border-slate-400 bg-white px-3 py-2 text-sm"
                    />
                  </label>

                  {showMedicationResults && (
                    <div className="absolute left-3 right-3 z-20 mt-1 max-h-72 overflow-y-auto border border-slate-400 bg-white shadow-xl">
                      {filteredMedications.map((option) => {
                        const m = option.central_medications;
                        if (!m) return null;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => selectMedication(option)}
                            className="flex w-full items-start justify-between gap-4 border-b border-slate-200 px-3 py-3 text-left hover:bg-slate-50"
                          >
                            <span>
                              <span className="block text-sm font-bold">
                                {option.hospital_alias || m.product_name_ko}
                              </span>
                              <span className="block text-xs text-slate-600">
                                {[m.ingredient_name_ko || m.ingredient_name_en, m.strength_text, m.dosage_form]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                              <span className="block text-[11px] text-slate-400">
                                {m.manufacturer_name || "-"}
                              </span>
                            </span>
                            <span className="flex shrink-0 gap-1 text-[10px] font-bold">
                              {m.is_anesthetic && (
                                <span className="border border-violet-300 bg-violet-50 px-2 py-1 text-violet-700">
                                  마취·진정
                                </span>
                              )}
                              {m.is_controlled && (
                                <span className="border border-red-300 bg-red-50 px-2 py-1 text-red-700">
                                  규제관리
                                </span>
                              )}
                            </span>
                          </button>
                        );
                      })}
                      {!filteredMedications.length && (
                        <div className="p-4 text-center text-sm text-slate-500">
                          병원 약품 마스터에서 검색 결과가 없습니다.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid gap-px bg-slate-300 xl:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_2fr]">
                  <EditorCell label="선택 약품">
                    <div className="min-h-16">
                      <p className="font-bold">{item.medicationName || "약품을 검색해 선택"}</p>
                      <p className="text-[11px] text-slate-500">
                        {[item.activeIngredient, item.productStrengthSnapshot, item.dosageFormSnapshot]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  </EditorCell>

                  <EditorCell label="1회 용량">
                    <div className="flex gap-1">
                      <input
                        value={item.doseAmount}
                        onChange={(e) => setItem({ ...item, doseAmount: e.target.value })}
                        inputMode="decimal"
                        className="w-full border border-slate-300 px-2 py-2 text-sm"
                      />
                      <input
                        value={item.doseUnit}
                        onChange={(e) => setItem({ ...item, doseUnit: e.target.value })}
                        placeholder="단위"
                        className="w-16 border border-slate-300 px-2 py-2 text-sm"
                      />
                    </div>
                  </EditorCell>

                  <EditorCell label="투여 경로">
                    <select
                      value={item.route}
                      onChange={(e) => setItem({ ...item, route: e.target.value })}
                      className="w-full border border-slate-300 bg-white px-2 py-2 text-sm"
                    >
                      {ROUTE_OPTIONS.map((value) => (
                        <option key={value} value={value}>
                          {ROUTE_CODE[value] ? `${ROUTE_CODE[value]} · ` : ""}{value}
                        </option>
                      ))}
                    </select>
                  </EditorCell>

                  <EditorCell label="투여 횟수">
                    <select
                      value={item.frequency}
                      onChange={(e) => setItem({ ...item, frequency: e.target.value })}
                      className="w-full border border-slate-300 bg-white px-2 py-2 text-sm"
                    >
                      {FREQUENCY_OPTIONS.map((value) => (
                        <option key={value} value={value}>
                          {FREQUENCY_CODE[value] ? `${FREQUENCY_CODE[value]} · ` : ""}{value}
                        </option>
                      ))}
                    </select>
                  </EditorCell>

                  <EditorCell label="기간">
                    <div className="flex items-center gap-1">
                      <input
                        value={item.durationDays}
                        onChange={(e) =>
                          setItem({
                            ...item,
                            durationDays: e.target.value.replace(/[^\d]/g, ""),
                          })
                        }
                        inputMode="numeric"
                        className="w-full border border-slate-300 px-2 py-2 text-sm"
                      />
                      <span className="text-xs">일</span>
                    </div>
                  </EditorCell>

                  <EditorCell label="총량">
                    <input
                      value={item.totalQuantity}
                      onChange={(e) => setItem({ ...item, totalQuantity: e.target.value })}
                      inputMode="decimal"
                      className="w-full border border-slate-300 px-2 py-2 text-sm"
                    />
                    <p className="mt-1 text-[10px] text-slate-500">
                      1회량×횟수×기간 산술 참고
                    </p>
                  </EditorCell>

                  <EditorCell label="복약 지시">
                    <input
                      value={item.instructions}
                      onChange={(e) => setItem({ ...item, instructions: e.target.value })}
                      placeholder="예: 식후 투여, 충분한 물과 함께"
                      className="w-full border border-slate-300 px-2 py-2 text-sm"
                    />
                    <div className="mt-2 flex flex-wrap gap-1">
                      {["식후 투여", "식전 투여", "공복 투여", "잘 흔들어 투여"].map((text) => (
                        <button
                          key={text}
                          type="button"
                          onClick={() => setItem({ ...item, instructions: text })}
                          className="border border-slate-300 px-2 py-1 text-[10px]"
                        >
                          {text}
                        </button>
                      ))}
                    </div>
                  </EditorCell>
                </div>

                <div className="grid gap-3 border-t border-slate-300 bg-slate-50 p-3 md:grid-cols-[1fr_auto]">
                  <label className="text-xs font-bold text-slate-600">
                    주의사항
                    <input
                      value={item.warningNote}
                      onChange={(e) => setItem({ ...item, warningNote: e.target.value })}
                      placeholder="보호자에게 반드시 전달할 주의사항"
                      className="mt-1 w-full border border-slate-300 bg-white px-3 py-2 text-sm"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void addItem()}
                    disabled={savingItem}
                    className="self-end border border-slate-900 bg-slate-900 px-6 py-2 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {savingItem ? "추가 중" : "처방 항목 추가"}
                  </button>
                </div>
              </section>
            )}

            <section className="print-hidden border border-slate-300 bg-white">
              <div className="border-b border-slate-300 px-4 py-3">
                <h2 className="text-sm font-bold">처방 및 보호자 안내 설정</h2>
              </div>
              <div className="space-y-4 p-4">
                <label className="block text-sm font-semibold">
                  진단·처방 목적
                  <textarea
                    disabled={readonly}
                    value={form.diagnosisSummary}
                    onChange={(e) => setForm({ ...form, diagnosisSummary: e.target.value })}
                    rows={3}
                    className="mt-1 w-full border border-slate-300 px-3 py-2 disabled:bg-slate-100"
                  />
                </label>
                <label className="block text-sm font-semibold">
                  보호자 복약 안내
                  <textarea
                    disabled={readonly}
                    value={form.guardianNote}
                    onChange={(e) => setForm({ ...form, guardianNote: e.target.value })}
                    rows={4}
                    className="mt-1 w-full border border-slate-300 px-3 py-2 disabled:bg-slate-100"
                  />
                </label>
                <div className="grid gap-3 md:grid-cols-2">
                  <Input label="복약 시작일" value={form.startDate} onChange={(v) => setForm({ ...form, startDate: v })} type="date" disabled={readonly} />
                  <Input label="복약 종료일" value={form.endDate} onChange={(v) => setForm({ ...form, endDate: v })} type="date" disabled={readonly} />
                </div>
                <label className="flex items-center gap-3 border border-slate-300 bg-slate-50 p-3 text-sm font-semibold">
                  <input
                    type="checkbox"
                    disabled={readonly}
                    checked={form.guardianVisible}
                    onChange={(e) => setForm({ ...form, guardianVisible: e.target.checked })}
                    className="h-5 w-5"
                  />
                  보호자 앱에 처방전과 복약 안내 공개
                </label>
                {!readonly && (
                  <button
                    type="button"
                    onClick={() => void save()}
                    className="border border-slate-900 bg-slate-900 px-5 py-2 text-sm font-bold text-white"
                  >
                    처방전 저장
                  </button>
                )}
              </div>
            </section>
          </section>

          <aside className="print-hidden space-y-3">
            <section className="border border-slate-400 bg-white">
              <div className="border-b border-slate-300 bg-slate-100 px-4 py-2">
                <h2 className="text-sm font-bold">환자 안전 정보</h2>
              </div>
              <div className="divide-y divide-slate-200 text-sm">
                <SafetyRow label="환자" value={pet?.name ?? "-"} />
                <SafetyRow label="체중" value={pet?.weight_kg != null ? `${pet.weight_kg} kg` : "미등록"} alert={pet?.weight_kg == null} />
                <SafetyRow label="나이" value={ageText(pet?.birth_date)} />
                <SafetyRow label="성별" value={pet?.gender ?? "-"} />
                <SafetyRow label="알레르기" value="EMR 연동 예정" muted />
                <SafetyRow label="현재 복용약" value="EMR 연동 예정" muted />
                <SafetyRow label="신장·간 주의" value="검사결과 연동 예정" muted />
              </div>
            </section>

            <section className="border border-slate-400 bg-white">
              <div className="border-b border-slate-300 bg-slate-100 px-4 py-2">
                <h2 className="text-sm font-bold">처방 상태</h2>
              </div>
              <div className="p-4">
                <p className="border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-bold">
                  {prescription.status}
                </p>

                {prescription.status === "draft" ? (
                  <div className="mt-3 space-y-2">
                    <button
                      type="button"
                      onClick={() => void changeStatus("finalize")}
                      className="w-full border border-green-700 bg-green-700 px-4 py-2 text-sm font-bold text-white"
                    >
                      수의사 처방 확정
                    </button>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="취소 사유"
                      className="w-full border border-slate-300 px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => void changeStatus("cancel")}
                      className="w-full border border-red-300 bg-white px-4 py-2 text-sm font-bold text-red-700"
                    >
                      처방전 취소
                    </button>
                  </div>
                ) : prescription.status === "finalized" ? (
                  <div className="mt-3 space-y-2">
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="수정 사유"
                      className="w-full border border-slate-300 px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => void changeStatus("reopen")}
                      className="w-full border border-amber-500 bg-white px-4 py-2 text-sm font-bold text-amber-800"
                    >
                      작성 상태로 전환
                    </button>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
              <strong>안전 원칙</strong>
              <p className="mt-1">
                PAWU는 투여 용량이나 약물 조합을 추천하지 않습니다. 총량은 수의사가 입력한
                1회량·횟수·기간의 산술 참고값이며 확정 전 반드시 다시 확인해야 합니다.
              </p>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

function InfoCell({
  label,
  value,
  strong = false,
  alert = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
  alert?: boolean;
}) {
  return (
    <div className="border-b border-slate-300 px-4 py-3 md:border-b-0 md:border-r last:border-r-0">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-1 text-sm ${strong ? "font-bold" : ""} ${alert ? "font-bold text-red-700" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function EditorCell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="bg-white p-3 text-xs font-bold text-slate-600">
      {label}
      <div className="mt-1 font-normal text-slate-900">{children}</div>
    </label>
  );
}

function SafetyRow({
  label,
  value,
  alert = false,
  muted = false,
}: {
  label: string;
  value: string;
  alert?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3 px-4 py-3">
      <span className="font-semibold text-slate-600">{label}</span>
      <span className={`text-right ${alert ? "font-bold text-red-700" : ""} ${muted ? "text-slate-400" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <label className="text-xs font-semibold text-slate-600">
      {label}
      <input
        type={type}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100"
      />
    </label>
  );
}
