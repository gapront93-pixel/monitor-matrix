"use client";

import { useState } from "react";

/**
 * Column the pointer is over in a Recharts chart (the chart splits its width into one band per category):
 * the hovered column stays lit, the others fade to 45%.
 */
export function useChartHover() {
  const [hover, setHover] = useState<number | null>(null);
  return {
    hover,
    chartProps: {
      onMouseMove: (s: { activeTooltipIndex?: number | string | null }) => setHover(s.activeTooltipIndex === null || s.activeTooltipIndex === undefined ? null : Number(s.activeTooltipIndex)),
      onMouseLeave: () => setHover(null),
    },
  };
}

export const dimmed = (hover: number | null, i: number) => (hover === null || hover === i ? 1 : 0.45);
export const cellFade = { transition: "fill-opacity .15s" };

/** Tooltip that follows the pointer 16px away (Recharts flips it near the right edge), sliding in 80ms */
export const tooltipFollow = { offset: 16, isAnimationActive: true, animationDuration: 80, animationEasing: "linear" } as const;

/** Line points: 7px, 11px under the pointer */
export const DOT_R = 3.5;
export const ACTIVE_DOT_R = 5.5;
