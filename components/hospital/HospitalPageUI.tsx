import Link from "next/link";
import type { ReactNode } from "react";

export function HospitalPage({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="px-4 py-5 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-[1680px]">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-300 pb-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{eyebrow}</p>
            <h1 className="mt-1 text-2xl font-black">{title}</h1>
            <p className="mt-2 text-sm text-slate-500">{description}</p>
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </header>
        {children}
      </div>
    </main>
  );
}

export function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border border-slate-300 bg-white px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-black">{value}</p>
      {sub && <p className="mt-1 text-[11px] text-slate-500">{sub}</p>}
    </div>
  );
}

export function StatusBadge({ value }: { value?: string | null }) {
  const labels: Record<string, string> = {
    requested: "승인 대기", approved: "예약 확정", rejected: "예약 거절",
    cancelled: "취소", in_progress: "진료 중", completed: "진료 완료",
    no_show: "노쇼", draft: "작성 중", finalized: "확정",
  };
  return (
    <span className="inline-flex border border-slate-300 bg-slate-50 px-2 py-1 text-[11px] font-bold">
      {value ? labels[value] ?? value : "-"}
    </span>
  );
}

export function ActionLink({ href, children, primary = false }: { href: string; children: ReactNode; primary?: boolean }) {
  return (
    <Link href={href} className={primary
      ? "border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-bold text-white"
      : "border border-slate-400 bg-white px-4 py-2 text-sm font-semibold"}>
      {children}
    </Link>
  );
}
