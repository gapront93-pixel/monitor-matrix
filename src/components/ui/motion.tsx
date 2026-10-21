"use client";

import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

import { fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Default length of every number/chart tween */
export const TWEEN_MS = 1100;
const easeOutCubic = (p: number) => 1 - Math.pow(1 - p, 3);

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

// --- One requestAnimationFrame loop shared by every tween on the page ---

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

// --- Reveal on scroll: a block fades and slides up once it reaches 92% of the viewport; tweens inside wait for it ---

const Revealed = createContext(true);

export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        setShown(true);
        io.disconnect();
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const on = shown || reduce;
  return (
    <Revealed.Provider value={on}>
      {/* No translate class once shown: a transform would trap the fixed popovers inside the block */}
      <div ref={ref} className={cn("grid min-w-0 transition-[opacity,translate] duration-700 ease-out", on ? "opacity-100" : "translate-y-6 opacity-0", className)}>
        {children}
      </div>
    </Revealed.Provider>
  );
}

// --- Tweens ---

type TweenOpts = { duration?: number; delay?: number; stagger?: number; enabled?: boolean };

/**
 * Animated copies of `targets`: from 0 on first show, then from the values on screen to the new ones when they change
 * (easeOutCubic, item i starts i×stagger ms later). Inside a <Reveal> it holds at 0 until the block is shown.
 */
export function useTweens(targets: number[], { duration = TWEEN_MS, delay = 0, stagger = 0, enabled = true }: TweenOpts = {}): number[] {
  const shown = useContext(Revealed);
  const reduce = useReducedMotion();
  const live = enabled && !reduce;
  const goal = shown ? targets : targets.map(() => 0);
  const key = goal.join(",");
  const [cur, setCur] = useState<number[]>(() => targets.map(() => 0));
  const onScreen = useRef<number[]>([]);

  useEffect(() => {
    if (!live) return;
    const to = key ? key.split(",").map(Number) : [];
    const from = to.map((_, i) => onScreen.current[i] ?? 0);
    const t0 = performance.now() + delay;
    return schedule((now) => {
      let busy = false;
      const next = to.map((v, i) => {
        const p = Math.min(1, Math.max(0, (now - t0 - i * stagger) / duration));
        if (p < 1) busy = true;
        return from[i] + (v - from[i]) * easeOutCubic(p);
      });
      onScreen.current = next;
      setCur(next);
      return busy;
    });
  }, [key, live, delay, stagger, duration]);

  if (!live) return targets;
  return goal.map((_, i) => cur[i] ?? 0);
}

export function useTween(target: number, opts?: TweenOpts): number {
  return useTweens([target], opts)[0];
}

/** Rows with the numeric `keys` tweened, row i staggered by i×stagger */
export function useTweenRows<T extends object>(rows: T[], keys: readonly (keyof T)[], opts?: TweenOpts): T[] {
  const flat = rows.flatMap((r) => keys.map((k) => Number(r[k] ?? 0)));
  const per = keys.length || 1;
  const vals = useTweens(flat, { ...opts, stagger: (opts?.stagger ?? 0) / per });
  return rows.map((r, i) => {
    const o = { ...r };
    keys.forEach((k, j) => {
      // Gaps (null) stay gaps so lines keep their breaks
      if (r[k] !== null && r[k] !== undefined) (o as Record<keyof T, unknown>)[k] = vals[i * per + j];
    });
    return o;
  });
}

const whole = (n: number) => fmtNum(Math.round(n));

/** A number that counts up to `value` and tweens to each new value (whole numbers unless `format` says otherwise) */
export function CountUp({ value, format = whole, delay, enabled }: { value: number; format?: (n: number) => string; delay?: number; enabled?: boolean }) {
  return <>{format(useTween(value, { delay, enabled }))}</>;
}
