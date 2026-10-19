"use client";

import { useCallback, useSyncExternalStore } from "react";

// Models picked for "So sánh", kept for this browser tab while moving between pages
const KEY = "mm-compare";
export const MAX_COMPARE = 4;
const EVENT = "mm-compare-change";

function read(): string[] {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((s) => typeof s === "string").slice(0, MAX_COMPARE) : [];
  } catch {
    return [];
  }
}

let cache: string[] = [];
let cacheRaw: string | null = null;

function snapshot(): string[] {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(KEY);
  } catch {
    raw = null;
  }
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    cache = read();
  }
  return cache;
}

const EMPTY: string[] = [];

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useCompareList(): [string[], (next: string[]) => void] {
  const list = useSyncExternalStore(subscribe, snapshot, () => EMPTY);
  const set = useCallback((next: string[]) => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify([...new Set(next)].slice(0, MAX_COMPARE)));
    } catch {
      // private mode: selection just does not persist
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [list, set];
}

export function compareHref(slugs: string[]): string {
  return `/so-sanh?m=${slugs.map(encodeURIComponent).join(",")}`;
}
