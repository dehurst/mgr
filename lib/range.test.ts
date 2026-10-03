import { describe, expect, it } from "vitest";
import { resolveRange } from "./range";

describe("resolveRange", () => {
  const today = "2026-10-03";
  it("uses a preset", () => {
    expect(resolveRange({ range: "last_year" }, today)).toEqual({ from: "2025-01-01", to: "2025-12-31", preset: "last_year" });
  });
  it("uses a custom range and swaps reversed dates", () => {
    expect(resolveRange({ from: "2026-02-01", to: "2026-02-28" }, today)).toMatchObject({ from: "2026-02-01", to: "2026-02-28", preset: "custom" });
    expect(resolveRange({ from: "2026-03-01", to: "2026-02-01" }, today)).toMatchObject({ from: "2026-02-01", to: "2026-03-01" });
  });
  it("falls back on junk", () => {
    expect(resolveRange({ range: "nope", from: "2026-02-30", to: "x" }, today)).toEqual({ from: "2026-01-01", to: "2026-12-31", preset: "this_year" });
    expect(resolveRange({}, today, "ytd")).toEqual({ from: "2026-01-01", to: "2026-10-03", preset: "ytd" });
  });
});
