"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabase";

export default function InventoryUsageQueuePage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;

      let hospitalId: number | null = null;
      const { data: staff } = await supabase
        .from("hospital_staff")
        .select("hospital_id")
        .eq("user_id", auth.user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (staff) hospitalId = Number(staff.hospital_id);

      if (!hospitalId) {
        const { data: admin } = await supabase
          .from("hospital_admins")
          .select("hospital_id")
          .eq("user_id", auth.user.id)
          .maybeSingle();
        if (admin) hospitalId = Number(admin.hospital_id);
      }

      if (!hospitalId) {
        setMessage("병원 정보를 찾지 못했습니다.");
        return;
      }

      const { data, error } = await supabase
        .from("hospital_invoices")
        .select("id, status, total_amount, created_at, pets(name), inventory_finalized_at")
        .eq("hospital_id", hospitalId)
        .in("status", ["draft", "payment_pending", "paid"])
        .is("inventory_finalized_at", null)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        setMessage(error.message);
        return;
      }

      setInvoices(data ?? []);
    }

    void load();
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 text-black">
      <div className="mx-auto max-w-5xl">
        <Link href="/hospital-admin/v6-1" className="rounded-xl border bg-white px-4 py-2 text-sm">← V6.1 대시보드</Link>
        <header className="mt-8">
          <p className="text-sm text-gray-500">진료 완료 전 확인</p>
          <h1 className="mt-2 text-3xl font-black">재고 사용량 검토 대기</h1>
        </header>

        {message && <p className="mt-5 rounded-2xl bg-white p-4 text-sm">{message}</p>}

        <section className="mt-6 space-y-3">
          {invoices.map((invoice) => {
            const pet = Array.isArray(invoice.pets) ? invoice.pets[0] : invoice.pets;
            return (
              <Link
                key={invoice.id}
                href={`/hospital-admin/inventory/usage-review/${invoice.id}`}
                className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border bg-white p-5 hover:border-black"
              >
                <div>
                  <p className="text-xs text-gray-500">청구서 #{invoice.id}</p>
                  <h2 className="mt-1 text-lg font-black">{pet?.name ?? "환자"}</h2>
                  <p className="mt-2 text-sm text-gray-500">
                    {new Date(invoice.created_at).toLocaleString("ko-KR")} · {invoice.status}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black">{Number(invoice.total_amount).toLocaleString("ko-KR")}원</p>
                  <p className="mt-2 text-sm font-bold">사용량 검토 →</p>
                </div>
              </Link>
            );
          })}

          {!invoices.length && !message && (
            <p className="rounded-3xl border bg-white p-10 text-center text-sm text-gray-500">
              재고 사용량 검토가 필요한 청구서가 없습니다.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
