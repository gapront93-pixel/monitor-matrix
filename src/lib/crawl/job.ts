import "server-only";

import { runScan, type ScanProgress, type ScanResult } from "./scan";

// One price scan at a time, kept in memory (the app runs as a single PM2 process).
// The screen starts it with POST /api/prices/scan and polls GET until it is finished.

export type ScanJob = {
  id: number;
  by: string;
  startedAt: string;
  finishedAt: string | null;
  state: "running" | "done" | "failed";
  progress: ScanProgress;
  result: ScanResult | null;
  error: string | null;
};

const g = globalThis as unknown as { priceScan?: ScanJob };

export function currentScan(): ScanJob | null {
  return g.priceScan ?? null;
}

/** Starts a scan unless one is running; returns the running or new job */
export function startScan(user: { id: number; name: string }): { job: ScanJob; started: boolean } {
  const cur = g.priceScan;
  if (cur?.state === "running") return { job: cur, started: false };
  const job: ScanJob = {
    id: (cur?.id ?? 0) + 1,
    by: user.name,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    state: "running",
    progress: { total: 0, done: 0, dealer: null },
    result: null,
    error: null,
  };
  g.priceScan = job;
  runScan(user.id, (p) => {
    job.progress = p;
  })
    .then((r) => {
      job.result = r;
      job.state = "done";
    })
    .catch((e) => {
      console.error("price scan failed", e);
      job.error = e instanceof Error ? e.message : String(e);
      job.state = "failed";
    })
    .finally(() => {
      job.finishedAt = new Date().toISOString();
    });
  return { job, started: true };
}
