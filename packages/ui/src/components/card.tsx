import { clsx } from "clsx";
import type { ReactNode } from "react";

type CardProps = {
  eyebrow?: string;
  title?: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
};

export const Card = ({
  eyebrow,
  title,
  description,
  actions,
  className,
  children,
}: CardProps) => (
  <section
    className={clsx(
      "rounded-[28px] border border-white/10 bg-white/6 p-5 shadow-[0_25px_90px_-55px_rgba(255,130,56,0.85)] backdrop-blur-xl",
      className,
    )}
  >
    {(eyebrow || title || description || actions) && (
      <header className="mb-4 flex items-start justify-between gap-4">
        <div className="space-y-1">
          {eyebrow ? (
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-orange-200/80">
              {eyebrow}
            </p>
          ) : null}
          {title ? <h3 className="text-lg font-semibold text-stone-100">{title}</h3> : null}
          {description ? (
            <p className="max-w-2xl text-sm leading-6 text-stone-300/75">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </header>
    )}
    {children}
  </section>
);
