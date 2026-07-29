"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Announcement = { id: number; title: string; content: string; level: string; published_at: string };
type Feedback = { id: number; category: string; severity: string; title: string; status: string; created_at: string; operator_note: string | null };

const STATUS: Record<string, string> = { received: "접수", reviewing: "검토 중", planned: "반영 예정", resolved: "처리 완료", closed: "종료" };
const CATEGORY: Record<string, string> = { bug: "오류", improvement: "개선 제안", question: "문의", data: "데이터", other: "기타" };

export default function BetaCenterPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function request(method: "GET" | "POST", body?: unknown) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("로그인이 필요합니다.");
    const response = await fetch("/api/hospital/beta-center", {
      method,
      headers: { authorization: `Bearer ${token}`, ...(body ? { "content-type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.success) throw new Error(result?.error?.message ?? "요청을 처리하지 못했습니다.");
    return result.data;
  }

  async function load() {
    setLoading(true);
    try {
      const data = await request("GET");
      setAnnouncements(data.announcements ?? []);
      setFeedback(data.feedback ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "정보를 불러오지 못했습니다.");
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  async function submit(formData: FormData) {
    setSending(true);
    setMessage("");
    try {
      await request("POST", {
        category: formData.get("category"), severity: formData.get("severity"),
        title: formData.get("title"), description: formData.get("description"),
        pageUrl: window.location.href, browserInfo: navigator.userAgent,
      });
      setMessage("의견이 접수되었습니다. 처리 상태는 아래 목록에서 확인할 수 있습니다.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "접수하지 못했습니다.");
    } finally { setSending(false); }
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 lg:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <header><p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-600">PAWU V9.4 · Beta Operations</p><h1 className="mt-1 text-2xl font-black">베타 운영센터</h1><p className="mt-1 text-sm text-slate-500">공지 확인, 오류 신고, 개선 제안과 처리 상태를 한곳에서 관리합니다.</p></header>
        {message && <div className="border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-800">{message}</div>}

        <section className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
          <article className="border border-slate-300 bg-white p-5"><h2 className="font-black">베타 공지</h2><div className="mt-4 space-y-3">
            {announcements.map((item) => <div key={item.id} className="border border-slate-200 p-4"><div className="flex items-center justify-between gap-3"><p className="font-bold">{item.title}</p><span className="text-xs text-slate-500">{new Date(item.published_at).toLocaleDateString("ko-KR")}</span></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{item.content}</p></div>)}
            {!loading && announcements.length === 0 && <p className="py-8 text-center text-sm text-slate-500">현재 공지가 없습니다.</p>}
          </div></article>

          <form action={submit} className="border border-slate-300 bg-white p-5"><h2 className="font-black">오류·개선 의견 접수</h2><p className="mt-1 text-xs text-slate-500">개인정보와 진료정보는 입력하지 말고 기능 현상만 작성해 주세요.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-bold">분류<select name="category" className="mt-1 w-full border border-slate-300 px-3 py-2 font-normal" defaultValue="bug"><option value="bug">오류</option><option value="improvement">개선 제안</option><option value="question">문의</option><option value="data">데이터 문제</option><option value="other">기타</option></select></label><label className="text-sm font-bold">중요도<select name="severity" className="mt-1 w-full border border-slate-300 px-3 py-2 font-normal" defaultValue="normal"><option value="low">낮음</option><option value="normal">보통</option><option value="high">높음</option><option value="critical">업무 중단</option></select></label></div>
            <label className="mt-3 block text-sm font-bold">제목<input required minLength={2} maxLength={120} name="title" className="mt-1 w-full border border-slate-300 px-3 py-2 font-normal" placeholder="예: 예약 승인 버튼을 눌러도 상태가 바뀌지 않음" /></label>
            <label className="mt-3 block text-sm font-bold">상세 내용<textarea required minLength={5} maxLength={5000} name="description" rows={7} className="mt-1 w-full border border-slate-300 px-3 py-2 font-normal" placeholder="발생 순서, 기대한 결과, 실제 결과를 적어 주세요." /></label>
            <button disabled={sending} className="mt-4 bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{sending ? "접수 중..." : "의견 접수"}</button>
          </form>
        </section>

        <section className="border border-slate-300 bg-white"><div className="border-b border-slate-200 px-5 py-4"><h2 className="font-black">내 병원 접수 내역</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-5 py-3">접수일</th><th className="px-5 py-3">분류</th><th className="px-5 py-3">제목</th><th className="px-5 py-3">중요도</th><th className="px-5 py-3">상태</th><th className="px-5 py-3">운영 답변</th></tr></thead><tbody>{feedback.map((item) => <tr key={item.id} className="border-t border-slate-100"><td className="px-5 py-3">{new Date(item.created_at).toLocaleDateString("ko-KR")}</td><td className="px-5 py-3">{CATEGORY[item.category] ?? item.category}</td><td className="px-5 py-3 font-semibold">{item.title}</td><td className="px-5 py-3">{item.severity}</td><td className="px-5 py-3"><span className="bg-slate-100 px-2 py-1 text-xs font-bold">{STATUS[item.status] ?? item.status}</span></td><td className="max-w-[320px] px-5 py-3 text-slate-600">{item.operator_note ?? "-"}</td></tr>)}</tbody></table>{!loading && feedback.length === 0 && <p className="py-10 text-center text-sm text-slate-500">아직 접수한 의견이 없습니다.</p>}</div></section>
      </div>
    </main>
  );
}
