import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Đối thủ" };

export default function Page() {
  return <ComingSoon eyebrow="Đối thủ" title="GIGABYTE so với ASUS, MSI, Samsung, LG, Dell/Alienware" />;
}
