import Link from "next/link";
import AdminHeader from "@/components/admin/AdminHeader";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export default async function BetaOperationsPage() {
  const [feedbackResult, announcementsResult] = await Promise.all([
    supabaseAdmin.from("beta_feedback").select("id,hospital_id,category,severity,title,status,created_at,reporter_email").order("created_at", { ascending: false }).limit(100),
    supabaseAdmin.from("beta_announcements").select("id,title,level,is_published,published_at").order("published_at", { ascending: false }).limit(20),
  ]);
  const rows = feedbackResult.data ?? [];
  const open = rows.filter((row) => !["resolved", "closed"].includes(String(row.status))).length;
  const critical = rows.filter((row) => row.severity === "critical" && !["resolved", "closed"].includes(String(row.status))).length;

  return <div><AdminHeader title="베타 운영센터" description="베타 병원의 오류·개선 요청과 공지를 관리합니다." action={<Link href="/admin" className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white">관리자 홈</Link>} />
    <section className="mt-8 grid gap-4 sm:grid-cols-3"><Card label="최근 접수" value={rows.length} /><Card label="미처리" value={open} /><Card label="업무 중단" value={critical} danger /></section>
    {(feedbackResult.error || announcementsResult.error) && <div className="mt-6 border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">V9.4 SQL을 먼저 실행해 주세요.</div>}
    <section className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white"><div className="border-b border-slate-100 px-6 py-5"><h2 className="font-black">최근 의견 100건</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-5 py-3">접수일</th><th className="px-5 py-3">병원</th><th className="px-5 py-3">분류</th><th className="px-5 py-3">중요도</th><th className="px-5 py-3">제목</th><th className="px-5 py-3">상태</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t border-slate-100"><td className="px-5 py-3">{new Date(row.created_at).toLocaleString("ko-KR")}</td><td className="px-5 py-3">#{row.hospital_id}</td><td className="px-5 py-3">{row.category}</td><td className={row.severity === "critical" ? "px-5 py-3 font-black text-red-700" : "px-5 py-3"}>{row.severity}</td><td className="px-5 py-3 font-semibold">{row.title}</td><td className="px-5 py-3">{row.status}</td></tr>)}</tbody></table>{rows.length === 0 && <p className="py-12 text-center text-sm text-slate-500">접수된 의견이 없습니다.</p>}</div></section>
    <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6"><h2 className="font-black">운영 공지</h2><p className="mt-2 text-sm text-slate-500">현재 등록된 공지 {announcementsResult.data?.length ?? 0}건입니다. 공지 등록·수정은 이번 버전에서 Supabase Table Editor를 사용합니다.</p></section>
  </div>;
}
function Card({ label, value, danger }: { label: string; value: number; danger?: boolean }) { return <div className={`rounded-3xl border bg-white p-5 ${danger ? "border-red-300" : "border-slate-200"}`}><p className="text-sm font-bold text-slate-500">{label}</p><p className={`mt-2 text-3xl font-black ${danger ? "text-red-700" : "text-slate-950"}`}>{value}</p></div>; }
