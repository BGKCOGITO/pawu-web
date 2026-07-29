"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function PawuAdoptionRequestButton({ hospitalId }: { hospitalId: number }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function requestAdoption() {
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.alert("로그인 후 병원에 PAWU 도입을 요청할 수 있습니다.");
      setBusy(false);
      return;
    }
    const { error } = await supabase.from("hospital_adoption_requests").upsert({ user_id: user.id, hospital_id: hospitalId }, { onConflict: "user_id,hospital_id" });
    if (error) window.alert(error.message);
    else { setDone(true); window.alert("요청이 접수되었습니다. 보호자 수요를 모아 병원에 PAWU 도입을 제안하겠습니다."); }
    setBusy(false);
  }

  return <button type="button" onClick={requestAdoption} disabled={busy || done} className="rounded-xl border border-neutral-300 px-3 py-2.5 text-sm font-semibold disabled:bg-neutral-100 disabled:text-neutral-400">{done ? "도입 요청 완료" : busy ? "요청 중..." : "PAWU 도입 요청"}</button>;
}
