// Resolve a date range from URL search params: ?range=<preset> or ?from=…&to=… (custom).
import { isValidDate, presetRange, RANGE_PRESETS, type DateRange, type DateStr, type RangePreset } from "./dates";

export type ResolvedRange = DateRange & { preset: RangePreset | "custom" };

type Params = Record<string, string | string[] | undefined>;

function one(sp: Params, key: string): string {
  const v = sp[key];
  return typeof v === "string" ? v : "";
}

export function resolveRange(sp: Params, today: DateStr, fallback: RangePreset = "this_year"): ResolvedRange {
  const preset = one(sp, "range");
  if ((RANGE_PRESETS as readonly string[]).includes(preset)) {
    return { ...presetRange(preset as RangePreset, today), preset: preset as RangePreset };
  }
  const from = one(sp, "from");
  const to = one(sp, "to");
  if (isValidDate(from) && isValidDate(to)) {
    return from <= to ? { from, to, preset: "custom" } : { from: to, to: from, preset: "custom" };
  }
  return { ...presetRange(fallback, today), preset: fallback };
}

/** Query string that reproduces a resolved range (preset name, or explicit dates). */
export function rangeQuery(r: ResolvedRange): string {
  return r.preset === "custom" ? `from=${r.from}&to=${r.to}` : `range=${r.preset}`;
}
