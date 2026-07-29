"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Review = {
  id: number; reservationId: number; petName: string; petSpecies: string | null; guardianName: string;
  visitDate: string; title: string | null; content: string; imageUrls: string[];
  hospitalReply: string | null; hospitalRepliedAt: string | null; createdAt: string; isMine: boolean;
};
type Eligible = { id: number; pet_id: number; reservation_date: string; pets: { name: string; species: string | null } | { name: string; species: string | null }[] | null };

function petEmoji(species: string | null) { return species === "cat" ? "🐱" : species === "dog" ? "🐶" : "🐾"; }
function formatDate(value: string) { return new Date(value).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" }); }

export default function HospitalVisitReviews({ hospitalId }: { hospitalId: number }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [eligible, setEligible] = useState<Eligible[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [reservationId, setReservationId] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const previews = useMemo(() => images.map((file) => ({ file, url: URL.createObjectURL(file) })), [images]);

  useEffect(() => () => previews.forEach((item) => URL.revokeObjectURL(item.url)), [previews]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`/api/reviews?hospitalId=${hospitalId}`, { headers: session ? { Authorization: `Bearer ${session.access_token}` } : undefined, cache: "no-store" });
    const result = await response.json();
    if (response.ok) { setReviews(result.reviews ?? []); setEligible(result.eligibleReservations ?? []); }
    setLoading(false);
  }, [hospitalId]);

  useEffect(() => { void load(); }, [load]);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setMessage(""); setSubmitting(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setMessage("로그인 후 작성할 수 있습니다."); setSubmitting(false); return; }
    const form = new FormData(); form.append("reservationId", reservationId); form.append("title", title); form.append("content", content); images.forEach((file) => form.append("images", file));
    const response = await fetch("/api/reviews", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` }, body: form });
    const result = await response.json(); setMessage(result.message ?? "");
    if (response.ok) { setOpen(false); setReservationId(""); setTitle(""); setContent(""); setImages([]); await load(); }
    setSubmitting(false);
  }

  async function remove(reviewId: number) {
    if (!confirm("이 후기를 삭제할까요?")) return;
    const { data: { session } } = await supabase.auth.getSession(); if (!session) return;
    const response = await fetch(`/api/reviews?reviewId=${reviewId}`, { method: "DELETE", headers: { Authorization: `Bearer ${session.access_token}` } });
    if (response.ok) await load();
  }

  return (
    <section className="rounded-[28px] border border-[#dfe5e1] bg-white p-5 shadow-sm sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-xs font-black tracking-[0.18em] text-[#ff725e]">VISIT STORIES</p><h2 className="mt-1 text-xl font-black text-[#143b34]">보호자 방문 후기</h2><p className="mt-2 text-sm leading-6 text-[#6d7e79]">별점 없이 실제 방문 경험과 사진을 나눕니다.</p></div>
        {eligible.length > 0 && <button onClick={() => setOpen(true)} className="shrink-0 rounded-2xl bg-[#173f37] px-4 py-3 text-sm font-black text-white">후기 작성</button>}
      </div>

      {message && <p className="mt-4 rounded-2xl bg-[#f2f6f4] px-4 py-3 text-sm font-bold text-[#345b52]">{message}</p>}
      {loading ? <p className="mt-6 text-sm text-[#788883]">후기를 불러오는 중입니다.</p> : reviews.length === 0 ? <p className="mt-6 rounded-2xl bg-[#f6f7f3] px-4 py-5 text-sm text-[#788883]">아직 등록된 방문 후기가 없습니다.</p> : (
        <div className="mt-6 space-y-4">
          {reviews.map((review) => <article key={review.id} className="rounded-3xl border border-[#e2e8e4] p-5">
            <div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-[#e5f5ef] px-2.5 py-1 text-xs font-black text-[#17604e]">실제 방문 확인</span><span className="text-sm font-black text-[#173f37]">{petEmoji(review.petSpecies)} {review.petName}</span></div><p className="mt-2 text-xs text-[#81908c]">{review.guardianName} · {formatDate(review.visitDate)} 방문</p></div>{review.isMine && <button onClick={() => void remove(review.id)} className="text-xs font-bold text-[#a66b63]">삭제</button>}</div>
            {review.title && <h3 className="mt-4 text-base font-black text-[#173f37]">{review.title}</h3>}
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#526863]">{review.content}</p>
            {review.imageUrls.length > 0 && <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">{review.imageUrls.map((url) => <a key={url} href={url} target="_blank" rel="noreferrer"><img src={url} alt="방문 후기 사진" className="aspect-square w-full rounded-2xl object-cover" /></a>)}</div>}
            {review.hospitalReply && <div className="mt-4 rounded-2xl bg-[#f1f7f4] px-4 py-4"><p className="text-xs font-black text-[#17604e]">병원 답글</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#526863]">{review.hospitalReply}</p></div>}
          </article>)}
        </div>
      )}

      {open && <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/45 sm:items-center sm:p-6" onMouseDown={(e) => e.currentTarget === e.target && setOpen(false)}><form onSubmit={submit} className="max-h-[92vh] w-full overflow-y-auto rounded-t-[28px] bg-white p-5 sm:max-w-xl sm:rounded-[28px] sm:p-7">
        <div className="flex items-center justify-between"><h3 className="text-xl font-black text-[#143b34]">방문 후기 작성</h3><button type="button" onClick={() => setOpen(false)} className="h-10 w-10 rounded-full bg-[#eef4f1] text-xl font-black">×</button></div>
        <label className="mt-5 block text-sm font-black">방문 기록<select required value={reservationId} onChange={(e) => setReservationId(e.target.value)} className="mt-2 min-h-12 w-full rounded-2xl border border-[#dce5e0] px-4"><option value="">선택해 주세요</option>{eligible.map((row) => { const pet = Array.isArray(row.pets) ? row.pets[0] : row.pets; return <option key={row.id} value={row.id}>{row.reservation_date} · {pet?.name ?? "반려동물"}</option>; })}</select></label>
        <label className="mt-4 block text-sm font-black">제목 <span className="font-medium text-[#8a9894]">(선택)</span><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} className="mt-2 min-h-12 w-full rounded-2xl border border-[#dce5e0] px-4" placeholder="후기의 제목을 입력해 주세요" /></label>
        <label className="mt-4 block text-sm font-black">후기 내용<textarea required minLength={5} maxLength={3000} value={content} onChange={(e) => setContent(e.target.value)} className="mt-2 min-h-36 w-full rounded-2xl border border-[#dce5e0] p-4" placeholder="진료와 방문 경험을 자유롭게 남겨 주세요." /></label>
        <label className="mt-4 block text-sm font-black">사진 <span className="font-medium text-[#8a9894]">(최대 5장)</span><input type="file" accept="image/*" multiple onChange={(e) => setImages(Array.from(e.target.files ?? []).slice(0, 5))} className="mt-2 block w-full text-sm" /></label>
        {previews.length > 0 && <div className="mt-3 grid grid-cols-3 gap-2">{previews.map(({ file, url }) => <img key={file.name + url} src={url} alt="미리보기" className="aspect-square w-full rounded-2xl object-cover" />)}</div>}
        <button disabled={submitting} className="mt-6 min-h-14 w-full rounded-2xl bg-[#ff725e] font-black text-white disabled:opacity-50">{submitting ? "등록 중..." : "후기 등록"}</button>
      </form></div>}
    </section>
  );
}
