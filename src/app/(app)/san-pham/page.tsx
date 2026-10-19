import type { Metadata } from "next";

import { ProductMatrix } from "@/components/products/product-matrix";
import { comparable, getCatalog } from "@/lib/catalog";
import { productsMessages } from "@/lib/i18n/messages/products";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT(productsMessages)).matrix.title };
}

export default async function ProductsPage() {
  const { products } = await getCatalog();
  return <ProductMatrix items={products.filter((p) => p.isGigabyte).map(comparable)} />;
}
