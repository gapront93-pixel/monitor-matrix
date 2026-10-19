import "server-only";

import { copyFile, mkdir, readdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { YEARS, type ImportData } from "./imports";

// Where the import data lives. An upload from the admin goes to storage/import (outside the code, in the nightly
// backup); until the first upload the file shipped with the code is used.
const STORE = path.join(process.cwd(), "storage", "import");
const CURRENT = path.join(STORE, "import-raw.json");
const SHIPPED = path.join(process.cwd(), "data", "import", "import-raw-2024-2026.json");
const HISTORY = path.join(STORE, "history");
const KEEP = 10;

export type ImportSource = { fileName: string; uploadedAt: string; uploadedBy: string };
type Meta = ImportData["meta"] & { source?: ImportSource };

const exists = (p: string) => stat(p).then(() => true, () => false);
export async function importFilePath(): Promise<string> {
  return (await exists(CURRENT)) ? CURRENT : SHIPPED;
}

const g = globalThis as unknown as { importFile?: { file: string; mtime: number; text: string; data: ImportData } };

/** The current file (text as stored, and parsed), read again only when it changes */
export async function readImport(): Promise<{ text: string; data: ImportData; mtime: number }> {
  const file = await importFilePath();
  const mtime = (await stat(file)).mtimeMs;
  if (g.importFile?.file !== file || g.importFile.mtime !== mtime) {
    const text = await readFile(file, "utf8");
    g.importFile = { file, mtime, text, data: JSON.parse(text) };
  }
  return { text: g.importFile.text, data: g.importFile.data, mtime };
}

/** "22/09/2026": the newest day of the newest year with rows */
export function latestDay(d: ImportData): string {
  const top = [...YEARS].reverse().find((y) => d[`r${y}`].length) ?? 2026;
  const l = d.meta.latest;
  return `${String(l % 100).padStart(2, "0")}/${String(Math.floor(l / 100)).padStart(2, "0")}/${top}`;
}

export type ImportInfo = {
  latest: string;
  counts: Record<number, number>;
  source: ImportSource | null; // null: the file shipped with the code
  history: { name: string; savedAt: string; latest: string | null }[];
};

export async function importInfo(): Promise<ImportInfo> {
  const { data } = await readImport();
  const names = (await readdir(HISTORY).catch(() => [] as string[])).filter((n) => n.endsWith(".json")).sort().reverse();
  return {
    latest: latestDay(data),
    counts: Object.fromEntries(YEARS.map((y) => [y, data[`r${y}`].length])),
    source: (data.meta as Meta).source ?? null,
    history: names.map((name) => ({ name, savedAt: name.replace(/^import-raw-|\.json$/g, ""), latest: null })),
  };
}

async function keepCurrent(): Promise<void> {
  await mkdir(HISTORY, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  await copyFile(await importFilePath(), path.join(HISTORY, `import-raw-${stamp}.json`));
  const names = (await readdir(HISTORY)).filter((n) => n.endsWith(".json")).sort();
  for (const n of names.slice(0, Math.max(0, names.length - KEEP))) await unlink(path.join(HISTORY, n));
}

async function writeCurrent(text: string): Promise<void> {
  await mkdir(STORE, { recursive: true });
  const tmp = `${CURRENT}.tmp`;
  await writeFile(tmp, text);
  await rename(tmp, CURRENT); // atomic: readers see the old or the new file, never half of one
}

/** Replaces the data; the previous file is kept in the history */
export async function saveImport(data: ImportData, source: ImportSource): Promise<void> {
  await keepCurrent();
  await writeCurrent(JSON.stringify({ ...data, meta: { ...data.meta, source } }));
}

/** Puts a file of the history back (the current one goes to the history first) */
export async function restoreImport(name: string): Promise<boolean> {
  if (!/^import-raw-[\dT-]+\.json$/.test(name)) return false;
  const file = path.join(HISTORY, name);
  if (!(await exists(file))) return false;
  const text = await readFile(file, "utf8");
  await keepCurrent();
  await writeCurrent(text);
  return true;
}
