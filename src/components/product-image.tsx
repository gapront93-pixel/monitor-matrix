"use client";

import Image from "next/image";

import { useT } from "@/lib/i18n/client";
import { shellMessages } from "@/lib/i18n/messages/shell";

import { cn } from "@/lib/utils";

/**
 * Product photo on a white card (product shots are on white), or the striped placeholder while none exists.
 * Files are already resized to WebP when stored, so Next's optimiser is skipped.
 */
export function ProductImage({ src, label, className, sizes = "360px" }: { src?: string | null; label?: string; className?: string; sizes?: string }) {
  const t = useT(shellMessages).states;
  if (src) {
    return (
      <div className={cn("relative overflow-hidden rounded-chip border border-line-2 bg-white", className)}>
        <Image src={src} alt={label ? t.imageOf(label) : t.productImage} fill sizes={sizes} unoptimized className="object-contain p-[6%]" />
      </div>
    );
  }
  return (
    <div
      role="img"
      aria-label={label ? t.imageMissing(label) : t.noImage}
      className={cn("img-placeholder flex items-center justify-center rounded-chip border border-line-2", className)}
    >
      {label && <span className="num px-2 text-center text-[10.5px] text-faint">{label}</span>}
    </div>
  );
}
