"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import type { PlatformDashboard } from "../../../lib/v7-platform-types";

const money=(n:number)=>`${Number(n||0).toLocaleString("ko-KR")}원`;
export default function PlatformPage(){
 const [data,setData]=useState<PlatformDashboard|null>(null); const [error,setError]=useState("");
 async function load(){ const {data:s}=await supabase.auth.getSession(); const token=s.session?.access_token; if(!token)return;
  const r=await fetch("/api/hospital/platform/dashboard",{headers:{authorization:`Bearer ${token}`}}); const j=await r.json(); if(!r.ok){setError(j.message??"불러오기 실패");return;} setData(j.data); }
 useEffect(()=>{void load()},[]);
 const cards=[
  ["오늘 예약",data?.counts.todayReservations??0,"건"],["대기 환자",data?.counts.waitingPatients??0,"명"],["입원 환자",data?.counts.activeInpatients??0,"명"],["오늘 수술",data?.counts.todaySurgeries??0,"건"],
  ["오늘 수납",money(data?.finance.todayPaid??0),""],["오늘 미수금",money(data?.finance.todayOutstanding??0),""],["월 수납",money(data?.finance.monthPaid??0),""],["재고 경고",data?.counts.openInventoryAlerts??0,"건"],
 ];
 return <main className="p-4 lg:p-6"><div className="mx-auto max-w-[1600px]">
  <header className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-slate-300 pb-4"><div><p className="text-xs font-bold text-slate-500">PAWU PLATFORM V7.0.0</p><h1 className="mt-1 text-2xl font-black">통합 운영 센터</h1><p className="mt-2 text-sm text-slate-500">예약부터 수납·입원·수술·재고·보안까지 병원 운영 상태를 한 화면에서 확인합니다.</p></div><div className="flex gap-2"><Link href="/hospital-admin/audit-logs" className="border border-slate-400 bg-white px-4 py-2 text-sm font-bold">감사 로그</Link><a href="/api/hospital/platform/export" onClick={async(e)=>{e.preventDefault();const {data:s}=await supabase.auth.getSession();const token=s.session?.access_token;if(!token)return;const r=await fetch("/api/hospital/platform/export",{headers:{authorization:`Bearer ${token}`}});if(!r.ok){setError((await r.json()).message);return;}const b=await r.blob();const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download=`pawu-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(u);}} className="border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-bold text-white">데이터 내보내기</a></div></header>
  {error&&<div className="mb-4 border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
  <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([l,v,s])=><article key={String(l)} className="border border-slate-300 bg-white p-4"><p className="text-xs font-bold text-slate-500">{l}</p><p className="mt-2 text-2xl font-black">{v}<span className="ml-1 text-xs text-slate-500">{s}</span></p></article>)}</section>
  <section className="mt-5 grid gap-4 xl:grid-cols-[1.4fr_1fr]"><article className="border border-slate-300 bg-white"><div className="border-b border-slate-200 px-4 py-3"><h2 className="font-black">최근 중요 작업</h2></div><div className="divide-y divide-slate-200">{(data?.recentAudit??[]).map(x=><div key={x.id} className="px-4 py-3"><div className="flex justify-between gap-3"><p className="text-sm font-bold">{x.summary}</p><span className="text-[11px] text-slate-500">{new Date(x.created_at).toLocaleString("ko-KR")}</span></div><p className="mt-1 text-xs text-slate-500">{x.action} · {x.actor_role??"system"}</p></div>)}{data&&data.recentAudit.length===0&&<p className="p-6 text-sm text-slate-500">기록이 없습니다.</p>}</div></article>
  <article className="border border-slate-300 bg-white p-4"><h2 className="font-black">보안·운영 상태</h2><div className="mt-4 space-y-3 text-sm"><p className="flex justify-between"><span>치명적 재고 경고</span><b>{data?.alerts.critical??0}건</b></p><p className="flex justify-between"><span>주의 경고</span><b>{data?.alerts.warning??0}건</b></p><p className="flex justify-between"><span>중요 감사 이벤트</span><b>{data?.alerts.unreadAudit??0}건</b></p></div><Link href="/hospital-admin/staff" className="mt-5 block border border-slate-900 bg-slate-900 px-4 py-2 text-center text-sm font-bold text-white">직원·권한 관리</Link></article></section>
 </div></main>;
}
