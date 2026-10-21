"use client";

import { useState } from "react";

import { updateSegment } from "@/app/(app)/admin/data-actions";
import { Button } from "@/components/ui/button";
import { Panel, VerdictTag, type Verdict } from "@/components/ui/panel";
import { useT } from "@/lib/i18n/client";
import { adminMessages } from "@/lib/i18n/messages/admin";
import { cn } from "@/lib/utils";

import { useAction } from "./history-panels";
import type { AdminSegment } from "./types";

const VERDICTS: Verdict[] = ["lead", "even", "weak"];

export function SegmentsPanel({ segments }: { segments: AdminSegment[] }) {
  const t = useT(adminMessages).segments;
  return (
    <section>
      <p className="mb-3 text-[12.5px] text-muted">{t.help}</p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,460px),1fr))] gap-3">
        {segments.map((s) => (
          <SegmentEditor key={s.id + s.verdict + s.conclusionVi + s.representativeId} s={s} />
        ))}
      </div>
    </section>
  );
}

function SegmentEditor({ s }: { s: AdminSegment }) {
  const t = useT(adminMessages).segments;
  const { pending, run } = useAction();
  const [verdict, setVerdict] = useState(s.verdict);
  const [text, setText] = useState(s.conclusionVi);
  const [rep, setRep] = useState(s.representativeId);
  const dirty = verdict !== s.verdict || text !== s.conclusionVi || rep !== s.representativeId;
  return (
    <Panel className="flex flex-col gap-2.5 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[14px] font-bold text-fg">{s.name}</h3>
        <VerdictTag verdict={verdict} />
      </div>
      <div className="inline-flex w-fit overflow-hidden rounded-ctl border border-line" role="group" aria-label={t.verdictOf(s.name)}>
        {VERDICTS.map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={verdict === v}
            onClick={() => setVerdict(v)}
            className={cn("h-8 px-3 text-[12.5px] font-semibold", verdict === v ? "bg-fg text-app" : "bg-app text-fg-2 hover:text-fg")}
          >
            {t.verdicts[v]}
          </button>
        ))}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        aria-label={t.textOf(s.name)}
        className="rounded-ctl border border-line bg-app px-2.5 py-2 text-[12.5px] leading-relaxed text-fg"
      />
      <label className="flex flex-col gap-1 text-[12px] text-muted">
        {t.image}
        <select
          value={rep ?? ""}
          onChange={(e) => setRep(e.target.value ? Number(e.target.value) : null)}
          aria-label={t.imageOf(s.name)}
          className="h-8 rounded-ctl border border-line bg-app px-2 text-[12.5px] text-fg"
        >
          <option value="">{t.imageAuto(s.autoModel)}</option>
          {s.models.map((m) => (
            <option key={m.id} value={m.id} disabled={!m.hasImage}>
              {m.hasImage ? m.model : `${m.model} (${t.noPhoto})`}
            </option>
          ))}
        </select>
      </label>
      <div className="flex justify-end gap-2">
        {dirty && (
          <Button
            size="sm"
            onClick={() => {
              setVerdict(s.verdict);
              setText(s.conclusionVi);
              setRep(s.representativeId);
            }}
          >
            {t.revert}
          </Button>
        )}
        <Button size="sm" variant="primary" disabled={!dirty || pending} onClick={() => run(() => updateSegment(s.id, { verdict, conclusionVi: text, representativeProductId: rep }))}>
          {pending ? t.saving : t.save}
        </Button>
      </div>
    </Panel>
  );
}
