import type { ReactNode } from "react";

type AdminHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
};

export default function AdminHeader({
  eyebrow = "PAWU 관리자",
  title,
  description,
  action,
}: AdminHeaderProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-bold tracking-wide text-slate-500 sm:text-sm">
          {eyebrow}
        </p>

        <h1 className="mt-1.5 text-2xl font-black leading-tight tracking-tight text-slate-950 sm:text-3xl">
          {title}
        </h1>

        {description && (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            {description}
          </p>
        )}
      </div>

      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
