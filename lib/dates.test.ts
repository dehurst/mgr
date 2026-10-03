import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  daysBetween,
  endOfMonth,
  formatDate,
  inRange,
  isValidDate,
  presetRange,
  today,
} from "./dates";

describe("isValidDate", () => {
  it("accepts real dates", () => {
    expect(isValidDate("2026-01-01")).toBe(true);
    expect(isValidDate("2024-02-29")).toBe(true);
    expect(isValidDate("2026-12-31")).toBe(true);
  });
  it.each(["2026-02-29", "2026-13-01", "2026-00-10", "2026-04-31", "2026-1-1", "", "2026/01/01"])(
    "rejects %j",
    (s) => expect(isValidDate(s)).toBe(false),
  );
});

describe("today", () => {
  it("uses local calendar date, not UTC", () => {
    // 11:30pm local on Dec 31 is still Dec 31 regardless of time zone.
    expect(today(new Date(2026, 11, 31, 23, 30))).toBe("2026-12-31");
    expect(today(new Date(2027, 0, 1, 0, 5))).toBe("2027-01-01");
  });
});

describe("arithmetic", () => {
  it("addDays crosses month and year boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
    expect(addDays("2026-01-31", 15)).toBe("2026-02-15");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2026-03-07", 2)).toBe("2026-03-09"); // across US DST change
  });

  it("daysBetween", () => {
    expect(daysBetween("2026-01-01", "2026-01-31")).toBe(30);
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
    expect(daysBetween("2026-02-01", "2026-01-01")).toBe(-31);
    expect(daysBetween("2026-03-01", "2026-03-15")).toBe(14); // across DST
  });

  it("addMonths clamps the day", () => {
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
    expect(addMonths("2024-03-31", -1)).toBe("2024-02-29");
    expect(addMonths("2026-01-15", -1)).toBe("2025-12-15");
    expect(addMonths("2026-11-30", 3)).toBe("2027-02-28");
  });

  it("endOfMonth", () => {
    expect(endOfMonth("2026-02-10")).toBe("2026-02-28");
    expect(endOfMonth("2028-02-10")).toBe("2028-02-29");
    expect(endOfMonth("2026-12-01")).toBe("2026-12-31");
  });
});

describe("inRange is inclusive on both ends", () => {
  const year2026 = { from: "2026-01-01", to: "2026-12-31" };
  it("Dec 31 is in the year, Jan 1 of next year is not", () => {
    expect(inRange("2026-12-31", year2026)).toBe(true);
    expect(inRange("2027-01-01", year2026)).toBe(false);
    expect(inRange("2026-01-01", year2026)).toBe(true);
    expect(inRange("2025-12-31", year2026)).toBe(false);
  });
});

describe("presetRange", () => {
  const ref = "2026-10-03";
  it.each([
    ["this_month", "2026-10-01", "2026-10-31"],
    ["last_month", "2026-09-01", "2026-09-30"],
    ["this_quarter", "2026-10-01", "2026-12-31"],
    ["last_quarter", "2026-07-01", "2026-09-30"],
    ["ytd", "2026-01-01", "2026-10-03"],
    ["this_year", "2026-01-01", "2026-12-31"],
    ["last_year", "2025-01-01", "2025-12-31"],
  ] as const)("%s", (preset, from, to) => {
    expect(presetRange(preset, ref)).toEqual({ from, to });
  });

  it("handles January (last month/quarter fall in the prior year)", () => {
    expect(presetRange("last_month", "2026-01-15")).toEqual({ from: "2025-12-01", to: "2025-12-31" });
    expect(presetRange("last_quarter", "2026-01-15")).toEqual({ from: "2025-10-01", to: "2025-12-31" });
  });

  it("handles March 31 (last month is February)", () => {
    expect(presetRange("last_month", "2026-03-31")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });
});

describe("formatDate", () => {
  it("formats without time zone shifts", () => {
    expect(formatDate("2026-01-01")).toBe("Jan 1, 2026");
    expect(formatDate("2026-12-31")).toBe("Dec 31, 2026");
    expect(formatDate(null)).toBe("");
  });
});
