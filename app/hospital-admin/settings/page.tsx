"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { useHospitalPermissions } from "../../../components/hospital/HospitalPermissionProvider";

const items = [
  ["inpatient_enabled", "입원 관리", "입원 차트와 활력징후 메뉴를 사용합니다."],
  ["surgery_enabled", "수술 관리", "병상·수술 기록 메뉴를 사용합니다."],
  ["inventory_enabled", "재고 관리", "재고 및 약품 관리 메뉴를 사용합니다."],
  ["dispensing_enabled", "조제 관리", "처방 조제 업무 메뉴를 사용합니다."],
  ["billing_enabled", "수납 관리", "결제 및 수납 메뉴를 사용합니다."],
  ["lab_enabled", "검사·영상", "검사 결과와 영상 첨부 메뉴를 사용합니다."],
  ["guardian_chat_enabled", "보호자 채팅", "병원과 보호자 채팅 메뉴를 사용합니다."],
] as const;

type Key = (typeof items)[number][0];
type Settings = Record<Key, boolean>;

export default function HospitalSettingsPage() {
  const { refresh } = useHospitalPermissions();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  useEffect(() => {
    void (async () => {
      const accessToken = await token();
      const response = await fetch("/api/hospital/features", { headers: { authorization: `Bearer ${accessToken}` }, cache: "no-store" });
      const json = await response.json();
      if (response.ok) setSettings(json.features as Settings);
      else setMessage(json.message ?? "설정을 불러오지 못했습니다.");
    })();
  }, []);

  async function save() {
    if (!settings) return;
    setSaving(true);
    setMessage("");
    const accessToken = await token();
    const response = await fetch("/api/hospital/features", {
      method: "PATCH",
      headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(settings),
    });
    const json = await response.json();
    if (!response.ok) setMessage(json.message ?? "저장하지 못했습니다.");
    else {
      setMessage("병원 기능 설정을 저장했습니다.");
      await refresh();
    }
    setSaving(false);
  }

  return (
    <main className="p-4 lg:p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <p className="text-xs font-black tracking-[0.16em] text-sky-700">HOSPITAL SETTINGS</p>
          <h1 className="mt-2 text-3xl font-black">병원 기능 설정</h1>
          <p className="mt-2 text-sm text-slate-600">사용하지 않는 기능을 끄면 해당 메뉴가 직원 화면에서 자동으로 숨겨집니다.</p>
        </div>

        {!settings ? <div className="border bg-white p-8 text-sm font-bold">설정을 불러오는 중입니다...</div> : (
          <div className="space-y-3">
            {items.map(([key, label, description]) => (
              <label key={key} className="flex cursor-pointer items-center justify-between gap-4 border border-slate-200 bg-white p-5 shadow-sm">
                <div><p className="font-black">{label}</p><p className="mt-1 text-sm text-slate-500">{description}</p></div>
                <input type="checkbox" checked={settings[key]} onChange={(event) => setSettings({ ...settings, [key]: event.target.checked })} className="h-6 w-6" />
              </label>
            ))}
            <button type="button" disabled={saving} onClick={() => void save()} className="mt-3 bg-slate-950 px-6 py-3 text-sm font-black text-white disabled:opacity-50">{saving ? "저장 중..." : "설정 저장"}</button>
          </div>
        )}
        {message && <p className="mt-4 border border-slate-300 bg-white p-3 text-sm font-bold">{message}</p>}
      </div>
    </main>
  );
}
