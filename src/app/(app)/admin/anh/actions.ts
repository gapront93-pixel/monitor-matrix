"use server";

import { revalidatePath } from "next/cache";

import { userWith } from "@/lib/auth";
import { importMessages } from "@/lib/i18n/messages/import";
import { getLocale } from "@/lib/i18n/server";
import { deleteProductImage } from "@/lib/images";

import type { ActionResult } from "../data-actions";

export async function removeImage(productId: number): Promise<ActionResult> {
  const m = importMessages[await getLocale()].images;
  if (!(await userWith("images"))) return { ok: false, error: m.noRight };
  await deleteProductImage(productId);
  revalidatePath("/", "layout");
  return { ok: true, message: m.deleted };
}
