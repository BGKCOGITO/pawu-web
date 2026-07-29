"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type Guide = {
  level: "emergency" | "urgent" | "observe";
  title: string;
  actions: string[];
  disclaimer: string;
};

export default function AiCarePage() {
  const [species, setSpecies] = useState("dog");
  const [symptomText, setSymptomText] = useState("");
  const [guide, setGuide] = useState<Guide | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setGuide(null);
    setErrorMessage("");

    const response = await fetch("/api/ai/symptom-guide", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ species, symptomText }),
    });

    const result = (await response.json()) as {
      guide?: Guide;
      message?: string;
    };

    if (!response.ok || !result.guide) {
      setErrorMessage(result.message ?? "안내를 만들지 못했습니다.");
    } else {
      setGuide(result.guide);
    }

    setLoading(false);
  }

  const panelClass =
    guide?.level === "emergency"
      ? "border-red-300 bg-red-50"
      : guide?.level === "urgent"
        ? "border-orange-300 bg-orange-50"
        : "border-blue-200 bg-blue-50";

  return (
    <main className="min-h-screen bg-gray-50 px-5 py-8 text-black">
      <div className="mx-auto max-w-3xl">
        <div className="flex justify-between gap-3">
          <Link href="/" className="rounded-xl border bg-white px-4 py-2 text-sm">← 홈</Link>
          <Link href="/map" className="rounded-xl bg-black px-4 py-2 text-sm text-white">병원 찾기</Link>
        </div>

        <header className="mt-8">
          <p className="text-sm text-gray-500">PAWU AI Care · 안전 안내 V1</p>
          <h1 className="mt-2 text-3xl font-black">증상 정리 도우미</h1>
          <p className="mt-3 text-sm leading-6 text-gray-600">
            증상을 정리하고 병원 상담 시점을 안내합니다. 진단이나 처방은 제공하지 않습니다.
          </p>
        </header>

        <form onSubmit={submit} className="mt-8 rounded-3xl border bg-white p-6">
          <label className="block text-sm font-semibold">
            반려동물
            <select value={species} onChange={(e) => setSpecies(e.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3">
              <option value="dog">강아지</option>
              <option value="cat">고양이</option>
              <option value="other">기타</option>
            </select>
          </label>

          <label className="mt-5 block text-sm font-semibold">
            현재 증상
            <textarea
              value={symptomText}
              onChange={(e) => setSymptomText(e.target.value)}
              rows={7}
              placeholder="예: 오늘 오후부터 두 번 토했고 평소보다 기운이 없어요. 물은 조금 마셔요."
              className="mt-2 w-full rounded-2xl border px-4 py-3"
            />
          </label>

          <button disabled={loading} className="mt-5 w-full rounded-2xl bg-black px-5 py-4 font-bold text-white disabled:bg-gray-400">
            {loading ? "정리 중..." : "안전 안내 확인"}
          </button>
        </form>

        {errorMessage && <p className="mt-5 rounded-2xl bg-red-50 p-4 text-sm text-red-700">{errorMessage}</p>}

        {guide && (
          <section className={`mt-6 rounded-3xl border p-6 ${panelClass}`}>
            <p className="text-xs font-bold uppercase tracking-wide">
              {guide.level === "emergency" ? "응급 신호" : guide.level === "urgent" ? "빠른 상담 권장" : "관찰 및 상담 준비"}
            </p>
            <h2 className="mt-2 text-2xl font-black">{guide.title}</h2>
            <ul className="mt-5 space-y-3 text-sm leading-6">
              {guide.actions.map((action) => <li key={action}>• {action}</li>)}
            </ul>
            <p className="mt-5 border-t border-black/10 pt-4 text-xs leading-5">{guide.disclaimer}</p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Link href="/map" className="rounded-xl bg-black px-4 py-3 text-center text-sm font-bold text-white">가까운 병원 찾기</Link>
              <Link href="/my-reservations" className="rounded-xl border border-black px-4 py-3 text-center text-sm font-bold">내 예약 확인</Link>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
