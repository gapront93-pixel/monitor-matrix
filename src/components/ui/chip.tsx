import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/** Filter chip: light when on, dark when off. Height 28px. */
export function Chip({ active, className, ...props }: ComponentProps<"button"> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex h-7 items-center rounded-chip border px-2.5 text-[12.5px] font-semibold transition-colors",
        active ? "border-fg bg-fg text-app" : "border-line bg-app text-fg-2 hover:border-line-hover hover:text-fg",
        className,
      )}
      {...props}
    />
  );
}
