import { EmptyState } from "@/components/ui/states";
import { reviewMonth, type BenchmarkCard } from "@/lib/product-detail";

/** One card per review: source, month, verdict quote, measurements, each with its source link */
export function BenchmarkCards({ cards, model, emptyText }: { cards: BenchmarkCard[]; model?: string; emptyText?: string }) {
  if (!cards.length) {
    return (
      <EmptyState title="Chưa có số đo review">
        {emptyText ?? "Chưa tìm thấy bài review đo đạc cho mẫu này. Số đo sẽ được thêm khi có nguồn đáng tin cậy."}
      </EmptyState>
    );
  }
  return (
    <>
      <p className="mb-3 text-[12.5px] text-muted">
        Số đo trích từ bài review độc lập, mỗi số đo dẫn về nguồn. Nhận xét giữ nguyên văn tiếng Anh của bài gốc. Chỉ nên so độ trễ đầu vào giữa
        các máy do cùng một nguồn đo.
      </p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3">
        {cards.map((c) => (
          <article key={c.key} className="flex flex-col rounded-panel border border-line bg-panel p-4">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-[14px] font-bold text-fg">{c.source}</h3>
              {c.dateText && <span className="num shrink-0 text-[11px] text-faint">{reviewMonth(c.dateText)}</span>}
            </div>
            {model && c.subject !== model && <div className="mt-0.5 text-[11.5px] text-muted">Số đo của: {c.subject}</div>}
            {!model && <div className="mt-0.5 text-[11.5px] font-semibold text-fg-2">{c.subject}</div>}
            {c.verdict && (
              <blockquote className="mt-2 text-[12.5px] leading-relaxed text-fg-2">
                <span className="mb-0.5 block text-[10.5px] text-faint">Trích nhận xét gốc</span>“{c.verdict}”
              </blockquote>
            )}
            {c.metrics.length > 0 && (
              <dl className="mt-3 border-t border-line-2">
                {c.metrics.map((m) => (
                  <div key={m.metric} className="flex items-baseline gap-2 border-b border-line-2 py-1.5 text-[12px]">
                    <dt className="min-w-0 flex-1 text-muted">{m.metric}</dt>
                    <dd className="num max-w-[45%] text-right text-fg">{m.value}</dd>
                    <a href={c.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-[11px] text-key hover:underline">
                      nguồn ↗
                    </a>
                  </div>
                ))}
              </dl>
            )}
            <a href={c.url} target="_blank" rel="noopener noreferrer" className="mt-auto pt-3 text-[12.5px] text-key hover:underline">
              Đọc bài review ↗
            </a>
          </article>
        ))}
      </div>
    </>
  );
}
