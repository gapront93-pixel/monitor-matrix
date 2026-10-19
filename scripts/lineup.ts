// Applies the current lineup (data/lineup-2026.json): the segments, the GIGABYTE models sold now (List LCD GBT +
// SO Models of 2026) and the rivals picked from the 2026 import data. Everything else is hidden, never deleted,
// so prices, photos and reviews stay. Runs at the end of `npm run seed`, or alone: npm run lineup
import "dotenv/config";

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import type { PrismaClient } from "../src/generated/prisma/client";
import { codeTokens, normKey } from "../src/lib/normalize";

import { competitorData, gigabyteData, slugify, type GigabyteSpec, type SegmentFile } from "./catalog-data";

type Lineup = {
  source: string;
  segments: {
    id: string;
    shortName: string;
    nameVi: string;
    criteria: string;
    sortOrder: number;
    gigabyte: string[]; // product slugs
    rivals: (SegmentFile["competitors"][number] & { segment?: string })[];
  }[];
  newGigabyte: GigabyteSpec[];
};

export async function applyLineup(prisma: PrismaClient, dataDir: string): Promise<string[] | null> {
  const file = path.join(dataDir, "lineup-2026.json");
  if (!existsSync(file)) return null;
  const lineup: Lineup = JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
  const warn: string[] = [];

  // Segments: names and order come from the file; verdict and conclusion stay with the admin
  for (const s of lineup.segments) {
    const data = { nameVi: s.nameVi, shortName: s.shortName, criteria: s.criteria, sortOrder: s.sortOrder, hidden: false };
    await prisma.segment.upsert({ where: { id: s.id }, create: { id: s.id, ...data }, update: data });
  }
  const segIds = lineup.segments.map((s) => s.id);
  await prisma.segment.updateMany({ where: { id: { notIn: segIds } }, data: { hidden: true, sortOrder: 100 } });

  const existing = new Map((await prisma.product.findMany({ select: { slug: true, aliases: true } })).map((p) => [p.slug, p.aliases]));
  const aliasesFor = (slug: string, add: string[]) => [...new Set([...(existing.get(slug) ?? []), ...add.filter(Boolean)])];

  // GIGABYTE models new in the lineup (basic specs from the distributor list and spec pages)
  for (const x of lineup.newGigabyte) {
    const data = { ...gigabyteData(x), aliases: aliasesFor(x.slug, [normKey(x.slug), normKey(x.model)]) };
    await prisma.product.upsert({ where: { slug: x.slug }, create: { slug: x.slug, ...data }, update: data });
  }

  const shown = new Set<string>();
  for (const s of lineup.segments) {
    for (const slug of s.gigabyte) {
      const r = await prisma.product.updateMany({ where: { slug, isGigabyte: true }, data: { segmentId: s.id, hidden: false } });
      if (!r.count) warn.push(`Lineup ${s.id}: không có mẫu GIGABYTE "${slug}"`);
      shown.add(slug);
    }
    for (const c of s.rivals) {
      const data = competitorData(c, s.id);
      const slug = slugify(`${data.brand} ${data.model}`);
      const aliases = aliasesFor(slug, [normKey(c.model), ...codeTokens(c.model)]);
      await prisma.product.upsert({ where: { slug }, create: { slug, ...data, aliases }, update: { ...data, aliases, hidden: false } });
      shown.add(slug);
    }
  }
  const hidden = await prisma.product.updateMany({ where: { slug: { notIn: [...shown] }, hidden: false }, data: { hidden: true } });
  const [gb, rivals] = await Promise.all([
    prisma.product.count({ where: { hidden: false, isGigabyte: true } }),
    prisma.product.count({ where: { hidden: false, isGigabyte: false } }),
  ]);
  console.log(`Lineup: ${lineup.segments.length} phân khúc, ${gb} mẫu GIGABYTE + ${rivals} đối thủ đang hiện; vừa ẩn ${hidden.count} mẫu`);
  return warn;
}

if (require.main === module) {
  import("../src/lib/prisma")
    .then(async ({ prisma }) => {
      try {
        const warn = await applyLineup(prisma, process.env.DATA_DIR ?? path.join(__dirname, "..", "data"));
        if (warn === null) console.log("Không có data/lineup-2026.json");
        else if (warn.length) console.log("Cảnh báo:\n  " + warn.join("\n  "));
      } finally {
        await prisma.$disconnect();
      }
    })
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    });
}
