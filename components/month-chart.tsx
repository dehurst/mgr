"use client";

import { useState } from "react";
import { formatCents } from "@/lib/money";
import type { MonthTotal } from "@/lib/reports/expenses";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// Single series: the validated reference blue (passes contrast on the white card surface).
const BAR = "#2a78d6";

/** Whole-dollar axis labels: $0, $500, $1,000, $2.5K. */
function tickLabel(cents: number): string {
  const d = cents / 100;
  if (d >= 10_000) return `$${(d / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })}K`;
  return `$${d.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

/** Column chart of business expenses per month, with a per-column hover/focus tooltip. */
export function MonthChart({ year, months, ticks }: { year: number; months: MonthTotal[]; ticks: number[] }) {
  const [active, setActive] = useState<number | null>(null);
  const top = ticks[ticks.length - 1];
  const maxIdx = months.reduce((best, m, i) => (m.businessCents > months[best].businessCents ? i : best), 0);
  const hasData = months.some((m) => m.businessCents > 0);

  return (
    <div className="grid gap-2">
      <div className="flex">
        {/* Y axis */}
        <div className="relative h-48 w-14 shrink-0 text-right text-[11px] text-muted-foreground">
          {ticks.map((t) => (
            <span key={t} className="tabular absolute right-2" style={{ bottom: `${(t / top) * 100}%`, transform: "translateY(50%)" }}>
              {tickLabel(t)}
            </span>
          ))}
        </div>
        {/* Plot */}
        <div className="relative h-48 flex-1" onPointerLeave={() => setActive(null)}>
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0 border-t border-border" style={{ bottom: `${(t / top) * 100}%` }} />
          ))}
          <div className="absolute inset-0 flex">
            {months.map((m, i) => {
              const pct = (m.businessCents / top) * 100;
              const label = `${MONTHS[i]} ${year}: ${formatCents(m.businessCents)}`;
              return (
                <div
                  key={m.month}
                  role="img"
                  aria-label={label}
                  tabIndex={0}
                  className="group relative flex h-full flex-1 items-end justify-center outline-none"
                  onPointerEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                >
                  {m.businessCents > 0 && (
                    <div
                      className="w-full max-w-6 rounded-t-[4px] transition-opacity"
                      style={{ height: `${pct}%`, background: BAR, opacity: active === null || active === i ? 1 : 0.45 }}
                    />
                  )}
                  {/* Label only the biggest month; the tooltip and the list below carry the rest. */}
                  {hasData && i === maxIdx && active === null && (
                    <span
                      className="tabular pointer-events-none absolute -translate-y-full whitespace-nowrap pb-1 text-[11px] font-medium text-foreground"
                      style={{ bottom: `${pct}%` }}
                    >
                      {formatCents(m.businessCents)}
                    </span>
                  )}
                  {active === i && (
                    <div
                      className="pointer-events-none absolute z-10 whitespace-nowrap rounded-md border bg-background px-2.5 py-1.5 text-xs shadow-md"
                      style={{ bottom: `calc(${Math.min(pct, 70)}% + 8px)` }}
                    >
                      <div className="tabular font-semibold">{formatCents(m.businessCents)}</div>
                      <div className="text-muted-foreground">
                        {MONTHS[i]} {year} · business
                      </div>
                      {m.personalCents > 0 && (
                        <div className="tabular mt-0.5 text-muted-foreground">+ {formatCents(m.personalCents)} personal (not counted)</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {/* X axis */}
      <div className="flex pl-14 text-[11px] text-muted-foreground">
        {MONTHS.map((m) => (
          <span key={m} className="flex-1 text-center">
            {m}
          </span>
        ))}
      </div>
      {/* Table view for screen readers */}
      <table className="sr-only">
        <caption>Business expenses by month, {year}</caption>
        <tbody>
          {months.map((m, i) => (
            <tr key={m.month}>
              <th>{MONTHS[i]}</th>
              <td>{formatCents(m.businessCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
