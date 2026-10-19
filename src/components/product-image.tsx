import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * Product photo on a white card (product shots are on white), or the striped placeholder while none exists.
 * Files are already resized to WebP when stored, so Next's optimiser is skipped.
 */
export function ProductImage({ src, label, className, sizes = "360px" }: { src?: string | null; label?: string; className?: string; sizes?: string }) {
  if (src) {
    return (
      <div className={cn("relative overflow-hidden rounded-chip border border-line-2 bg-white", className)}>
        <Image src={src} alt={label ? `Ảnh ${label}` : "Ảnh sản phẩm"} fill sizes={sizes} unoptimized className="object-contain p-[6%]" />
      </div>
    );
  }
  return (
    <div
      role="img"
      aria-label={label ? `Ảnh ${label} (chưa có)` : "Chưa có ảnh"}
      className={cn("img-placeholder flex items-center justify-center rounded-chip border border-line-2", className)}
    >
      {label && <span className="num px-2 text-center text-[10.5px] text-faint">{label}</span>}
    </div>
  );
}
