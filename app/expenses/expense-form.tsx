"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { Alert, Card, CardContent } from "@/components/ui/misc";
import { useFormAction } from "@/components/use-form-action";
import { EXPENSE_PAYMENT_METHODS, type Expense } from "@/db/schema";
import { centsToInput } from "@/lib/money";
import { EXPENSE_METHOD_LABELS } from "@/lib/payment-methods";
import { PERSONAL_LINE } from "@/lib/schedule-c";
import { saveExpense } from "./actions";

type Option = { id: number; name: string };

export function ExpenseForm({
  expense,
  categories,
  clients,
  payees,
  vendors,
  defaults,
}: {
  expense?: Expense;
  categories: (Option & { archivedAt: string | null; businessPct: number; scheduleCLine: string })[];
  clients: Option[];
  payees: Option[];
  vendors: string[];
  /** payeeId/categoryId pre-fill "record a payment" from a payee's page, which is returned to after saving. */
  defaults: { paidOn: string; paymentMethod: string; payeeId?: number; categoryId?: number };
}) {
  const { state, errors: e, onSubmit, pending } = useFormAction(saveExpense.bind(null, expense?.id ?? null));
  const initialCategory = categories.find((c) => c.id === (expense?.categoryId ?? defaults.categoryId));
  const [categoryId, setCategoryId] = useState(String(initialCategory?.id ?? ""));
  const [businessPct, setBusinessPct] = useState(String(expense?.businessPct ?? initialCategory?.businessPct ?? 100));
  const [payeeId, setPayeeId] = useState(String(expense?.payeeId ?? defaults.payeeId ?? ""));
  const [vendor, setVendor] = useState(expense?.vendor ?? payees.find((p) => String(p.id) === payeeId)?.name ?? "");
  // Picking a payee fills in the vendor when it's blank.
  const changePayee = (id: string) => {
    setPayeeId(id);
    const p = payees.find((x) => String(x.id) === id);
    if (p && !vendor.trim()) setVendor(p.name);
  };
  const category = categories.find((c) => String(c.id) === categoryId);
  const isPersonalCategory = category?.scheduleCLine === PERSONAL_LINE;
  // Picking a category pre-fills its default business-use %; it can still be changed per expense.
  const changeCategory = (id: string) => {
    setCategoryId(id);
    const c = categories.find((x) => String(x.id) === id);
    if (c) setBusinessPct(String(c.businessPct));
  };

  return (
    <form onSubmit={onSubmit} className="grid gap-6">
      {defaults.payeeId && !expense && <input type="hidden" name="returnTo" value="payee" />}
      {state.message && !state.ok && <Alert variant="destructive">{state.message}</Alert>}
      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Date paid" htmlFor="paidOn" error={e.paidOn}>
            <Input id="paidOn" name="paidOn" type="date" defaultValue={expense?.paidOn ?? defaults.paidOn} required />
          </Field>
          <Field label="Vendor / payee" htmlFor="vendor" error={e.vendor} className="sm:col-span-2">
            <Input
              id="vendor"
              name="vendor"
              list="vendor-list"
              value={vendor}
              onChange={(ev) => setVendor(ev.target.value)}
              placeholder="e.g. Adobe"
              required
              autoFocus={!expense && !defaults.payeeId}
            />
            <datalist id="vendor-list">
              {vendors.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
          </Field>
          <Field label="Amount" htmlFor="amount" error={e.amount}>
            <Input
              id="amount"
              name="amount"
              inputMode="decimal"
              placeholder="0.00"
              defaultValue={expense ? centsToInput(expense.amountCents) : ""}
              required
            />
          </Field>
          <Field label="Category" htmlFor="categoryId" error={e.categoryId}>
            <Select id="categoryId" name="categoryId" value={categoryId} onChange={(ev) => changeCategory(ev.target.value)} required>
              <option value="">Choose…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.archivedAt ? " (archived)" : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Business use %"
            htmlFor="businessPct"
            error={e.businessPct}
            hint={isPersonalCategory ? "Personal category: not counted as a business expense." : "The rest counts as personal spending."}
          >
            <Input
              id="businessPct"
              name="businessPct"
              inputMode="numeric"
              value={isPersonalCategory ? "0" : businessPct}
              onChange={(ev) => setBusinessPct(ev.target.value)}
              disabled={isPersonalCategory}
            />
          </Field>
          <Field label="Paid with" htmlFor="paymentMethod" error={e.paymentMethod}>
            <Select id="paymentMethod" name="paymentMethod" defaultValue={expense?.paymentMethod ?? defaults.paymentMethod}>
              {EXPENSE_PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {EXPENSE_METHOD_LABELS[m]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Description" htmlFor="description" className="sm:col-span-2">
            <Textarea id="description" name="description" defaultValue={expense?.description} rows={2} placeholder="optional" />
          </Field>
          <Field label="For client (optional)" htmlFor="clientId" hint="For job costing." error={e.clientId}>
            <Select id="clientId" name="clientId" defaultValue={expense?.clientId ?? ""}>
              <option value="">None</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Payee (1099 contractor)"
            htmlFor="payeeId"
            hint={payeeId ? "Counts toward their 1099-NEC unless paid by card or Venmo/PayPal goods & services." : "Only for people you pay for work."}
            error={e.payeeId}
          >
            <Select id="payeeId" name="payeeId" value={payeeId} onChange={(ev) => changePayee(ev.target.value)}>
              <option value="">None</option>
              {payees.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Receipt (optional)" htmlFor="receipt" hint="Photo or PDF, up to 10 MB." error={e.receipt} className="sm:col-span-2">
            <Input id="receipt" name="receipt" type="file" accept="image/png,image/jpeg,image/heic,image/webp,application/pdf" />
            {expense?.receiptPath && (
              <div className="mt-1 flex items-center gap-4 text-sm">
                <a href={`/files/${expense.receiptPath}`} target="_blank" rel="noreferrer" className="underline">
                  View current receipt
                </a>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="removeReceipt" /> Remove it
                </label>
              </div>
            )}
          </Field>
        </CardContent>
      </Card>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="then" value="list" disabled={pending}>
          {pending ? "Saving…" : expense ? "Save expense" : "Save"}
        </Button>
        {!expense && (
          <Button type="submit" name="then" value="another" variant="outline" disabled={pending}>
            Save and add another
          </Button>
        )}
        <Link href={defaults.payeeId && !expense ? `/payees/${defaults.payeeId}` : "/expenses"} className={buttonVariants({ variant: "ghost" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
