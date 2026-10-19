import type { Metadata } from "next";

import { HeaderBar, Logo } from "@/components/layout/header";
import { PrefsMenu } from "@/components/layout/prefs-menu";
import { shellMessages } from "@/lib/i18n/messages/shell";
import { getT, getTheme } from "@/lib/i18n/server";

import { LoginForm } from "./form";
import { LoginIntro } from "./intro";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT(shellMessages)).login.title };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [{ next }, theme, t] = await Promise.all([searchParams, getTheme(), getT(shellMessages)]);
  return (
    <div className="flex min-h-dvh flex-col">
      <HeaderBar className="flex h-[59px] items-center px-3.5 pb-[3px] md:px-6">
        <Logo />
        <div className="ml-auto">
          <PrefsMenu theme={theme} />
        </div>
      </HeaderBar>
      {/* Phone: the card comes first, the description below it */}
      <main className="mx-auto grid w-full max-w-[1080px] flex-1 content-start gap-8 px-3.5 pt-8 pb-10 md:grid-cols-[minmax(0,1fr)_380px] md:gap-12 md:px-6 md:pt-[70px]">
        <div className="flex justify-center md:order-2">
          <LoginForm next={next ?? "/"} />
        </div>
        <LoginIntro />
      </main>
      <footer className="mx-auto w-full max-w-[1080px] px-3.5 md:px-6">
        <div className="border-t border-line py-5 text-[11px] text-faint">{t.footer.org}</div>
      </footer>
    </div>
  );
}
