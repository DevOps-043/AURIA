import { clsx } from "clsx";

export type ProgressTone = "warm" | "sky" | "mint" | "rose";

const toneClassNames: Record<ProgressTone, string> = {
  warm: "from-orange-300 via-amber-200 to-yellow-200",
  sky: "from-sky-300 via-cyan-200 to-blue-200",
  mint: "from-emerald-300 via-teal-200 to-lime-200",
  rose: "from-rose-300 via-orange-200 to-amber-100",
};

type ProgressBarProps = {
  value: number;
  max?: number;
  tone?: ProgressTone;
};

export const ProgressBar = ({
  value,
  max = 100,
  tone = "warm",
}: ProgressBarProps) => {
  const ratio = Math.max(0, Math.min(100, (value / max) * 100));

  return (
    <div className="h-2 rounded-full bg-stone-900/70">
      <div
        className={clsx(
          "h-full rounded-full bg-gradient-to-r transition-[width] duration-300",
          toneClassNames[tone],
        )}
        style={{ width: `${ratio}%` }}
      />
    </div>
  );
};
