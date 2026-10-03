"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/form-controls";
import { RANGE_PRESET_LABELS, RANGE_PRESETS } from "@/lib/dates";
import type { ResolvedRange } from "@/lib/range";

/**
 * GET form for a date range: pick a preset, or edit the dates (which switches to Custom).
 * Extra filter controls can be passed as children; they submit with the form.
 */
export function RangeFilter({ range, children }: { range: ResolvedRange; children?: React.ReactNode }) {
  const presetRef = useRef<HTMLSelectElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const toCustom = () => {
    if (presetRef.current) presetRef.current.value = "";
  };

  return (
    <form ref={formRef} method="get" className="no-print flex flex-wrap items-end gap-3">
      <div className="grid gap-1">
        <Label htmlFor="f-range">Period</Label>
        <Select
          id="f-range"
          name="range"
          ref={presetRef}
          defaultValue={range.preset === "custom" ? "" : range.preset}
          className="w-40"
          onChange={() => formRef.current?.requestSubmit()}
        >
          {RANGE_PRESETS.map((p) => (
            <option key={p} value={p}>
              {RANGE_PRESET_LABELS[p]}
            </option>
          ))}
          <option value="">Custom dates</option>
        </Select>
      </div>
      <div className="grid gap-1">
        <Label htmlFor="f-from">From</Label>
        <Input id="f-from" name="from" type="date" defaultValue={range.from} onChange={toCustom} className="w-40" />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="f-to">To</Label>
        <Input id="f-to" name="to" type="date" defaultValue={range.to} onChange={toCustom} className="w-40" />
      </div>
      {children}
      <Button type="submit" variant="outline">
        Apply
      </Button>
    </form>
  );
}
