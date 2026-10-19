"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { fmtDiff, fmtNum } from "@/lib/format";
import { useT } from "@/lib/i18n/client";
import { catalogMessages } from "@/lib/i18n/messages/catalog";

type Point = { day: string; label: string; min: number | null } & Record<string, number | null | string>;

// Colours from the design: lowest = green (thick), first dealer = light grey, second = key blue dashed
const STYLES = [
  { stroke: "var(--color-fg-2)", width: 1.5, dash: undefined },
  { stroke: "var(--color-key)", width: 1.5, dash: "5 4" },
];

export function PriceHistoryChart({ points, series }: { points: Point[]; series: { key: string; name: string }[] }) {
  const m = useT(catalogMessages);
  const t = m.history;
  const mins = points.map((p) => p.min).filter((v): v is number => v !== null);
  const first = mins[0];
  const last = mins.at(-1);

  return (
    <div className="rounded-panel border border-line bg-panel p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[13.5px] font-bold text-fg">
          {t.title(points.length)}
        </h3>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-fg-2" aria-label={t.legend}>
          <li className="flex items-center gap-1.5">
            <span className="inline-block h-[2.5px] w-4 bg-best" /> {m.words.lowest}
          </li>
          {series.map((s, i) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span className="inline-block w-4 border-t-[1.5px]" style={{ borderColor: STYLES[i].stroke, borderStyle: STYLES[i].dash ? "dashed" : "solid" }} />
              {s.name}
            </li>
          ))}
        </ul>
      </div>

      {points.length < 2 ? (
        <div className="flex h-[180px] flex-col items-center justify-center rounded-chip border border-dashed border-line-dashed text-center">
          {last !== undefined && <div className="num text-[22px] font-semibold text-best">{fmtNum(last)}</div>}
          <p className="mt-1 max-w-[46ch] text-[12px] text-muted">
            {t.single(points.length, points[0]?.label ?? "")}
          </p>
        </div>
      ) : (
        <div className="h-[220px]" role="img" aria-label={t.chart}>
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 640, height: 220 }}>
            <LineChart data={points} margin={{ top: 6, right: 22, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--color-line-2)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} padding={{ left: 8, right: 8 }} interval="preserveStartEnd" tick={{ fill: "var(--color-faint)", fontSize: 10.5, fontFamily: "var(--font-mono)" }} />
              <YAxis
                width={78}
                tickLine={false}
                axisLine={false}
                domain={["auto", "auto"]}
                tickFormatter={(v: number) => fmtNum(v)}
                tick={{ fill: "var(--color-faint)", fontSize: 10.5, fontFamily: "var(--font-mono)" }}
              />
              <Tooltip
                cursor={{ stroke: "var(--color-line-hover)" }}
                contentStyle={{ background: "var(--color-panel)", border: "1px solid var(--color-line)", borderRadius: 5, fontSize: 12 }}
                labelStyle={{ color: "var(--color-fg)", fontWeight: 600 }}
                itemStyle={{ color: "var(--color-fg-2)", fontFamily: "var(--font-mono)" }}
                formatter={(v, name) => [typeof v === "number" ? fmtNum(v) : "—", name === "min" ? m.words.lowest : (series.find((s) => s.key === name)?.name ?? String(name))]}
              />
              {series.map((s, i) => (
                <Line
                  key={s.key}
                  dataKey={s.key}
                  type="monotone"
                  stroke={STYLES[i].stroke}
                  strokeWidth={STYLES[i].width}
                  strokeDasharray={STYLES[i].dash}
                  dot={false}
                  activeDot={{ r: 4, stroke: "var(--color-panel)", strokeWidth: 2 }}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
              <Line
                dataKey="min"
                type="monotone"
                stroke="var(--color-best)"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "var(--color-best)", strokeWidth: 0 }}
                activeDot={{ r: 5, stroke: "var(--color-panel)", strokeWidth: 2 }}
                connectNulls
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {first !== undefined && last !== undefined && mins.length >= 2 && (
        <p className="mt-2 text-[12px] text-muted">
          {last === first
            ? t.flat(points.length, fmtNum(last))
            : t.moved(last < first, fmtDiff(Math.abs(last - first)).replace("+", ""), points[0].label, points.at(-1)!.label, fmtNum(first), fmtNum(last))}
        </p>
      )}
    </div>
  );
}
