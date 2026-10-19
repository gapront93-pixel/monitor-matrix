import { getCatalog } from "@/lib/catalog";
import { fmtDate } from "@/lib/format";

export async function Footer() {
  const { asOf } = await getCatalog();
  return (
    <footer className="mx-auto mt-6 w-full max-w-[1920px] px-3.5 md:px-6">
      <div className="flex flex-wrap justify-between gap-2 border-t border-line py-5 text-[11px] text-faint">
        <span>GIGABYTE Việt Nam · Marketing · công cụ nội bộ</span>
        {asOf && <span className="num">Giá cập nhật {fmtDate(asOf)}</span>}
      </div>
    </footer>
  );
}
