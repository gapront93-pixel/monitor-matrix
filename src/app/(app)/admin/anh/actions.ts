"use server";

import { revalidatePath } from "next/cache";

import { userWith } from "@/lib/auth";
import { deleteProductImage } from "@/lib/images";

import type { ActionResult } from "../data-actions";

export async function removeImage(productId: number): Promise<ActionResult> {
  if (!(await userWith("images"))) return { ok: false, error: "Bạn không có quyền quản lý ảnh." };
  await deleteProductImage(productId);
  revalidatePath("/", "layout");
  return { ok: true, message: "Đã xoá ảnh." };
}
