// User accounts from the VPS command line, for the first admin or a forgotten admin password.
//   npm run user -- list
//   npm run user -- create <email> <admin|mod|viewer> "<Họ tên>"     (prints a new password)
//   npm run user -- reset <email>                                     (new password, ends their sessions)
//   npm run user -- bootstrap                                         (first admin from ADMIN_EMAIL + ADMIN_PASSWORD in .env)
import "dotenv/config";

import { randomInt } from "node:crypto";

import { hashPassword, passwordProblem } from "../src/lib/password";
import { prisma } from "../src/lib/prisma";

const ROLES = ["admin", "mod", "viewer"] as const;
type Role = (typeof ROLES)[number];

/** 12 characters, letters + digits, no look-alikes (0/O, 1/l) */
function newPassword(): string {
  const letters = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ";
  const digits = "23456789";
  const all = letters + digits;
  const chars = [letters[randomInt(letters.length)], digits[randomInt(digits.length)]];
  while (chars.length < 12) chars.push(all[randomInt(all.length)]);
  return chars.sort(() => randomInt(3) - 1).join("");
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  if (cmd === "list") {
    const users = await prisma.user.findMany({ orderBy: [{ role: "asc" }, { email: "asc" }] });
    for (const u of users) console.log(`${u.active ? " " : "x"} ${u.role.padEnd(6)} ${u.email.padEnd(34)} ${u.name}`);
    if (!users.length) console.log("Chưa có tài khoản nào. Chạy: npm run user -- bootstrap");
    return;
  }
  if (cmd === "create") {
    const [emailRaw, role, ...nameParts] = args;
    const email = emailRaw?.trim().toLowerCase();
    if (!email || !ROLES.includes(role as Role) || !nameParts.length) throw new Error('Cách dùng: npm run user -- create <email> <admin|mod|viewer> "<Họ tên>"');
    if (await prisma.user.findUnique({ where: { email } })) throw new Error(`${email} đã có tài khoản. Dùng: npm run user -- reset ${email}`);
    const password = newPassword();
    await prisma.user.create({ data: { email, role: role as Role, name: nameParts.join(" "), passwordHash: await hashPassword(password) } });
    console.log(`Đã tạo ${email} (${role}). Mật khẩu: ${password}`);
    return;
  }
  if (cmd === "reset") {
    const email = args[0]?.trim().toLowerCase();
    if (!email) throw new Error("Cách dùng: npm run user -- reset <email>");
    const password = newPassword();
    await prisma.user.update({ where: { email }, data: { passwordHash: await hashPassword(password), sessionVersion: { increment: 1 }, active: true } });
    console.log(`Đã đặt mật khẩu mới cho ${email}: ${password}\n(Tài khoản được mở khoá; các phiên đăng nhập cũ đã bị đăng xuất.)`);
    return;
  }
  if (cmd === "bootstrap") {
    if (await prisma.user.count()) {
      console.log("Đã có tài khoản, bỏ qua. Dùng `npm run user -- list` để xem.");
      return;
    }
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD ?? "";
    if (!email || !password) throw new Error("Cần ADMIN_EMAIL và ADMIN_PASSWORD trong .env");
    const weak = passwordProblem(password);
    if (weak) throw new Error(`ADMIN_PASSWORD chưa đủ mạnh: ${weak}`);
    await prisma.user.create({ data: { email, role: "admin", name: process.env.ADMIN_NAME?.trim() || "Admin", passwordHash: await hashPassword(password) } });
    console.log(`Đã tạo Admin đầu tiên: ${email} (mật khẩu = ADMIN_PASSWORD trong .env). Có thể xoá ADMIN_PASSWORD khỏi .env.`);
    return;
  }
  throw new Error("Lệnh: list | create | reset | bootstrap");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
