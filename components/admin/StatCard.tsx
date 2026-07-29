type StatCardProps = {
  label: string;
  value: number | string;
  description?: string;
  icon?: string;
  tone?: "default" | "green" | "blue" | "amber" | "red";
};

const toneClasses = {
  default: "bg-slate-100 text-slate-700",
  green: "bg-emerald-100 text-emerald-700",
  blue: "bg-blue-100 text-blue-700",
  amber: "bg-amber-100 text-amber-700",
  red: "bg-red-100 text-red-700",
};

export default function StatCard({
  label,
  value,
  description,
  icon = "•",
  tone = "default",
}: StatCardProps) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-500 sm:text-sm">
            {label}
          </p>

          <p className="mt-2 text-2xl font-black leading-none tracking-tight text-slate-950 sm:text-3xl">
            {typeof value === "number"
              ? value.toLocaleString("ko-KR")
              : value}
          </p>

          {description && (
            <p className="mt-2 text-xs leading-5 text-slate-500">
              {description}
            </p>
          )}
        </div>

        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-black ${toneClasses[tone]}`}
        >
          {icon}
        </span>
      </div>
    </article>
  );
}
