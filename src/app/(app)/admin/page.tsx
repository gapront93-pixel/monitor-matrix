import type { Metadata } from "next";

import { AdminView } from "@/components/admin/admin-view";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/states";
import { requireUser } from "@/lib/auth";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { adminMessages } from "@/lib/i18n/messages/admin";
import { shellMessages } from "@/lib/i18n/messages/shell";
import { getT } from "@/lib/i18n/server";
import { can, canManage } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT(adminMessages)).page.title };
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [me, a, shell] = await Promise.all([requireUser(), getT(adminMessages), getT(shellMessages)]);
  const t = a.page;
  const roleName = shell.roles[me.role].label;
  if (!canManage(me.role)) {
    return (
      <EmptyState
        title={t.noAccess}
        action={
          <ButtonLink href="/" variant="primary" size="sm">
            {t.home}
          </ButtonLink>
        }
      >
        {t.noAccessText(roleName)}
      </EmptyState>
    );
  }
  const { tab } = await searchParams;
  const manageUsers = can(me.role, "users");

  const [dealers, used, segments, imports, unmatched, products, users] = await Promise.all([
    prisma.dealer.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.priceSnapshot.groupBy({ by: ["dealerId"], _count: { _all: true } }),
    prisma.segment.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.priceImport.findMany({
      orderBy: [{ createdAt: "desc" }],
      take: 15,
      include: { _count: { select: { snapshots: true, dealers: true, unmatched: true } }, uploadedBy: { select: { name: true } } },
    }),
    prisma.unmatchedPrice.findMany({ orderBy: [{ capturedAt: "desc" }, { id: "desc" }], take: 400, include: { dealer: { select: { name: true } } } }),
    prisma.product.findMany({ where: { isGigabyte: true }, select: { id: true, model: true }, orderBy: { model: "asc" } }),
    manageUsers ? prisma.user.findMany({ orderBy: [{ active: "desc" }, { role: "asc" }, { name: "asc" }], include: { _count: { select: { imports: true } } } }) : Promise.resolve([]),
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
      <PageHeader eyebrow={t.eyebrow} title={t.heading} sub={`${me.name} · ${roleName}`} />
      <AdminView
        initialTab={tab === "dai-ly" || tab === "phan-khuc" || (tab === "nguoi-dung" && manageUsers) ? tab : "gia"}
        perms={{ deleteDealer: can(me.role, "dealers.delete"), users: manageUsers }}
        meId={me.id}
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
          uploadedBy: i.uploadedBy?.name ?? null,
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
        users={users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          active: u.active,
          lastLogin: u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : null,
          created: fmtDate(u.createdAt),
          uploads: u._count.imports,
        }))}
      />
    </>
  );
}
