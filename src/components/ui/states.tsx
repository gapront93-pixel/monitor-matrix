import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Dashed box with "[ 0 ]", title, text and one action */
export function EmptyState({
  title,
  children,
  action,
  className,
}: {
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center rounded-box border border-dashed border-line-dashed px-6 py-12 text-center", className)}>
      <div className="num mb-3 text-[15px] text-faint">[ 0 ]</div>
      <div className="text-[15px] font-bold text-fg">{title}</div>
      {children && <p className="mt-1.5 max-w-[52ch] text-[12.5px] leading-relaxed text-muted">{children}</p>}
      {action && <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title,
  children,
  code,
  action,
}: {
  title: ReactNode;
  children?: ReactNode;
  code?: string;
  action?: ReactNode;
}) {
  return (
    <div role="alert" className="rounded-box border border-err-line bg-err-bg px-6 py-8">
      <div className="text-[15px] font-bold text-err-title">{title}</div>
      {children && <p className="mt-1.5 max-w-[70ch] text-[12.5px] leading-relaxed text-fg-2">{children}</p>}
      {code && <code className="num mt-3 block text-[11.5px] break-all text-muted">{code}</code>}
      {action && <div className="mt-4 flex flex-wrap gap-2">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-chip bg-row-a", className)} />;
}

/** "Đang tải …" + 4 card skeletons + 9 striped rows, as in the design */
export function PageSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true" aria-live="polite">
      <div className="mb-4 text-[12.5px] text-muted">{label}</div>
      <div className="mb-5 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-[116px] animate-pulse rounded-panel border border-line bg-panel" />
        ))}
      </div>
      <div className="overflow-hidden rounded-panel border border-line">
        {Array.from({ length: 9 }, (_, i) => (
          <div key={i} className={cn("h-11 animate-pulse border-b border-line-2 last:border-b-0", i % 2 ? "bg-row-b" : "bg-row-a")} />
        ))}
      </div>
    </div>
  );
}
