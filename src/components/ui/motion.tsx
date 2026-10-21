"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

import { fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Default length of every number/chart tween */
export const TWEEN_MS = 1100;
const easeOutCubic = (p: number) => 1 - Math.pow(1 - p, 3);

/**
 * Recharts' own animation: it redraws only the bars/line/slices of a series each frame (not the whole chart) and
 * moves from the values on screen to the new ones when the data changes. It starts 150ms late so the work of
 * mounting the page is done before the first frame, instead of showing as a jump.
 */
export const chartAnim = { isAnimationActive: true, animationBegin: 150, animationDuration: TWEEN_MS, animationEasing: "ease-out" } as const;

// --- prefers-reduced-motion ---

const REDUCE = "(prefers-reduced-motion: reduce)";
function subscribeReduce(cb: () => void) {
  const mq = window.matchMedia(REDUCE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReduce, () => window.matchMedia(REDUCE).matches, () => false);
}

// --- One requestAnimationFrame loop shared by every number on the page ---

type Tick = (now: number) => boolean; // false when finished
const ticks = new Set<Tick>();
let frame = 0;
function loop(now: number) {
  for (const tick of [...ticks]) if (!tick(now)) ticks.delete(tick);
  frame = ticks.size ? requestAnimationFrame(loop) : 0;
}
function schedule(tick: Tick) {
  ticks.add(tick);
  if (!frame) frame = requestAnimationFrame(loop);
  return () => {
    ticks.delete(tick);
  };
}

// --- Reveal on scroll: a block fades and slides up once it reaches 92% of the viewport; animations inside wait for it ---

// shown: the block reached the viewport (charts mount, numbers count); grown: two frames later, when the chart rows
// switch from 0 to their values so the freshly mounted chart animates them up from the axis
const Revealed = createContext({ shown: true, grown: true });

/** True once the surrounding <Reveal> block is on screen (always true outside one) */
export function useRevealed(): boolean {
  return useContext(Revealed).shown;
}

export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  const [grown, setGrown] = useState(false);
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        setShown(true);
        io.disconnect();
        raf = requestAnimationFrame(() => (raf = requestAnimationFrame(() => setGrown(true))));
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);
  const on = shown || reduce;
  const ctx = useMemo(() => ({ shown: on, grown: grown || reduce }), [on, grown, reduce]);
  return (
    <Revealed.Provider value={ctx}>
      {/* No translate class once shown: a transform would trap the fixed popovers inside the block */}
      <div ref={ref} className={cn("grid min-w-0 transition-[opacity,translate] duration-700 ease-out", on ? "opacity-100" : "translate-y-6 opacity-0", className)}>
        {children}
      </div>
    </Revealed.Provider>
  );
}

/**
 * A chart is mounted only when its block comes into view (the page does not build charts nobody has scrolled to);
 * until then an empty box of the same height holds its place
 */
export function ChartMount({ height, children }: { height: number | string; children: ReactNode }) {
  return useRevealed() ? <>{children}</> : <div aria-hidden style={{ height }} />;
}

/** True two frames after the block is shown: chart data switches from 0 to the real values then */
export function useGrown(): boolean {
  return useContext(Revealed).grown;
}

/**
 * Chart rows with the numeric `keys` at 0 until just after the block is revealed, so the chart's own animation grows
 * them from the axis when it comes into view
 */
export function useRevealedRows<T extends object>(rows: T[], keys: readonly (keyof T)[]): T[] {
  const shown = useGrown();
  const keyList = keys.join("|");
  return useMemo(() => {
    if (shown) return rows;
    const zero = keyList.split("|") as (keyof T)[];
    return rows.map((r) => {
      const o = { ...r };
      for (const k of zero) if (r[k] !== null && r[k] !== undefined) (o as Record<keyof T, unknown>)[k] = 0;
      return o;
    });
  }, [rows, shown, keyList]);
}

// --- Numbers: tweened straight into the DOM, so hundreds of them cost no React render per frame ---

type TweenOpts = { duration?: number; delay?: number; enabled?: boolean };

/**
 * Calls `apply` with a value going from 0 (on first show) or the value on screen to `target` (easeOutCubic).
 * Inside a <Reveal> it holds at 0 until the block is shown.
 */
export function useDomTween(target: number, apply: (v: number) => void, { duration = TWEEN_MS, delay = 0, enabled = true }: TweenOpts = {}) {
  const shown = useRevealed();
  const reduce = useReducedMotion();
  const live = enabled && !reduce;
  const goal = shown || !enabled ? target : 0;
  const cur = useRef(enabled ? 0 : target);
  const applyRef = useRef(apply);

  // Re-apply after every render: React may have reset the node, or the formatter changed
  useEffect(() => {
    applyRef.current = apply;
    apply(cur.current);
  });

  useEffect(() => {
    if (!live || cur.current === goal) {
      cur.current = goal;
      applyRef.current(goal);
      return;
    }
    const from = cur.current;
    const t0 = performance.now() + delay;
    return schedule((now) => {
      const p = Math.min(1, Math.max(0, (now - t0) / duration));
      cur.current = from + (goal - from) * easeOutCubic(p);
      applyRef.current(cur.current);
      return p < 1;
    });
  }, [goal, live, delay, duration]);
}

const whole = (n: number) => fmtNum(Math.round(n));

/** A number that counts up to `value` and tweens to each new value (whole numbers unless `format` says otherwise) */
export function CountUp({ value, format = whole, delay, enabled = true }: { value: number; format?: (n: number) => string; delay?: number; enabled?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  useDomTween(
    value,
    (v) => {
      // Write into React's own text node so React keeps owning it
      const node = ref.current?.firstChild;
      if (node) node.nodeValue = format(v);
    },
    { delay, enabled },
  );
  return <span ref={ref}>{format(enabled ? 0 : value)}</span>;
}
