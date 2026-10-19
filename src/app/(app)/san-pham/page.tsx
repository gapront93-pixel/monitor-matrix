import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Sản phẩm" };

export default function Page() {
  return <ComingSoon eyebrow="Sản phẩm" title="Ma trận màn hình GIGABYTE" />;
}
