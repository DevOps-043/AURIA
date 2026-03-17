import { clsx } from "clsx";
import type { ReactNode } from "react";
import { ProgressBar, type ProgressTone } from "./progress-bar";

type StatCardProps = {
  label: string;
  value: string;
  detail: string;
  progressValue?: number;
  progressTone?: ProgressTone;
  icon?: ReactNode;
  className?: string;
};

export const StatCard = ({
  label,
  value,
  detail,
  progressValue,
  progressTone = "warm",
  icon,
  className,
}: StatCardProps) => (
  <article
    className={clsx(
      "rounded-[24px] border border-white/10 bg-stone-950/55 p-4 shadow-[0_20px_70px_-45px_rgba(0,0,0,0.9)]",
      className,
    )}
  >
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.24em] text-stone-400">{label}</p>
        <p className="text-2xl font-semibold tracking-tight text-stone-50">{value}</p>
      </div>
      {icon ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-2 text-orange-200">
          {icon}
        </div>
      ) : null}
    </div>
    <p className="mt-2 text-sm leading-6 text-stone-300/70">{detail}</p>
    {typeof progressValue === "number" ? (
      <div className="mt-4">
        <ProgressBar tone={progressTone} value={progressValue} />
      </div>
    ) : null}
  </article>
);
