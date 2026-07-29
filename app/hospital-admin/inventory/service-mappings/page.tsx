"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../../lib/supabase";

type InventoryItem = {
  id: number;
  name: string;
  unit: string;
  current_quantity: number;
  is_active: boolean;
};

type Usage = {
  inventoryItemId: number;
  quantity: number;
};

type ServiceItem = {
  id: number;
  name: string;
  category: string;
  default_price: number;
  is_active: boolean;
  service_item_inventory_usage: Array<{
    inventory_item_id: number;
    default_quantity: number;
  }>;
};

export default function ServiceInventoryMappingsPage() {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [usages, setUsages] = useState<Usage[]>([]);
  const [message, setMessage] = useState("");

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function load() {
    const accessToken = await token();
    if (!accessToken) return;

    const [serviceResponse, inventoryResponse] = await Promise.all([
      fetch("/api/hospital/inventory/service-mappings", {
        headers: { authorization: `Bearer ${accessToken}` },
      }),
      fetch("/api/hospital/inventory/items", {
        headers: { authorization: `Bearer ${accessToken}` },
      }),
    ]);

    const serviceResult = await serviceResponse.json();
    const inventoryResult = await inventoryResponse.json();

    if (!serviceResponse.ok) {
      setMessage(serviceResult.message ?? "진료 항목을 불러오지 못했습니다.");
      return;
    }

    setServices(serviceResult.services ?? []);
    setInventory((inventoryResult.items ?? []).filter((item: InventoryItem) => item.is_active));
  }

  useEffect(() => {
    void load();
  }, []);

  const selectedService = useMemo(
    () => services.find((service) => String(service.id) === selectedServiceId),
    [services, selectedServiceId],
  );

  function selectService(value: string) {
    setSelectedServiceId(value);
    const service = services.find((item) => String(item.id) === value);
    setUsages(
      (service?.service_item_inventory_usage ?? []).map((usage) => ({
        inventoryItemId: Number(usage.inventory_item_id),
        quantity: Number(usage.default_quantity),
      })),
    );
    setMessage("");
  }

  function addUsage() {
    const unused = inventory.find(
      (item) => !usages.some((usage) => usage.inventoryItemId === item.id),
    );
    if (!unused) return;
    setUsages((current) => [
      ...current,
      { inventoryItemId: unused.id, quantity: 1 },
    ]);
  }

  function patch(index: number, values: Partial<Usage>) {
    setUsages((current) =>
      current.map((usage, usageIndex) =>
        usageIndex === index ? { ...usage, ...values } : usage,
      ),
    );
  }

  async function save() {
    if (!selectedService) {
      setMessage("진료 항목을 선택해 주세요.");
      return;
    }

    const accessToken = await token();
    if (!accessToken) return;

    const response = await fetch("/api/hospital/inventory/service-mappings", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        serviceItemId: selectedService.id,
        usages: usages.map((usage) => ({
          inventoryItemId: usage.inventoryItemId,
          quantity: usage.quantity,
        })),
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      setMessage(result.message ?? "재고 사용량을 저장하지 못했습니다.");
      return;
    }

    setMessage("진료 항목의 기본 재고 사용량을 저장했습니다.");
    await load();
  }

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 text-black">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap justify-between gap-3">
          <Link href="/hospital-admin/v6-1" className="rounded-xl border bg-white px-4 py-2 text-sm">← V6.1 대시보드</Link>
          <Link href="/hospital-admin/inventory" className="rounded-xl border bg-white px-4 py-2 text-sm">재고 목록</Link>
        </div>

        <header className="mt-8">
          <p className="text-sm text-gray-500">진료 항목과 재고 연결</p>
          <h1 className="mt-2 text-3xl font-black">기본 재고 사용량 설정</h1>
          <p className="mt-3 text-sm leading-6 text-gray-600">
            청구 항목이 선택되면 예상 재고 사용량을 자동으로 불러옵니다.
            실제 차감 전에는 직원이 사용량을 다시 확인하고 수정할 수 있습니다.
          </p>
        </header>

        {message && <p className="mt-5 rounded-2xl bg-white p-4 text-sm">{message}</p>}

        <section className="mt-6 rounded-3xl border bg-white p-6">
          <label className="block text-sm font-bold">
            진료 항목
            <select
              value={selectedServiceId}
              onChange={(event) => selectService(event.target.value)}
              className="mt-2 w-full rounded-xl border p-3"
            >
              <option value="">선택하세요</option>
              {services.filter((service) => service.is_active).map((service) => (
                <option key={service.id} value={service.id}>
                  {service.category} · {service.name} · {service.default_price.toLocaleString("ko-KR")}원
                </option>
              ))}
            </select>
          </label>

          <div className="mt-6 space-y-3">
            {usages.map((usage, index) => {
              const selected = inventory.find((item) => item.id === usage.inventoryItemId);
              return (
                <article key={`${usage.inventoryItemId}-${index}`} className="grid gap-3 rounded-2xl border p-4 md:grid-cols-[1fr_180px_auto]">
                  <select
                    value={usage.inventoryItemId}
                    onChange={(event) => patch(index, { inventoryItemId: Number(event.target.value) })}
                    className="rounded-xl border p-3"
                  >
                    {inventory.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} · 현재 {item.current_quantity}{item.unit}
                      </option>
                    ))}
                  </select>
                  <label className="text-xs font-bold text-gray-600">
                    기본 사용량 ({selected?.unit ?? "단위"})
                    <input
                      type="number"
                      min="0.0001"
                      step="0.0001"
                      value={usage.quantity}
                      onChange={(event) => patch(index, { quantity: Math.max(0, Number(event.target.value)) })}
                      className="mt-1 w-full rounded-xl border p-3 text-black"
                    />
                  </label>
                  <button
                    onClick={() => setUsages((current) => current.filter((_, usageIndex) => usageIndex !== index))}
                    className="rounded-xl border px-4 text-sm"
                  >
                    삭제
                  </button>
                </article>
              );
            })}

            {selectedService && usages.length === 0 && (
              <p className="rounded-2xl bg-gray-50 p-6 text-center text-sm text-gray-500">
                연결된 재고가 없습니다. 아래 버튼으로 추가하세요.
              </p>
            )}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={!selectedService || usages.length >= inventory.length}
              onClick={addUsage}
              className="rounded-xl border border-dashed border-black p-4 font-bold disabled:border-gray-300 disabled:text-gray-400"
            >
              + 재고 품목 연결
            </button>
            <button
              type="button"
              disabled={!selectedService}
              onClick={() => void save()}
              className="rounded-xl bg-black p-4 font-bold text-white disabled:bg-gray-400"
            >
              기본 사용량 저장
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
