"use client";

import { useT } from "@/lib/i18n/client";
import { catalogMessages } from "@/lib/i18n/messages/catalog";
import { cn } from "@/lib/utils";

const CLS = {
  lead: "border-best-line bg-best-bg text-best",
  even: "border-line bg-seg-sel text-fg-2",
  weak: "border-warn-line bg-warn-bg text-warn",
} as const;

export type Verdict = keyof typeof CLS;

export function VerdictTag({ verdict, className }: { verdict: Verdict | null; className?: string }) {
  const t = useT(catalogMessages).verdict;
  if (!verdict) return null;
  return (
    <span className={cn("inline-flex h-[22px] items-center rounded-chip border px-2 text-[12px] font-semibold whitespace-nowrap", CLS[verdict], className)}>
      {t[verdict]}
    </span>
  );
}
