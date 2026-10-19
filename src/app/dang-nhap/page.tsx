import type { Metadata } from "next";

import { HeaderBar, Logo } from "@/components/layout/header";
import { shellMessages } from "@/lib/i18n/messages/shell";
import { getT } from "@/lib/i18n/server";

import { LoginForm } from "./form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT(shellMessages)).login.title };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="flex min-h-dvh flex-col">
      <HeaderBar className="flex h-[59px] items-center px-3.5 pb-[3px] md:px-6">
        <Logo />
      </HeaderBar>
      <main className="flex flex-1 items-start justify-center px-3.5 pt-[70px]">
        <LoginForm next={next ?? "/"} />
      </main>
    </div>
  );
}
