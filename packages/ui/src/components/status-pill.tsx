import { clsx } from "clsx";

export type PillTone = "neutral" | "info" | "success" | "warning" | "danger";

const toneClassNames: Record<PillTone, string> = {
  neutral: "border-white/10 bg-white/8 text-stone-100",
  info: "border-sky-300/30 bg-sky-400/10 text-sky-100",
  success: "border-emerald-300/30 bg-emerald-400/10 text-emerald-100",
  warning: "border-amber-300/30 bg-amber-400/10 text-amber-100",
  danger: "border-rose-300/30 bg-rose-400/10 text-rose-100",
};

type StatusPillProps = {
  label: string;
  tone?: PillTone;
};

export const StatusPill = ({
  label,
  tone = "neutral",
}: StatusPillProps) => (
  <span
    className={clsx(
      "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
      toneClassNames[tone],
    )}
  >
    {label}
  </span>
);
