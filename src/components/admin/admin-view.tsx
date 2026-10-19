"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";

import { useT } from "@/lib/i18n/client";
import { adminMessages } from "@/lib/i18n/messages/admin";
import { cn } from "@/lib/utils";

import { DealersPanel } from "./dealers-panel";
import { ImportsList, UnmatchedPanel } from "./history-panels";
import { SegmentsPanel } from "./segments-panel";
import type { AdminDealer, AdminImport, AdminSegment, AdminUnmatched, AdminUser } from "./types";
import { UsersPanel } from "./users-panel";
import { UploadPanel } from "./upload-panel";

type Tab = "gia" | "dai-ly" | "phan-khuc" | "nguoi-dung";
const TABS: Tab[] = ["gia", "dai-ly", "phan-khuc", "nguoi-dung"];

export function AdminView({
  initialTab,
  perms,
  meId,
  users,
  dealers,
  segments,
  imports,
  unmatched,
  products,
}: {
  initialTab: Tab;
  perms: { deleteDealer: boolean; users: boolean };
  meId: number;
  users: AdminUser[];
  dealers: AdminDealer[];
  segments: AdminSegment[];
  imports: AdminImport[];
  unmatched: AdminUnmatched[];
  products: { id: number; model: string }[];
}) {
  const t = useT(adminMessages).page;
  const pathname = usePathname();
  const [tab, setTab] = useState<Tab>(initialTab);
  const open = (t: Tab) => {
    setTab(t);
    window.history.replaceState(null, "", t === "gia" ? pathname : `${pathname}?tab=${t}`);
  };
  return (
    <>
      <div role="tablist" aria-label={t.title} className="no-scrollbar mb-4 flex overflow-x-auto border-b border-line">
        {TABS.filter((id) => id !== "nguoi-dung" || perms.users).map((id) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => open(id)}
            className={cn("relative h-10 shrink-0 px-3.5 whitespace-nowrap text-[13px] font-semibold", tab === id ? "text-fg" : "text-fg-2 hover:text-fg")}
          >
            {t.tabs[id]}
            {id === "gia" && unmatched.length > 0 && <span className="num ml-1.5 text-[11px] text-warn">{unmatched.length}</span>}
            {tab === id && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-accent" />}
          </button>
        ))}
      </div>
      {tab === "gia" && (
        <div className="flex flex-col gap-6">
          <UploadPanel dealers={dealers} />
          <ImportsList imports={imports} />
          <UnmatchedPanel rows={unmatched} products={products} />
        </div>
      )}
      {tab === "dai-ly" && <DealersPanel dealers={dealers} canDelete={perms.deleteDealer} />}
      {tab === "phan-khuc" && <SegmentsPanel segments={segments} />}
      {tab === "nguoi-dung" && perms.users && <UsersPanel users={users} meId={meId} />}
    </>
  );
}
