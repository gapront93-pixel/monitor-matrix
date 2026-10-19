import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

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

const VERDICT = {
  lead: { label: "GIGABYTE dẫn đầu", cls: "border-best-line bg-best-bg text-best" },
  even: { label: "Ngang", cls: "border-line bg-seg-sel text-fg-2" },
  weak: { label: "Yếu hơn", cls: "border-warn-line bg-warn-bg text-warn" },
} as const;

export type Verdict = keyof typeof VERDICT;

export function VerdictTag({ verdict, className }: { verdict: Verdict | null; className?: string }) {
  if (!verdict) return null;
  const v = VERDICT[verdict];
  return (
    <span className={cn("inline-flex h-[22px] items-center rounded-chip border px-2 text-[12px] font-semibold whitespace-nowrap", v.cls, className)}>
      {v.label}
    </span>
  );
}

export function verdictDot(verdict: Verdict | null): string {
  return verdict === "lead" ? "bg-best" : verdict === "weak" ? "bg-warn" : "bg-fg-2";
}
