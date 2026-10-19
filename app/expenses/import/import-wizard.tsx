"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { Alert, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/misc";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EXPENSE_PAYMENT_METHODS } from "@/db/schema";
import { formatDate } from "@/lib/dates";
import { MAX_IMPORT_ROWS, parseStatement, type ChargeSign, type StatementParse, type Suggestion } from "@/lib/import";
import { formatCents } from "@/lib/money";
import { EXPENSE_METHOD_LABELS } from "@/lib/payment-methods";
import { analyzeImport, commitImport } from "./actions";

type Category = { id: number; name: string; businessPct: number };
type Row = Suggestion & { key: number };
type Filter = "all" | "needs" | "unchecked";

export function ImportWizard({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [fileName, setFileName] = useState("");
  const [text, setText] = useState("");
  const [parse, setParse] = useState<StatementParse | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<string>("business_card");
  const [filter, setFilter] = useState<Filter>("all");
  const [bulkCategory, setBulkCategory] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const load = (content: string, sign?: ChargeSign) => {
    setError(null);
    const p = parseStatement(content, sign);
    setParse(p);
    if (!p.lines.length) {
      setRows([]);
      return;
    }
    if (p.lines.length > MAX_IMPORT_ROWS) {
      setError(`This file has ${p.lines.length} transactions; up to ${MAX_IMPORT_ROWS} at a time. Download a shorter date range.`);
      setRows([]);
      return;
    }
    start(async () => {
      try {
        const s = await analyzeImport(p.lines);
        setRows(s.map((x, i) => ({ ...x, key: i })));
      } catch {
        setError("Couldn't check this file against your expenses. Try again.");
      }
    });
  };

  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const checked = rows.filter((r) => r.include);
  const needsCategory = checked.filter((r) => r.categoryId === null);
  const visible = rows.filter((r) => (filter === "needs" ? r.include && r.categoryId === null : filter === "unchecked" ? !r.include : true));
  const totalCents = checked.reduce((s, r) => s + r.amountCents, 0);

  const save = () =>
    start(async () => {
      setError(null);
      const r = await commitImport(
        fileName,
        paymentMethod,
        checked.map((x) => ({
          date: x.date,
          vendor: x.vendor,
          description: x.description,
          amountCents: x.amountCents,
          categoryId: x.categoryId!,
          businessPct: x.businessPct,
        })),
      );
      if (!r.ok) setError(r.error);
      else router.push(`/expenses/import?done=${r.importId}`);
    });

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>1. Choose a statement</CardTitle>
          <CardDescription>
            A CSV downloaded from your bank or card website (look for &ldquo;Download&rdquo; or &ldquo;Export&rdquo;, then CSV). Nothing is
            saved until you click Import.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Statement file (.csv)" htmlFor="file" className="sm:col-span-2">
            <Input
              id="file"
              type="file"
              accept=".csv,text/csv"
              onChange={async (ev) => {
                const f = ev.currentTarget.files?.[0];
                if (!f) return;
                const content = await f.text();
                setFileName(f.name);
                setText(content);
                setFilter("all");
                load(content);
              }}
            />
          </Field>
          <Field label="Paid with" htmlFor="paymentMethod" hint="Applies to every row in this file.">
            <Select id="paymentMethod" value={paymentMethod} onChange={(ev) => setPaymentMethod(ev.target.value)}>
              {EXPENSE_PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {EXPENSE_METHOD_LABELS[m]}
                </option>
              ))}
            </Select>
          </Field>
          {parse?.chargeSign && (
            <Field
              label="Purchases in this file are shown as"
              htmlFor="sign"
              hint="Detected automatically. If purchases show up as money in, switch this."
              className="sm:col-span-2"
            >
              <Select id="sign" value={parse.chargeSign} onChange={(ev) => load(text, ev.target.value as ChargeSign)}>
                <option value="positive">Positive numbers (e.g. 59.99)</option>
                <option value="negative">Negative numbers (e.g. -59.99)</option>
              </Select>
            </Field>
          )}
          {parse && parse.errors.length > 0 && (
            <Alert variant="destructive" className="sm:col-span-3">
              {parse.lines.length ? `${parse.errors.length} line(s) couldn't be read and were left out: ` : ""}
              {parse.errors
                .slice(0, 5)
                .map((e) => `line ${e.line}: ${e.message}`)
                .join("; ")}
              {parse.errors.length > 5 ? "…" : ""}
            </Alert>
          )}
        </CardContent>
      </Card>

      {error && <Alert variant="destructive">{error}</Alert>}
      {pending && !rows.length && <p className="text-sm text-muted-foreground">Reading the statement…</p>}

      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>2. Review</CardTitle>
            <CardDescription>
              Check the rows to import and give each a category. Categories come from what you entered for the same vendor before.
              Card payments, transfers, money coming in, and likely duplicates start unchecked.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex flex-wrap items-end gap-3 text-sm">
              <div className="flex rounded-md border p-0.5" role="group" aria-label="Show">
                {(
                  [
                    ["all", `All ${rows.length}`],
                    ["needs", `Needs category ${needsCategory.length}`],
                    ["unchecked", `Unchecked ${rows.length - checked.length}`],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={filter === value}
                    onClick={() => setFilter(value)}
                    className={`rounded px-2 py-1 ${filter === value ? "bg-muted font-medium" : "text-muted-foreground"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex items-end gap-2">
                <Select aria-label="Category for checked rows without one" value={bulkCategory} onChange={(ev) => setBulkCategory(ev.target.value)} className="w-60">
                  <option value="">Set uncategorized to…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!bulkCategory || !needsCategory.length}
                  onClick={() => {
                    const c = catById.get(Number(bulkCategory));
                    if (!c) return;
                    setRows((rs) => rs.map((r) => (r.include && r.categoryId === null ? { ...r, categoryId: c.id, businessPct: c.businessPct } : r)));
                  }}
                >
                  Apply
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">
                      <input
                        type="checkbox"
                        aria-label="Check all shown"
                        checked={visible.length > 0 && visible.every((r) => r.include)}
                        onChange={(ev) => {
                          const on = ev.target.checked;
                          const keys = new Set(visible.map((r) => r.key));
                          setRows((rs) => rs.map((r) => (keys.has(r.key) ? { ...r, include: on } : r)));
                        }}
                      />
                    </TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="w-20">Biz %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((r) => (
                    <TableRow key={r.key} className={r.include ? undefined : "text-muted-foreground"}>
                      <TableCell className="align-top">
                        <input type="checkbox" aria-label={`Import ${r.vendor}`} checked={r.include} onChange={(ev) => update(r.key, { include: ev.target.checked })} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap align-top">{formatDate(r.date)}</TableCell>
                      <TableCell className="min-w-56 align-top">
                        <Input aria-label="Vendor" value={r.vendor} onChange={(ev) => update(r.key, { vendor: ev.target.value })} className="h-8" />
                        <div className="mt-1 max-w-80 truncate text-xs text-muted-foreground" title={r.description}>
                          {r.description}
                        </div>
                        {r.note && <div className="text-xs text-muted-foreground italic">{r.note}</div>}
                      </TableCell>
                      <TableCell className="tabular whitespace-nowrap text-right align-top">
                        {formatCents(r.amountCents)}
                        {r.amountCents < 0 && <div className="text-xs">refund / money in</div>}
                      </TableCell>
                      <TableCell className="min-w-48 align-top">
                        <Select
                          aria-label="Category"
                          value={r.categoryId ?? ""}
                          onChange={(ev) => {
                            const c = catById.get(Number(ev.target.value));
                            update(r.key, { categoryId: c?.id ?? null, businessPct: c?.businessPct ?? r.businessPct });
                          }}
                          className={`h-8 ${r.include && r.categoryId === null ? "border-destructive" : ""}`}
                        >
                          <option value="">Choose…</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </Select>
                      </TableCell>
                      <TableCell className="align-top">
                        <Input
                          aria-label="Business %"
                          inputMode="numeric"
                          value={r.businessPct}
                          onChange={(ev) => {
                            const n = Number(ev.target.value.replace(/\D/g, ""));
                            update(r.key, { businessPct: Math.min(100, Math.max(1, n || 1)) });
                          }}
                          className="h-8 w-16"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t pt-4">
              <Button type="button" onClick={save} disabled={pending || !checked.length || needsCategory.length > 0}>
                {pending ? "Importing…" : `Import ${checked.length} expense${checked.length === 1 ? "" : "s"} (${formatCents(totalCents)})`}
              </Button>
              {needsCategory.length > 0 && (
                <button type="button" className="text-sm text-destructive underline" onClick={() => setFilter("needs")}>
                  {needsCategory.length} checked row{needsCategory.length === 1 ? " needs" : "s need"} a category
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
