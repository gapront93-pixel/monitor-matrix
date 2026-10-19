import Link from "next/link";

import { ButtonLink } from "@/components/ui/button";
import { PageHeader, Panel, VerdictTag } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/states";
import { getCatalog } from "@/lib/catalog";
import { byRivalBrand, fmtDate, fmtDayMonth, modelCode } from "@/lib/format";

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Panel className="px-[18px] py-4">
      <div className="text-[12.5px] text-fg-2">{label}</div>
      <div className="num mt-1.5 text-[30px] leading-tight font-semibold tracking-[-0.02em] text-fg">{value}</div>
      <div className="mt-1 text-[12px] text-muted">{sub}</div>
    </Panel>
  );
}

export default async function OverviewPage() {
  const { products, dealers, segments, asOf, imports } = await getCatalog();
  const gigabyte = products.filter((p) => p.isGigabyte);
  const priced = gigabyte.filter((p) => p.prices.some((c) => c.priceVnd !== null));
  const tracked = dealers.filter((d) => d.visible);
  const latest = imports[0];

  return (
    <>
      <PageHeader
        eyebrow="Tổng quan"
        title="Danh mục màn hình GIGABYTE tại Việt Nam"
        actions={
          <>
            <ButtonLink href="/bang-gia" variant="primary">
              Mở bảng giá
            </ButtonLink>
            <ButtonLink href="/san-pham">Xem sản phẩm</ButtonLink>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
        <Kpi label="Mẫu GIGABYTE" value={String(gigabyte.length)} sub="theo trang thông số gigabyte.com" />
        <Kpi label="Mẫu đang có giá" value={String(priced.length)} sub="có ít nhất 1 đại lý niêm yết" />
        <Kpi label="Đại lý theo dõi" value={String(tracked.length)} sub={`${tracked.filter((d) => d.isKey).length} đại lý trọng điểm`} />
        <Kpi
          label="Cập nhật giá"
          value={asOf ? fmtDayMonth(asOf) : "—"}
          sub={asOf ? `${fmtDate(asOf)} · ${latest?.source === "admin" ? "tải lên từ Quản trị" : "dữ liệu khởi tạo"}` : "Chưa có lần nhập giá nào"}
        />
      </div>

      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-bold text-fg">Phân khúc</h2>
        <span className="text-[12px] text-muted">Kết luận dựa trên thông số, số đo review và giá thấp nhất tại đại lý</span>
      </div>

      {segments.length === 0 ? (
        <EmptyState title="Chưa có phân khúc">Chạy lệnh seed để nạp dữ liệu phân khúc.</EmptyState>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3">
          {segments.map((s) => {
            const mine = products.filter((p) => p.segmentId === s.id && p.isGigabyte);
            const rivals = products.filter((p) => p.segmentId === s.id && !p.isGigabyte).sort(byRivalBrand);
            const rivalText = rivals
              .slice(0, 3)
              .map((r) => (r.brand === "Dell" ? modelCode(r.model) : `${r.brand} ${modelCode(r.model)}`))
              .join(" · ");
            return (
              <Link
                key={s.id}
                href={`/doi-thu?pk=${s.id}`}
                className="group flex flex-col rounded-panel border border-line bg-panel px-4 py-3.5 transition-colors hover:border-line-hover"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-[14px] leading-snug font-semibold text-fg">{s.shortName}</h3>
                  <div className="shrink-0 text-right whitespace-nowrap">
                    <span className="num text-[22px] leading-none font-semibold text-fg">{mine.length}</span>
                    <span className="ml-1 text-[11px] text-muted">mẫu</span>
                  </div>
                </div>
                <p className="mt-2.5 text-[12px] leading-relaxed text-muted">
                  Đối thủ chính: <span className="text-fg-2">{rivalText || "—"}</span>
                </p>
                <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                  <VerdictTag verdict={s.verdict} />
                  <span className="text-[12px] text-muted group-hover:text-fg">Xem đối thủ →</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
