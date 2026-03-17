import type { ReactNode } from "react";

type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
};

export const SectionHeading = ({
  eyebrow,
  title,
  description,
  actions,
}: SectionHeadingProps) => (
  <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
    <div className="space-y-3">
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.3em] text-orange-200/70">
        {eyebrow}
      </p>
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-stone-50">{title}</h1>
        <p className="max-w-3xl text-sm leading-7 text-stone-300/80">{description}</p>
      </div>
    </div>
    {actions ? <div className="shrink-0">{actions}</div> : null}
  </div>
);
