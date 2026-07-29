"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export default function SystemMonitorRefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
      className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
    >
      {pending ? "점검 중..." : "지금 다시 점검"}
    </button>
  );
}
