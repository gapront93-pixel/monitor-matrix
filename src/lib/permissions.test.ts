import { describe, expect, it } from "vitest";

import { hashPassword, passwordProblem, verifyPassword } from "./password";
import { can, canManage } from "./permissions";

describe("permissions", () => {
  it("viewer only views", () => {
    expect(can("viewer", "view")).toBe(true);
    for (const p of ["prices", "unmatched", "segments", "dealers.edit", "dealers.delete", "users"] as const) expect(can("viewer", p)).toBe(false);
    expect(canManage("viewer")).toBe(false);
  });
  it("mod updates prices, segments and dealers but cannot delete dealers or manage users", () => {
    expect(["prices", "unmatched", "segments", "dealers.edit"].every((p) => can("mod", p as never))).toBe(true);
    expect(can("mod", "dealers.delete")).toBe(false);
    expect(can("mod", "users")).toBe(false);
    expect(canManage("mod")).toBe(true);
  });
  it("admin can do everything; no role can do nothing", () => {
    expect(can("admin", "users") && can("admin", "dealers.delete")).toBe(true);
    expect(can(null, "view")).toBe(false);
  });
});

describe("password", () => {
  it("verifies the right password only", async () => {
    const h = await hashPassword("monitor2026");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("monitor2026", h)).toBe(true);
    expect(await verifyPassword("monitor2027", h)).toBe(false);
    expect(await verifyPassword("x", "not-a-hash")).toBe(false);
  });
  it("uses a new salt every time", async () => {
    expect(await hashPassword("abc12345")).not.toBe(await hashPassword("abc12345"));
  });
  it("rejects weak passwords in Vietnamese", () => {
    expect(passwordProblem("abc123")).toMatch(/8 ký tự/);
    expect(passwordProblem("abcdefgh")).toMatch(/chữ và số/);
    expect(passwordProblem("monitor2026")).toBeNull();
  });
});
