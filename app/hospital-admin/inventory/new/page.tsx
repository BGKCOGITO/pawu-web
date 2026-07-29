"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { supabase } from "../../../../lib/supabase";

const categories = ["의약품", "백신", "소독제", "의료소모품", "검사키트", "처방식", "판매상품", "기타"];

export default function NewInventoryItemPage() {
  const [form, setForm] = useState({
    name: "", category: "의약품", unit: "개", sku: "", barcode: "",
    manufacturer: "", supplierName: "", storageLocation: "",
    minimumQuantity: "0", managementType: "general", requiresReason: false, memo: "",
  });
  const [message, setMessage] = useState("");

  function patch(key: string, value: string | boolean) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;

    const response = await fetch("/api/hospital/inventory/items", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...form, minimumQuantity: Number(form.minimumQuantity) }),
    });
    const result = await response.json();

    if (!response.ok) {
      setMessage(result.message ?? "품목 등록 실패");
      return;
    }

    setMessage("재고 품목을 등록했습니다.");
    setForm((current) => ({ ...current, name: "", sku: "", barcode: "", memo: "" }));
  }

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 text-black">
      <div className="mx-auto max-w-3xl">
        <Link href="/hospital-admin/inventory" className="rounded-xl border bg-white px-4 py-2 text-sm">← 재고 목록</Link>
        <h1 className="mt-8 text-3xl font-black">재고 품목 등록</h1>
        {message && <p className="mt-5 rounded-2xl bg-white p-4 text-sm">{message}</p>}

        <form onSubmit={submit} className="mt-6 grid gap-4 rounded-3xl border bg-white p-6 md:grid-cols-2">
          <Field label="품목명" value={form.name} onChange={(v) => patch("name", v)} required />
          <label className="text-sm font-bold">분류<select value={form.category} onChange={(e) => patch("category", e.target.value)} className="mt-2 w-full rounded-xl border p-3">{categories.map((v) => <option key={v}>{v}</option>)}</select></label>
          <Field label="단위" value={form.unit} onChange={(v) => patch("unit", v)} required />
          <Field label="안전 재고" value={form.minimumQuantity} onChange={(v) => patch("minimumQuantity", v.replace(/[^\d.]/g, ""))} required />
          <Field label="SKU" value={form.sku} onChange={(v) => patch("sku", v)} />
          <Field label="바코드" value={form.barcode} onChange={(v) => patch("barcode", v)} />
          <Field label="제조사" value={form.manufacturer} onChange={(v) => patch("manufacturer", v)} />
          <Field label="공급업체" value={form.supplierName} onChange={(v) => patch("supplierName", v)} />
          <Field label="보관 위치" value={form.storageLocation} onChange={(v) => patch("storageLocation", v)} />
          <label className="text-sm font-bold">관리 방식<select value={form.managementType} onChange={(e) => patch("managementType", e.target.value)} className="mt-2 w-full rounded-xl border p-3"><option value="general">일반 재고</option><option value="expiry">유효기간 관리</option><option value="lot">로트 관리</option><option value="strict">엄격 관리</option></select></label>
          <label className="flex items-center gap-2 rounded-xl border p-4 text-sm md:col-span-2">
            <input type="checkbox" checked={form.requiresReason} onChange={(e) => patch("requiresReason", e.target.checked)} />
            모든 수량 변경 시 사유 필수
          </label>
          <label className="text-sm font-bold md:col-span-2">메모<textarea value={form.memo} onChange={(e) => patch("memo", e.target.value)} className="mt-2 w-full rounded-xl border p-3" rows={3} /></label>
          <button className="rounded-xl bg-black p-4 font-bold text-white md:col-span-2">품목 등록</button>
        </form>
      </div>
    </main>
  );
}

function Field({ label, value, onChange, required = false }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return <label className="text-sm font-bold">{label}<input required={required} value={value} onChange={(e) => onChange(e.target.value)} className="mt-2 w-full rounded-xl border p-3" /></label>;
}
