"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** On: light track, dark knob. Off: dark track, grey knob. With a label it renders as one 32px control. */
export function Switch({
  checked,
  onCheckedChange,
  label,
  className,
  boxed = true,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label?: ReactNode;
  className?: string;
  boxed?: boolean;
}) {
  const sw = (
    <SwitchPrimitive.Root
      checked={checked}
      onCheckedChange={(v) => onCheckedChange(v)}
      className="relative inline-flex h-4 w-[30px] shrink-0 cursor-pointer items-center rounded-full bg-line transition-colors data-[checked]:bg-fg-2"
    >
      <SwitchPrimitive.Thumb className="block size-3 translate-x-0.5 rounded-full bg-faint transition-transform data-[checked]:translate-x-[16px] data-[checked]:bg-app" />
    </SwitchPrimitive.Root>
  );
  if (!label) return sw;
  return (
    <label
      className={cn(
        "inline-flex cursor-pointer items-center gap-2 text-[13px] font-medium text-fg select-none",
        boxed && "h-8 rounded-ctl border border-line bg-app px-2.5",
        className,
      )}
    >
      {sw}
      {label}
    </label>
  );
}
