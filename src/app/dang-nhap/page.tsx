import type { Metadata } from "next";

import { Logo } from "@/components/layout/header";

import { ViewerLoginForm } from "./form";

export const metadata: Metadata = { title: "Đăng nhập" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-[54px] items-center border-b border-line bg-head px-3.5 md:px-5">
        <Logo />
      </header>
      <main className="flex flex-1 items-start justify-center px-3.5 pt-[70px]">
        <ViewerLoginForm next={next ?? "/"} />
      </main>
    </div>
  );
}
