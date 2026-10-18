import { describe, expect, it } from "vitest";
import { allowedEmails, authRequired, isAllowedEmail, missingAuthSettings, safeNext } from "./auth-config";

describe("auth config", () => {
  it("requires sign-in on Vercel even with nothing configured (fails closed), and wherever Google sign-in is set up", () => {
    expect(authRequired({})).toBe(false); // the Mac, as before
    expect(authRequired({ VERCEL: "1" })).toBe(true);
    expect(authRequired({ AUTH_GOOGLE_ID: "x" })).toBe(true);
    expect(missingAuthSettings({ VERCEL: "1" })).toEqual(["AUTH_SECRET", "AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET", "ALLOWED_EMAIL"]);
  });

  it("allows only the listed addresses, ignoring case and spaces", () => {
    const env = { ALLOWED_EMAIL: " Owner@Gmail.com , second@example.com" };
    expect(allowedEmails(env)).toEqual(["owner@gmail.com", "second@example.com"]);
    expect(isAllowedEmail("owner@gmail.com", env)).toBe(true);
    expect(isAllowedEmail("OWNER@gmail.com ", env)).toBe(true);
    expect(isAllowedEmail("someone@gmail.com", env)).toBe(false);
    expect(isAllowedEmail("owner@gmail.com.evil.com", env)).toBe(false);
    expect(isAllowedEmail(null, env)).toBe(false);
    expect(isAllowedEmail("", {})).toBe(false);
    expect(isAllowedEmail("anyone@x.com", { ALLOWED_EMAIL: "" })).toBe(false);
  });

  it("only redirects to same-site paths after sign-in", () => {
    expect(safeNext("/expenses?range=ytd")).toBe("/expenses?range=ytd");
    for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", undefined, ["/x"]]) expect(safeNext(bad)).toBe("/");
  });
});
