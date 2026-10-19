import { readStoredImage } from "@/lib/images";

export const runtime = "nodejs";

// Product photos from storage/images. Behind the login (proxy.ts), so browsers cache them privately only.
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const body = await readStoredImage(file);
  if (!body) return new Response("Không có ảnh", { status: 404, headers: { "Cache-Control": "no-store" } });
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": "image/webp",
      // URLs carry ?v=<updated>, so a long private cache is safe
      "Cache-Control": "private, max-age=2592000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
