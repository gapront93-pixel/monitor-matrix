"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/utils";

import { DealersPanel } from "./dealers-panel";
import { ImportsList, UnmatchedPanel } from "./history-panels";
import { SegmentsPanel } from "./segments-panel";
import type { AdminDealer, AdminImport, AdminSegment, AdminUnmatched, AdminUser } from "./types";
import { UsersPanel } from "./users-panel";
import { UploadPanel } from "./upload-panel";

type Tab = "gia" | "dai-ly" | "phan-khuc" | "nguoi-dung";
const TABS: { id: Tab; label: string }[] = [
  { id: "gia", label: "Cập nhật giá" },
  { id: "dai-ly", label: "Đại lý" },
  { id: "phan-khuc", label: "Phân khúc" },
  { id: "nguoi-dung", label: "Người dùng" },
];

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
  const pathname = usePathname();
  const [tab, setTab] = useState<Tab>(initialTab);
  const open = (t: Tab) => {
    setTab(t);
    window.history.replaceState(null, "", t === "gia" ? pathname : `${pathname}?tab=${t}`);
  };
  return (
    <>
      <div role="tablist" aria-label="Quản trị" className="mb-4 flex border-b border-line">
        {TABS.filter((t) => t.id !== "nguoi-dung" || perms.users).map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => open(t.id)}
            className={cn("relative h-10 px-3.5 text-[13px] font-semibold", tab === t.id ? "text-fg" : "text-fg-2 hover:text-fg")}
          >
            {t.label}
            {t.id === "gia" && unmatched.length > 0 && <span className="num ml-1.5 text-[11px] text-warn">{unmatched.length}</span>}
            {tab === t.id && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-accent" />}
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
