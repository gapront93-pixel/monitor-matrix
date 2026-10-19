import type { Metadata } from "next";

import { ProductMatrix } from "@/components/products/product-matrix";
import { comparable, getCatalog } from "@/lib/catalog";

export const metadata: Metadata = { title: "Sản phẩm" };

export default async function ProductsPage() {
  const { products } = await getCatalog();
  return <ProductMatrix items={products.filter((p) => p.isGigabyte).map(comparable)} />;
}
