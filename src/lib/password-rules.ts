// Password rules, safe to import in the browser (no Node crypto here)

export const MIN_PASSWORD = 8;

export type PasswordProblem = "short" | "long" | "mix";

/** Why a new password is too weak (a code, shown through shellMessages.password), else null */
export function passwordProblem(pw: string): PasswordProblem | null {
  if (pw.length < MIN_PASSWORD) return "short";
  if (pw.length > 200) return "long";
  if (!/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) return "mix";
  return null;
}

export function passwordMessage(p: PasswordProblem, m: { short: (n: number) => string; long: string; mix: string }): string {
  return p === "short" ? m.short(MIN_PASSWORD) : m[p];
}
