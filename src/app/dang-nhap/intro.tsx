import { ChartColumnIcon, GitCompareArrowsIcon, LayoutGridIcon, TagsIcon } from "lucide-react";

import { shellMessages } from "@/lib/i18n/messages/shell";
import { getT } from "@/lib/i18n/server";

// One icon per feature, in the order of login.intro.features
const ICONS = [LayoutGridIcon, GitCompareArrowsIcon, TagsIcon, ChartColumnIcon];

/** What the tool does, next to the login card. Public page: no data, only a description. */
export async function LoginIntro() {
  const t = await getT(shellMessages);
  const intro = t.login.intro;
  const roles = [t.roles.admin, t.roles.mod, t.roles.viewer];
  return (
    <section className="flex min-w-0 flex-col gap-6">
      <div>
        <div className="eyebrow mb-1.5">{intro.eyebrow}</div>
        <h2 className="text-[24px] leading-tight font-bold text-balance text-fg md:text-[28px]">{intro.title}</h2>
        <p className="mt-2.5 max-w-[560px] text-[13.5px] leading-relaxed text-fg-2">{intro.lead}</p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {intro.features.map((f, i) => {
          const Icon = ICONS[i];
          return (
            <li key={f.title} className="flex gap-3 rounded-panel border border-line bg-panel p-3.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-ctl bg-accent-tint text-accent">
                <Icon className="size-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <h3 className="text-[13px] font-semibold text-fg">{f.title}</h3>
                <p className="mt-1 text-[12px] leading-relaxed text-muted">{f.text}</p>
              </div>
            </li>
          );
        })}
      </ul>

      <div>
        <div className="eyebrow mb-2">{intro.rolesTitle}</div>
        <dl className="flex flex-col gap-1.5 text-[12px]">
          {roles.map((r) => (
            <div key={r.label} className="flex gap-2">
              <dt className="w-14 shrink-0 font-semibold text-fg-2">{r.label}</dt>
              <dd className="text-muted">{r.hint}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
