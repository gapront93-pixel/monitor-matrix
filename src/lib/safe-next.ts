/** Only same-site paths, so ?next= cannot send people elsewhere */
export function safeNext(v: unknown): string {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/login") ? s : "/";
}
