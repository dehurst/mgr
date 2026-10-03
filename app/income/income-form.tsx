"use client";

import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { Alert } from "@/components/ui/misc";
import { useFormAction } from "@/components/use-form-action";
import type { OtherIncome } from "@/db/schema";
import { centsToInput } from "@/lib/money";
import { saveOtherIncome } from "./actions";

export function IncomeForm({
  entry,
  clients,
  today,
}: {
  entry?: OtherIncome;
  clients: { id: number; name: string }[];
  today: string;
}) {
  const { state, errors: e, onSubmit, pending, formRef } = useFormAction(saveOtherIncome.bind(null, entry?.id ?? null), {
    resetOnSuccess: !entry,
  });
  return (
    <form ref={formRef} onSubmit={onSubmit} className="grid gap-4">
      {state.message && <Alert variant={state.ok ? "success" : "destructive"}>{state.message}</Alert>}
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Date received" htmlFor="receivedOn" error={e.receivedOn}>
          <Input id="receivedOn" name="receivedOn" type="date" defaultValue={entry?.receivedOn ?? today} max={today} required />
        </Field>
        <Field label="Source" htmlFor="source" error={e.source} className="sm:col-span-2">
          <Input id="source" name="source" defaultValue={entry?.source} placeholder="e.g. QuickBooks payments, Jan–Sep 2026" required />
        </Field>
        <Field label="Amount" htmlFor="amount" error={e.amount}>
          <Input id="amount" name="amount" inputMode="decimal" defaultValue={entry ? centsToInput(entry.amountCents) : ""} placeholder="0.00" required />
        </Field>
        <Field label="Client (optional)" htmlFor="clientId" hint="Counts toward income by client." error={e.clientId}>
          <Select id="clientId" name="clientId" defaultValue={entry?.clientId ?? ""}>
            <option value="">None</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Notes" htmlFor="notes" className="sm:col-span-3">
          <Input id="notes" name="notes" defaultValue={entry?.notes} placeholder="optional" />
        </Field>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : entry ? "Save" : "Add income"}
        </Button>
        {entry && (
          <Link href="/income" className={buttonVariants({ variant: "ghost" })}>
            Cancel
          </Link>
        )}
      </div>
    </form>
  );
}
