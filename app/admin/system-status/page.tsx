import Link from "next/link";
import SystemMonitorRefreshButton from "@/components/admin/SystemMonitorRefreshButton";
import { collectSystemMonitorSnapshot } from "@/lib/ops/system-monitor";

export const dynamic = "force-dynamic";

function statusLabel(status: "ok" | "warning" | "error") {
  if (status === "ok") return "정상";
  if (status === "warning") return "주의";
  return "오류";
}

function statusClass(status: "ok" | "warning" | "error") {
  if (status === "ok") return "bg-emerald-100 text-emerald-700";
  if (status === "warning") return "bg-amber-100 text-amber-800";
  return "bg-rose-100 text-rose-700";
}

export default async function SystemStatusPage() {
  const snapshot = await collectSystemMonitorSnapshot();

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 text-slate-950">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/admin/operations" className="text-sm font-bold text-slate-600">← 운영센터</Link>
            <h1 className="mt-4 text-3xl font-black">시스템 모니터</h1>
            <p className="mt-2 text-sm text-slate-600">서버, 데이터베이스, AI 설정과 주요 업무 테이블을 실시간 점검합니다.</p>
          </div>
          <SystemMonitorRefreshButton />
        </div>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-3xl border bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-slate-500">전체 상태</p>
            <div className="mt-3 flex items-center justify-between">
              <strong className="text-2xl">{statusLabel(snapshot.status)}</strong>
              <span className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(snapshot.status)}`}>V{snapshot.version}</span>
            </div>
          </article>
          <article className="rounded-3xl border bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-slate-500">점검 응답시간</p>
            <strong className="mt-3 block text-2xl">{snapshot.responseTimeMs.toLocaleString("ko-KR")}ms</strong>
          </article>
          <article className="rounded-3xl border bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-slate-500">서버 메모리</p>
            <strong className="mt-3 block text-2xl">{snapshot.process.rssMb.toLocaleString("ko-KR")}MB</strong>
            <p className="mt-1 text-xs text-slate-500">Heap {snapshot.process.heapUsedMb}/{snapshot.process.heapTotalMb}MB</p>
          </article>
          <article className="rounded-3xl border bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-slate-500">서버 가동시간</p>
            <strong className="mt-3 block text-2xl">{Math.floor(snapshot.process.uptimeSeconds / 60).toLocaleString("ko-KR")}분</strong>
            <p className="mt-1 text-xs text-slate-500">Node {snapshot.process.nodeVersion}</p>
          </article>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2">
          {snapshot.checks.map((item) => (
            <article key={item.key} className="rounded-3xl border bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-black">{item.label}</h2>
                  <p className="mt-2 break-words text-sm leading-6 text-slate-600">{item.detail}</p>
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${statusClass(item.status)}`}>
                  {statusLabel(item.status)}
                </span>
              </div>
              <p className="mt-4 text-xs text-slate-400">응답 {item.latencyMs.toLocaleString("ko-KR")}ms</p>
            </article>
          ))}
        </section>

        <section className="mt-6 rounded-3xl border border-blue-200 bg-blue-50 p-5 text-sm leading-6 text-blue-950">
          마지막 점검: {new Date(snapshot.checkedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}. 이 화면의 메모리와 가동시간은 현재 Next.js 실행 프로세스 기준이며, 서버리스 배포 환경에서는 인스턴스마다 값이 달라질 수 있습니다.
        </section>
      </div>
    </main>
  );
}
