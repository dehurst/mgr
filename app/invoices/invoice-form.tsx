"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { Alert, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/misc";
import { useFormAction } from "@/components/use-form-action";
import { addDays, daysBetween, isValidDate } from "@/lib/dates";
import type { LineDraft } from "@/lib/invoices";
import { centsToInput, formatCents, lineAmountCents, parseCents, parseQuantityMilli } from "@/lib/money";
import { saveInvoice } from "./actions";

export type ClientOption = { id: number; name: string; defaultRateCents: number | null };

type Row = LineDraft & { key: number };

let nextKey = 1;
const row = (d: Partial<LineDraft> = {}): Row => ({ key: nextKey++, description: "", hours: "", rate: "", ...d });

export function InvoiceForm({
  invoiceId,
  clients,
  initial,
  defaultTermsDays,
}: {
  invoiceId: number | null;
  clients: ClientOption[];
  initial: { clientId: string; number: string; issuedOn: string; dueOn: string; notes: string; lines: LineDraft[] };
  defaultTermsDays: number;
}) {
  const { state, errors: e, onSubmit, pending } = useFormAction(saveInvoice.bind(null, invoiceId));
  const [clientId, setClientId] = useState(initial.clientId);
  const [issuedOn, setIssuedOn] = useState(initial.issuedOn);
  const [dueOn, setDueOn] = useState(initial.dueOn);
  const [rows, setRows] = useState<Row[]>(() => (initial.lines.length ? initial.lines.map((l) => row(l)) : [row()]));

  const clientRate = (id: string) => {
    const c = clients.find((x) => String(x.id) === id);
    return c?.defaultRateCents != null ? centsToInput(c.defaultRateCents) : "";
  };

  // Seed the first empty row's rate from the client's default rate.
  const changeClient = (id: string) => {
    setClientId(id);
    const rate = clientRate(id);
    if (rate) setRows((rs) => rs.map((r) => (r.rate ? r : { ...r, rate })));
  };

  // Keep the same payment terms when the issue date moves.
  const changeIssued = (v: string) => {
    if (isValidDate(v) && isValidDate(issuedOn) && isValidDate(dueOn)) {
      setDueOn(addDays(v, Math.max(0, daysBetween(issuedOn, dueOn))));
    } else if (isValidDate(v)) {
      setDueOn(addDays(v, defaultTermsDays));
    }
    setIssuedOn(v);
  };

  const update = (key: number, patch: Partial<LineDraft>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const remove = (key: number) => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.key !== key) : [row()]));
  const move = (i: number, dir: -1 | 1) =>
    setRows((rs) => {
      const j = i + dir;
      if (j < 0 || j >= rs.length) return rs;
      const copy = [...rs];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });

  const amounts = useMemo(
    () =>
      rows.map((r) => {
        const q = parseQuantityMilli(r.hours);
        const p = parseCents(r.rate);
        return q !== null && p !== null && p >= 0 ? lineAmountCents(q, p) : null;
      }),
    [rows],
  );
  const total = amounts.reduce<number>((s, a) => s + (a ?? 0), 0);
  const hours = rows.reduce((s, r) => s + (parseQuantityMilli(r.hours) ?? 0), 0);

  return (
    <form onSubmit={onSubmit} className="grid gap-6">
      {state.message && !state.ok && <Alert variant="destructive">{state.message}</Alert>}
      <input type="hidden" name="lines" value={JSON.stringify(rows.map(({ description, hours, rate }) => ({ description, hours, rate })))} />

      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-4">
          <Field label="Client" htmlFor="clientId" error={e.clientId} className="sm:col-span-2">
            <Select id="clientId" name="clientId" value={clientId} onChange={(ev) => changeClient(ev.target.value)} required>
              <option value="">Choose a client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Invoice number" htmlFor="number" error={e.number} hint="Change only to match an old QuickBooks number." className="sm:col-span-2">
            <Input id="number" name="number" defaultValue={initial.number} required />
          </Field>
          <Field label="Issue date" htmlFor="issuedOn" error={e.issuedOn}>
            <Input id="issuedOn" name="issuedOn" type="date" value={issuedOn} onChange={(ev) => changeIssued(ev.target.value)} required />
          </Field>
          <Field
            label="Due date"
            htmlFor="dueOn"
            error={e.dueOn}
            hint={isValidDate(issuedOn) && isValidDate(dueOn) ? `Net ${daysBetween(issuedOn, dueOn)}` : undefined}
          >
            <Input id="dueOn" name="dueOn" type="date" value={dueOn} onChange={(ev) => setDueOn(ev.target.value)} required />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Line items</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          <div className="hidden grid-cols-[1fr_6rem_7rem_7rem_5.5rem] gap-2 px-1 text-xs font-medium text-muted-foreground sm:grid">
            <span>Description</span>
            <span className="text-right">Hours</span>
            <span className="text-right">Rate</span>
            <span className="text-right">Amount</span>
            <span />
          </div>
          {rows.map((r, i) => (
            <div key={r.key} className="grid grid-cols-[1fr_6rem_7rem_7rem_5.5rem] items-center gap-2">
              <Input aria-label="Description" placeholder="What you did" value={r.description} onChange={(ev) => update(r.key, { description: ev.target.value })} />
              <Input aria-label="Hours" inputMode="decimal" className="text-right" placeholder="0" value={r.hours} onChange={(ev) => update(r.key, { hours: ev.target.value })} />
              <Input
                aria-label="Rate"
                inputMode="decimal"
                className="text-right"
                placeholder="0.00"
                value={r.rate}
                onChange={(ev) => update(r.key, { rate: ev.target.value })}
              />
              <span className={`tabular text-right text-sm ${amounts[i] === null && (r.hours || r.rate) ? "text-destructive" : ""}`}>
                {amounts[i] === null ? (r.hours || r.rate ? "check" : "—") : formatCents(amounts[i])}
              </span>
              <span className="flex justify-end">
                <Button type="button" variant="ghost" size="icon" className="size-7" aria-label="Move up" onClick={() => move(i, -1)} disabled={i === 0}>
                  ↑
                </Button>
                <Button type="button" variant="ghost" size="icon" className="size-7" aria-label="Move down" onClick={() => move(i, 1)} disabled={i === rows.length - 1}>
                  ↓
                </Button>
                <Button type="button" variant="ghost" size="icon" className="size-7" aria-label="Remove line" onClick={() => remove(r.key)}>
                  ✕
                </Button>
              </span>
            </div>
          ))}
          {e.lines && <p className="text-sm text-destructive">{e.lines}</p>}
          <div className="mt-2 flex items-start justify-between gap-4">
            <Button type="button" variant="outline" size="sm" onClick={() => setRows((rs) => [...rs, row({ rate: rs.at(-1)?.rate || clientRate(clientId) })])}>
              + Add line
            </Button>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">{(hours / 1000).toLocaleString()} hours</div>
              <div className="tabular text-xl font-semibold">{formatCents(total)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Field label="Notes (printed on the invoice)" htmlFor="notes">
            <Textarea id="notes" name="notes" defaultValue={initial.notes} rows={3} placeholder="e.g. Work for September 2026. Thank you!" />
          </Field>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : invoiceId ? "Save invoice" : "Create invoice"}
        </Button>
        <Link href={invoiceId ? `/invoices/${invoiceId}` : "/invoices"} className={buttonVariants({ variant: "ghost" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
