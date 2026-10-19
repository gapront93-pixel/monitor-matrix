import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Bảng giá" };

export default function Page() {
  return <ComingSoon eyebrow="Bảng giá" title="Giá bán lẻ theo đại lý" />;
}
