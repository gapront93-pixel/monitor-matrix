import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/**
 * Small label above a page title ("TỔNG QUAN", "SẢN PHẨM"...): Aldrich VN (loaded in app/layout.tsx as
 * --font-aldrich-vn), capitals at the font's single weight, cyan-to-magenta gradient clipped to the text.
 * inline-block + w-fit so the gradient spans the word, not the whole line, even inside a flex column.
 * Aldrich has no bold: font-weight 400 and font-synthesis none so no browser fakes one.
 * leading 1.6 leaves room for the marks on capitals (Ổ, Ệ, Ữ) that a tight line box would clip.
 */
export function Eyebrow({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-block w-fit font-[family-name:var(--font-aldrich-vn)] text-[14px] leading-[1.6] font-normal tracking-[0.2em] uppercase [font-synthesis:none]",
        "bg-[linear-gradient(90deg,#40e0e0,#ff00ff)] bg-clip-text text-transparent",
        className,
      )}
      {...props}
    />
  );
}
