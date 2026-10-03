"use client";

import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { Alert, Card, CardContent } from "@/components/ui/misc";
import { useFormAction } from "@/components/use-form-action";
import { EXPENSE_PAYMENT_METHODS, type Expense } from "@/db/schema";
import { centsToInput } from "@/lib/money";
import { EXPENSE_METHOD_LABELS } from "@/lib/payment-methods";
import { saveExpense } from "./actions";

type Option = { id: number; name: string };

export function ExpenseForm({
  expense,
  categories,
  clients,
  vendors,
  defaults,
}: {
  expense?: Expense;
  categories: (Option & { archivedAt: string | null })[];
  clients: Option[];
  vendors: string[];
  defaults: { paidOn: string; paymentMethod: string };
}) {
  const { state, errors: e, onSubmit, pending } = useFormAction(saveExpense.bind(null, expense?.id ?? null));

  return (
    <form onSubmit={onSubmit} className="grid gap-6">
      {state.message && !state.ok && <Alert variant="destructive">{state.message}</Alert>}
      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Date paid" htmlFor="paidOn" error={e.paidOn}>
            <Input id="paidOn" name="paidOn" type="date" defaultValue={expense?.paidOn ?? defaults.paidOn} required />
          </Field>
          <Field label="Vendor / payee" htmlFor="vendor" error={e.vendor} className="sm:col-span-2">
            <Input id="vendor" name="vendor" list="vendor-list" defaultValue={expense?.vendor} placeholder="e.g. Adobe" required autoFocus={!expense} />
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
            <Select id="categoryId" name="categoryId" defaultValue={expense?.categoryId ?? ""} required>
              <option value="">Choose…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.archivedAt ? " (archived)" : ""}
                </option>
              ))}
            </Select>
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
          <Field label="Receipt (optional)" htmlFor="receipt" hint="Photo or PDF, up to 10 MB." error={e.receipt} className="sm:col-span-3">
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
        <Link href="/expenses" className={buttonVariants({ variant: "ghost" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
