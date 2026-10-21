"use client";

import { createElement, useId } from "react";

/**
 * Hovered column: Recharts marks the bars of the active tooltip column with `activeBar`; CSS (globals.css, .chart-dim)
 * fades every other bar to 45%. Nothing re-renders the chart, so hovering never disturbs its animation.
 */
export const activeBar = { className: "bar-on" };

/** For a highlight driven from outside the chart (a table row): class for the wrapper and a <style> fading all but bar `index` */
export function useBarFade(index: number | null) {
  const cls = `ch${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const css = index === null || index < 0 ? "" : `.${cls} .recharts-bar-rectangle:not(:nth-child(${index + 1})){opacity:.45}`;
  return { cls, style: createElement("style", null, css) };
}

/** Tooltip that follows the pointer 16px away (Recharts flips it near the right edge), sliding in 80ms */
export const tooltipFollow = { offset: 16, isAnimationActive: true, animationDuration: 80, animationEasing: "linear" } as const;

/** Line points: 7px, 11px under the pointer */
export const DOT_R = 3.5;
export const ACTIVE_DOT_R = 5.5;
