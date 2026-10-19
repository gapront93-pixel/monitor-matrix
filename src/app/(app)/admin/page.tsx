import type { Metadata } from "next";

import { AdminView } from "@/components/admin/admin-view";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/panel";
import { getSession } from "@/lib/auth";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";

import { adminLogout } from "./actions";
import { AdminLoginForm } from "./login-form";

export const metadata: Metadata = { title: "Quản trị" };

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const session = await getSession();
  if (session?.role !== "admin") return <AdminLoginForm />;
  const { tab } = await searchParams;

  const [dealers, used, segments, imports, unmatched, products] = await Promise.all([
    prisma.dealer.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.priceSnapshot.groupBy({ by: ["dealerId"], _count: { _all: true } }),
    prisma.segment.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.priceImport.findMany({
      orderBy: [{ createdAt: "desc" }],
      take: 15,
      include: { _count: { select: { snapshots: true, dealers: true, unmatched: true } } },
    }),
    prisma.unmatchedPrice.findMany({ orderBy: [{ capturedAt: "desc" }, { id: "desc" }], take: 400, include: { dealer: { select: { name: true } } } }),
    prisma.product.findMany({ where: { isGigabyte: true }, select: { id: true, model: true }, orderBy: { model: "asc" } }),
  ]);
  const usedBy = new Map(used.map((u) => [u.dealerId, u._count._all]));

  // Newest row per dealer + listing name
  const seen = new Set<string>();
  const openRows = unmatched.filter((u) => {
    const k = `${u.dealerId}|${u.nameOnSite}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return (
    <>
      <PageHeader
        eyebrow="Quản trị"
        title="Dữ liệu giá và đại lý"
        actions={
          <form action={adminLogout} className="flex items-center gap-3">
            <span className="text-[12.5px] text-muted">{session.email}</span>
            <Button type="submit" size="sm">
              Đăng xuất
            </Button>
          </form>
        }
      />
      <AdminView
        initialTab={tab === "dai-ly" || tab === "phan-khuc" ? tab : "gia"}
        dealers={dealers.map((d) => ({
          id: d.id,
          name: d.name,
          website: d.website ?? "",
          isKey: d.isKey,
          priceType: d.priceType,
          visible: d.visible,
          status: d.status,
          prices: usedBy.get(d.id) ?? 0,
        }))}
        segments={segments.map((s) => ({ id: s.id, name: s.shortName ?? s.nameVi, verdict: s.verdict, conclusionVi: s.conclusionVi ?? "" }))}
        imports={imports.map((i) => ({
          id: i.id,
          day: fmtDate(i.capturedAt),
          createdAt: fmtDateTime(i.createdAt),
          source: i.source,
          fileName: i.fileName,
          prices: i._count.snapshots,
          dealers: i._count.dealers,
          unmatched: i._count.unmatched,
          summary: (i.summary ?? {}) as Record<string, unknown>,
        }))}
        unmatched={openRows.map((u) => ({
          id: u.id,
          dealer: u.dealer.name,
          name: u.nameOnSite,
          slug: u.slugInFile,
          price: u.priceVnd,
          url: u.url,
          note: u.note,
          day: fmtDate(u.capturedAt),
        }))}
        products={products}
      />
    </>
  );
}
