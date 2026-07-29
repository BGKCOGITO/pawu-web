"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Preparation = {
  id: number;
  title: string;
  status: string;
  main_concern: string | null;
  created_at: string;
  generated_at: string | null;
};

export default function VisitPreparationsPage() {
  const params = useParams();
  const petId = Number(params.id);

  const [petName, setPetName] = useState("");
  const [preparations, setPreparations] = useState<Preparation[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function load() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setErrorMessage("로그인이 필요합니다.");
        setLoading(false);
        return;
      }

      const [{ data: petData, error: petError }, { data, error }] =
        await Promise.all([
          supabase
            .from("pets")
            .select("name")
            .eq("id", petId)
            .eq("user_id", user.id)
            .single(),
          supabase
            .from("visit_preparations")
            .select("id,title,status,main_concern,created_at,generated_at")
            .eq("pet_id", petId)
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),
        ]);

      if (petError) {
        setErrorMessage(`반려동물 조회 실패: ${petError.message}`);
      } else if (error) {
        setErrorMessage(`진료 준비 조회 실패: ${error.message}`);
      } else {
        setPetName(petData?.name ?? "");
        setPreparations((data as Preparation[] | null) ?? []);
      }

      setLoading(false);
    }

    void load();
  }, [petId]);

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl px-5 py-12 text-center">
        진료 준비 목록을 불러오는 중입니다...
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
      <Link href={`/pets/${petId}`} className="text-sm font-bold text-[#153f34]">
        ← {petName || "우리 아이"} 기록으로 돌아가기
      </Link>

      <div className="mt-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-[#d86c57]">PAWU VISIT PREP</p>
          <h1 className="mt-2 text-3xl font-black text-[#153f34]">
            진료 준비 목록
          </h1>
        </div>

        <Link
          href={`/pets/${petId}/visit-preparations/new`}
          className="rounded-full bg-[#d86c57] px-5 py-3 text-sm font-bold text-white"
        >
          새 진료 준비
        </Link>
      </div>

      {errorMessage && (
        <p className="mt-6 rounded-2xl bg-red-50 p-4 text-red-700">
          {errorMessage}
        </p>
      )}

      <div className="mt-7 space-y-4">
        {preparations.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-[#cfc8ba] p-8 text-center text-[#747a75]">
            아직 만든 진료 준비가 없습니다.
          </div>
        ) : (
          preparations.map((preparation) => (
            <Link
              key={preparation.id}
              href={`/pets/${petId}/visit-preparations/${preparation.id}`}
              className="block rounded-[24px] border border-[#e1ddd2] bg-white p-5 shadow-sm transition hover:border-[#153f34]"
            >
              <p className="text-xs font-bold text-[#d86c57]">
                {new Date(preparation.created_at).toLocaleString("ko-KR")}
              </p>
              <h2 className="mt-2 text-xl font-black text-[#153f34]">
                진료 준비
              </h2>
              <p className="mt-2 line-clamp-2 text-[#687069]">
                {preparation.main_concern || "입력된 주된 걱정 내용 없음"}
              </p>
            </Link>
          ))
        )}
      </div>
    </main>
  );
}
