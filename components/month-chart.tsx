"use client";

import { useState } from "react";
import { formatCents } from "@/lib/money";
import type { MonthTotal } from "@/lib/reports/expenses";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// Categorical slots 1 and 2, validated as a pair on the white card surface (contrast + color-blind checks).
const BUSINESS = "#2a78d6";
const PERSONAL = "#eb6834";

/** Whole-dollar axis labels: $0, $500, $1,000, $2.5K. */
function tickLabel(cents: number): string {
  const d = cents / 100;
  if (d >= 10_000) return `$${(d / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })}K`;
  return `$${d.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function Swatch({ color }: { color: string }) {
  return <span className="inline-block size-2.5 shrink-0 rounded-[2px]" style={{ background: color }} />;
}

/**
 * Stacked columns per month: business at the baseline (so months compare on business spend),
 * personal stacked above, total = the column's height. "Business only" rescales to business.
 * `ticks` and `businessTicks` are the y-axis steps for each view.
 */
export function MonthChart({
  year,
  months,
  ticks,
  businessTicks,
}: {
  year: number;
  months: MonthTotal[];
  ticks: number[];
  businessTicks: number[];
}) {
  const [active, setActive] = useState<number | null>(null);
  const hasPersonal = months.some((m) => m.personalCents > 0);
  const [showPersonal, setShowPersonal] = useState(true);
  const stacked = hasPersonal && showPersonal;
  const axis = stacked ? ticks : businessTicks;
  const top = axis[axis.length - 1];
  const shown = (m: MonthTotal) => m.businessCents + (stacked ? m.personalCents : 0);
  const maxIdx = months.reduce((best, m, i) => (shown(m) > shown(months[best]) ? i : best), 0);
  const hasData = months.some((m) => shown(m) > 0);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-1.5">
            <Swatch color={BUSINESS} /> Business
          </span>
          {stacked && (
            <span className="flex items-center gap-1.5">
              <Swatch color={PERSONAL} /> Personal
            </span>
          )}
        </div>
        {hasPersonal && (
          <div className="flex rounded-md border p-0.5" role="group" aria-label="Chart view">
            {[
              [true, "Business + personal"],
              [false, "Business only"],
            ].map(([value, label]) => (
              <button
                key={String(value)}
                type="button"
                aria-pressed={showPersonal === value}
                onClick={() => setShowPersonal(value as boolean)}
                className={`rounded px-2 py-0.5 ${showPersonal === value ? "bg-muted font-medium text-foreground" : ""}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex">
        {/* Y axis */}
        <div className="relative h-48 w-14 shrink-0 text-right text-[11px] text-muted-foreground">
          {axis.map((t) => (
            <span key={t} className="tabular absolute right-2" style={{ bottom: `${(t / top) * 100}%`, transform: "translateY(50%)" }}>
              {tickLabel(t)}
            </span>
          ))}
        </div>
        {/* Plot */}
        <div className="relative h-48 flex-1" onPointerLeave={() => setActive(null)}>
          {axis.map((t) => (
            <div key={t} className="absolute inset-x-0 border-t border-border" style={{ bottom: `${(t / top) * 100}%` }} />
          ))}
          <div className="absolute inset-0 flex">
            {months.map((m, i) => {
              const total = m.businessCents + m.personalCents;
              const pct = (shown(m) / top) * 100;
              const label = stacked
                ? `${MONTHS[i]} ${year}: ${formatCents(m.businessCents)} business, ${formatCents(m.personalCents)} personal, ${formatCents(total)} total`
                : `${MONTHS[i]} ${year}: ${formatCents(m.businessCents)} business`;
              const segments = [
                { key: "business", cents: m.businessCents, color: BUSINESS },
                ...(stacked ? [{ key: "personal", cents: m.personalCents, color: PERSONAL }] : []),
              ].filter((s) => s.cents > 0);
              return (
                <div
                  key={m.month}
                  role="img"
                  aria-label={label}
                  tabIndex={0}
                  className="relative flex h-full flex-1 items-end justify-center outline-none"
                  onPointerEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                >
                  {segments.length > 0 && (
                    <div
                      className="flex w-full max-w-6 flex-col-reverse gap-[2px] transition-opacity"
                      style={{ height: `${pct}%`, opacity: active === null || active === i ? 1 : 0.45 }}
                    >
                      {/* Column-reverse: first segment sits on the baseline; only the top one is rounded. */}
                      {segments.map((s, j) => (
                        <div
                          key={s.key}
                          className={j === segments.length - 1 ? "rounded-t-[4px]" : ""}
                          style={{ flexGrow: s.cents, flexBasis: 0, minHeight: 1, background: s.color }}
                        />
                      ))}
                    </div>
                  )}
                  {/* Label only the biggest month; the tooltip and the list below carry the rest. */}
                  {hasData && i === maxIdx && active === null && (
                    <span
                      className="tabular pointer-events-none absolute -translate-y-full whitespace-nowrap pb-1 text-[11px] font-medium text-foreground"
                      style={{ bottom: `${pct}%` }}
                    >
                      {formatCents(shown(m))}
                    </span>
                  )}
                  {active === i && (
                    <div
                      className={`pointer-events-none absolute z-10 grid gap-0.5 whitespace-nowrap rounded-md border bg-background px-2.5 py-1.5 text-xs shadow-md ${
                        i >= 9 ? "right-0" : i <= 2 ? "left-0" : ""
                      }`}
                      style={{ bottom: `calc(${Math.min(pct, 55)}% + 8px)` }}
                    >
                      <div className="font-semibold">
                        {MONTHS[i]} {year}
                      </div>
                      <TipRow color={BUSINESS} label="Business" cents={m.businessCents} />
                      <TipRow color={PERSONAL} label={stacked ? "Personal" : "Personal (hidden)"} cents={m.personalCents} />
                      <div className="tabular mt-0.5 flex justify-between gap-4 border-t pt-0.5 font-medium">
                        <span>Total</span>
                        <span>{formatCents(total)}</span>
                      </div>
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
        <caption>Expenses by month, {year}</caption>
        <thead>
          <tr>
            <th>Month</th>
            <th>Business</th>
            <th>Personal</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {months.map((m, i) => (
            <tr key={m.month}>
              <th>{MONTHS[i]}</th>
              <td>{formatCents(m.businessCents)}</td>
              <td>{formatCents(m.personalCents)}</td>
              <td>{formatCents(m.businessCents + m.personalCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TipRow({ color, label, cents }: { color: string; label: string; cents: number }) {
  return (
    <div className="tabular flex items-center justify-between gap-4">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <Swatch color={color} /> {label}
      </span>
      <span>{formatCents(cents)}</span>
    </div>
  );
}
