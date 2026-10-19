import { getCatalog } from "@/lib/catalog";
import { fmtDate } from "@/lib/format";
import { shellMessages } from "@/lib/i18n/messages/shell";
import { getT } from "@/lib/i18n/server";

export async function Footer() {
  const [{ asOf }, t] = await Promise.all([getCatalog(), getT(shellMessages)]);
  return (
    <footer className="mx-auto mt-6 w-full max-w-[1920px] px-3.5 md:px-6">
      <div className="flex flex-wrap justify-between gap-2 border-t border-line py-5 text-[11px] text-faint">
        <span>{t.footer.org}</span>
        {asOf && <span className="num">{t.footer.prices(fmtDate(asOf))}</span>}
      </div>
    </footer>
  );
}
