import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

import type { Verdict } from "./verdict-tag";

export function Panel({ className, ...props }: ComponentProps<"section">) {
  return <section className={cn("rounded-panel border border-line bg-panel", className)} {...props} />;
}

/** Page title block: eyebrow, H1, optional sub line and actions on the right */
export function PageHeader({
  eyebrow,
  title,
  sub,
  actions,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    // The page-title style of the import page: gradient eyebrow, Aldrich VN heading, 15px subline
    <div className={cn("mb-5 flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="flex min-w-0 flex-col gap-1.5">
        {eyebrow && (
          <span className="w-fit bg-(image:--infinity-gradient) bg-clip-text font-aldrich text-[14px] font-semibold tracking-[0.18em] text-transparent uppercase">
            {eyebrow}
          </span>
        )}
        <h1 className="font-aldrich text-[30px] leading-[1.15] tracking-[0.01em] text-balance text-fg md:text-[44px]">{title}</h1>
        {sub && <div className="text-[15px] text-muted">{sub}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export { VerdictTag, type Verdict } from "./verdict-tag";

export function verdictDot(verdict: Verdict | null): string {
  return verdict === "lead" ? "bg-best" : verdict === "weak" ? "bg-warn" : "bg-fg-2";
}
