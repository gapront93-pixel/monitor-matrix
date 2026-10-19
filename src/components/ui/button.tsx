import { cva, type VariantProps } from "class-variance-authority";
import Link from "next/link";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

// Orange is reserved for the primary action; everything else is the dark secondary style
export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-ctl font-semibold transition-colors select-none disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-accent text-on-accent hover:bg-accent-hover",
        secondary: "border border-line bg-app text-fg hover:border-line-hover",
        ghost: "text-fg-2 hover:text-fg",
        muted: "border border-line bg-row-b text-faint",
      },
      size: {
        sm: "h-8 px-3 text-[12.5px]",
        md: "h-[34px] px-4 text-[13px]",
        lg: "h-[38px] px-4 text-[13.5px]",
        icon: "size-7 text-[12px]",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

type Variants = VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, type = "button", ...props }: ComponentProps<"button"> & Variants) {
  return <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export function ButtonLink({ className, variant, size, ...props }: ComponentProps<typeof Link> & Variants) {
  return <Link className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

/** Plain <a> for external pages (dealer sites, reviews) */
export function ButtonA({ className, variant, size, ...props }: ComponentProps<"a"> & Variants) {
  return <a target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
