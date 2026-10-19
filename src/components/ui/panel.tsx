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
    <div className={cn("mb-4 flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
        <h1 className="text-[22px] leading-tight font-bold text-balance text-fg">{title}</h1>
        {sub && <div className="mt-1 text-[12.5px] text-muted">{sub}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export { VerdictTag, type Verdict } from "./verdict-tag";

export function verdictDot(verdict: Verdict | null): string {
  return verdict === "lead" ? "bg-best" : verdict === "weak" ? "bg-warn" : "bg-fg-2";
}
