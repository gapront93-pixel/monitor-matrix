import { cn } from "@/lib/utils";

/** Striped placeholder until official product photos are added */
export function ProductImage({ label, className }: { label?: string; className?: string }) {
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
