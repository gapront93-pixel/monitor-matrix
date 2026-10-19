// Password rules, safe to import in the browser (no Node crypto here)

export const MIN_PASSWORD = 8;

/** Vietnamese message when a new password is too weak, else null */
export function passwordProblem(pw: string): string | null {
  if (pw.length < MIN_PASSWORD) return `Mật khẩu cần ít nhất ${MIN_PASSWORD} ký tự.`;
  if (pw.length > 200) return "Mật khẩu quá dài.";
  if (!/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) return "Mật khẩu cần có cả chữ và số.";
  return null;
}
