import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "So sánh" };

export default function Page() {
  return <ComingSoon eyebrow="So sánh" title="So sánh mẫu" />;
}
