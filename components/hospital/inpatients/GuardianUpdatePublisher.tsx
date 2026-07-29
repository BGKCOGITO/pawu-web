"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { hospitalAuthFetch } from "@/lib/hospital-auth-fetch";

type UpdateItem = {
  id: number;
  category: string;
  title: string;
  message: string;
  image_url: string | null;
  published_at: string;
  retracted_at: string | null;
};

const categoryLabel: Record<string, string> = {
  general: "일반 경과",
  meal: "식사",
  medication: "투약",
  condition: "상태",
  procedure: "처치",
  discharge: "퇴원 안내",
};

export default function GuardianUpdatePublisher({ hospitalizationId }: { hospitalizationId: string }) {
  const [items, setItems] = useState<UpdateItem[]>([]);
  const [category, setCategory] = useState("general");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : ""), [file]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  async function load() {
    const response = await hospitalAuthFetch(`/api/hospital/hospitalizations/${hospitalizationId}/guardian-updates`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.message);
    setItems(result.updates ?? []);
  }

  useEffect(() => {
    void load().catch((error) => setNotice(error instanceof Error ? error.message : "경과 공유 기록을 불러오지 못했습니다."));
  }, [hospitalizationId]);

  async function uploadSelectedFile() {
    if (!file) return null;
    const formData = new FormData();
    formData.append("file", file);
    const response = await hospitalAuthFetch(
      `/api/hospital/hospitalizations/${hospitalizationId}/guardian-updates/upload`,
      { method: "POST", body: formData },
    );
    const result = await response.json();
    if (!response.ok) throw new Error(result.message);
    return String(result.storagePath);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setNotice("");
    try {
      const imageStoragePath = await uploadSelectedFile();
      const response = await hospitalAuthFetch(`/api/hospital/hospitalizations/${hospitalizationId}/guardian-updates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, title, message, imageStoragePath }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setTitle("");
      setMessage("");
      setFile(null);
      setNotice(result.message);
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "보호자 경과 공유에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function retract(updateId: number) {
    if (!window.confirm("이 기록의 보호자 공개를 철회할까요?")) return;
    const response = await hospitalAuthFetch(
      `/api/hospital/hospitalizations/${hospitalizationId}/guardian-updates?updateId=${updateId}`,
      { method: "DELETE" },
    );
    const result = await response.json();
    setNotice(result.message);
    if (response.ok) await load();
  }

  return (
    <section className="mt-5 border border-slate-300 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-300 px-4 py-3">
        <div>
          <p className="text-xs font-black tracking-[0.16em] text-slate-500">REALTIME GUARDIAN UPDATE</p>
          <h2 className="mt-1 text-lg font-black">보호자 입원 경과 실시간 공유</h2>
        </div>
        <p className="text-xs text-slate-500">공개 기록 {items.filter((item) => !item.retracted_at).length}건</p>
      </div>

      <div className="grid xl:grid-cols-[1fr_1.1fr]">
        <form onSubmit={submit} className="space-y-3 border-b border-slate-300 p-4 xl:border-b-0 xl:border-r">
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="mb-1 block text-xs font-bold">종류</span>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full border border-slate-300 px-3 py-3">
                <option value="general">일반 경과</option>
                <option value="meal">식사</option>
                <option value="medication">투약</option>
                <option value="condition">상태</option>
                <option value="procedure">처치</option>
                <option value="discharge">퇴원 안내</option>
              </select>
            </label>
            <label>
              <span className="mb-1 block text-xs font-bold">제목</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} className="w-full border border-slate-300 px-3 py-3" placeholder="예: 오후 식사 완료" />
            </label>
          </div>

          <label>
            <span className="mb-1 block text-xs font-bold">보호자 안내 내용</span>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} rows={4} className="w-full border border-slate-300 px-3 py-3" placeholder="의료진이 확인한 사실을 보호자가 이해하기 쉬운 문장으로 작성해 주세요." />
          </label>

          <label>
            <span className="mb-1 block text-xs font-bold">사진 첨부 <span className="font-normal text-slate-400">(선택, 최대 10MB)</span></span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="block w-full border border-slate-300 bg-white px-3 py-3 text-sm"
            />
          </label>

          {previewUrl && (
            <div className="border border-slate-200 bg-slate-50 p-2">
              <img src={previewUrl} alt="첨부 사진 미리보기" className="max-h-56 w-full object-contain" />
              <button type="button" onClick={() => setFile(null)} className="mt-2 text-xs font-bold text-red-700">사진 제거</button>
            </div>
          )}

          <p className="border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
            등록 즉시 보호자의 입원 경과 화면에 표시됩니다. 병원 내부 메모나 공개하면 안 되는 개인정보는 입력하지 마세요.
          </p>
          {notice && <p className="border border-slate-300 bg-slate-50 p-3 text-sm font-semibold">{notice}</p>}
          <button disabled={saving} className="w-full bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:opacity-50">
            {saving ? "사진 업로드 및 공유 중..." : "보호자에게 실시간 공유"}
          </button>
        </form>

        <div className="max-h-[560px] overflow-y-auto p-4">
          {items.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-500">공유한 입원 경과가 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <article key={item.id} className={`border p-4 ${item.retracted_at ? "border-slate-200 bg-slate-50 opacity-60" : "border-slate-300"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="bg-cyan-100 px-2 py-1 text-[11px] font-black text-cyan-800">{categoryLabel[item.category] ?? item.category}</span>
                      <h3 className="mt-2 font-black">{item.title}</h3>
                      <p className="mt-1 text-xs text-slate-500">{new Date(item.published_at).toLocaleString("ko-KR")}</p>
                    </div>
                    {!item.retracted_at && <button type="button" onClick={() => void retract(item.id)} className="text-xs font-bold text-red-700">공개 철회</button>}
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{item.message}</p>
                  {item.image_url && <img src={item.image_url} alt="보호자 공유 사진" className="mt-3 max-h-72 w-full border border-slate-200 object-contain" />}
                  {item.retracted_at && <p className="mt-3 text-xs font-bold text-slate-500">보호자 공개 철회됨</p>}
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
