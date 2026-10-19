"use server";

import { getCurrentUser, startSession } from "@/lib/auth";
import { shellMessages } from "@/lib/i18n/messages/shell";
import { getT } from "@/lib/i18n/server";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/password";
import { passwordMessage } from "@/lib/password-rules";
import { prisma } from "@/lib/prisma";

export type PasswordState = { error?: string; ok?: boolean };

/** Changes your own password; other devices are signed out, this one stays signed in */
export async function changePassword(_prev: PasswordState, form: FormData): Promise<PasswordState> {
  const [me, m] = await Promise.all([getCurrentUser(), getT(shellMessages)]);
  const t = m.account;
  if (!me) return { error: t.expired };
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  const again = String(form.get("again") ?? "");
  if (!current || !next) return { error: t.fill };
  if (next !== again) return { error: t.mismatch };
  const weak = passwordProblem(next);
  if (weak) return { error: passwordMessage(weak, m.password) };
  const user = await prisma.user.findUnique({ where: { id: me.id } });
  if (!user || !(await verifyPassword(current, user.passwordHash))) return { error: t.wrongCurrent };
  const updated = await prisma.user.update({
    where: { id: me.id },
    data: { passwordHash: await hashPassword(next), sessionVersion: { increment: 1 } },
  });
  await startSession(updated);
  return { ok: true };
}
