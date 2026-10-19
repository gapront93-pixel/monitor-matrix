"use client";

import { useState } from "react";

import { updateSegment } from "@/app/(app)/admin/data-actions";
import { Button } from "@/components/ui/button";
import { Panel, VerdictTag, type Verdict } from "@/components/ui/panel";
import { cn } from "@/lib/utils";

import { useAction } from "./history-panels";
import type { AdminSegment } from "./types";

const VERDICTS: { v: Verdict; label: string }[] = [
  { v: "lead", label: "Dẫn đầu" },
  { v: "even", label: "Ngang" },
  { v: "weak", label: "Yếu hơn" },
];

export function SegmentsPanel({ segments }: { segments: AdminSegment[] }) {
  return (
    <section>
      <p className="mb-3 text-[12.5px] text-muted">Nhãn kết luận hiện trên thẻ phân khúc ở Tổng quan và ở trang Đối thủ; đoạn kết luận hiện ở trang Đối thủ.</p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,460px),1fr))] gap-3">
        {segments.map((s) => (
          <SegmentEditor key={s.id + s.verdict + s.conclusionVi} s={s} />
        ))}
      </div>
    </section>
  );
}

function SegmentEditor({ s }: { s: AdminSegment }) {
  const { pending, run } = useAction();
  const [verdict, setVerdict] = useState(s.verdict);
  const [text, setText] = useState(s.conclusionVi);
  const dirty = verdict !== s.verdict || text !== s.conclusionVi;
  return (
    <Panel className="flex flex-col gap-2.5 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[14px] font-bold text-fg">{s.name}</h3>
        <VerdictTag verdict={verdict} />
      </div>
      <div className="inline-flex w-fit overflow-hidden rounded-ctl border border-line" role="group" aria-label={`Kết luận ${s.name}`}>
        {VERDICTS.map((x) => (
          <button
            key={x.v}
            type="button"
            aria-pressed={verdict === x.v}
            onClick={() => setVerdict(x.v)}
            className={cn("h-8 px-3 text-[12.5px] font-semibold", verdict === x.v ? "bg-fg text-app" : "bg-app text-fg-2 hover:text-fg")}
          >
            {x.label}
          </button>
        ))}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        aria-label={`Đoạn kết luận ${s.name}`}
        className="rounded-ctl border border-line bg-app px-2.5 py-2 text-[12.5px] leading-relaxed text-fg"
      />
      <div className="flex justify-end gap-2">
        {dirty && (
          <Button
            size="sm"
            onClick={() => {
              setVerdict(s.verdict);
              setText(s.conclusionVi);
            }}
          >
            Bỏ thay đổi
          </Button>
        )}
        <Button size="sm" variant="primary" disabled={!dirty || pending} onClick={() => run(() => updateSegment(s.id, { verdict, conclusionVi: text }))}>
          {pending ? "Đang lưu …" : "Lưu"}
        </Button>
      </div>
    </Panel>
  );
}
