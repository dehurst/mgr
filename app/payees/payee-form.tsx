"use client";

import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { Alert, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/misc";
import { useFormAction } from "@/components/use-form-action";
import { TAX_CLASSIFICATIONS, type Payee } from "@/db/schema";
import { TAX_CLASSIFICATION_LABELS } from "@/lib/payee-labels";
import { savePayee } from "./actions";

export function PayeeForm({ payee }: { payee?: Payee }) {
  const { state, errors: e, onSubmit, pending } = useFormAction(savePayee.bind(null, payee?.id ?? null));
  return (
    <form onSubmit={onSubmit} className="grid gap-6">
      {state.message && !state.ok && <Alert variant="destructive">{state.message}</Alert>}
      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Name (as on their tax return)" htmlFor="name" hint="W-9 line 1." error={e.name}>
            <Input id="name" name="name" defaultValue={payee?.name} required autoFocus={!payee} />
          </Field>
          <Field label="Business name (optional)" htmlFor="businessName" hint="W-9 line 2, if different." error={e.businessName}>
            <Input id="businessName" name="businessName" defaultValue={payee?.businessName} />
          </Field>
          <Field label="Email" htmlFor="email" error={e.email}>
            <Input id="email" name="email" type="email" defaultValue={payee?.email} />
          </Field>
          <Field label="Address" htmlFor="address" hint="Printed on their 1099." className="sm:row-span-2">
            <Textarea id="address" name="address" defaultValue={payee?.address} rows={4} />
          </Field>
          <Field label="Notes (private)" htmlFor="notes">
            <Textarea id="notes" name="notes" defaultValue={payee?.notes} rows={2} />
          </Field>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>From their W-9</CardTitle>
          <CardDescription>
            Ask anyone you&apos;ll pay for work to fill out a Form W-9 before you pay them. Keep the W-9 itself somewhere
            safe; this app stores only the last 4 digits of their tax ID.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="W-9 received on" htmlFor="w9ReceivedOn" error={e.w9ReceivedOn}>
            <Input id="w9ReceivedOn" name="w9ReceivedOn" type="date" defaultValue={payee?.w9ReceivedOn ?? ""} />
          </Field>
          <Field label="Tax classification" htmlFor="taxClassification" hint="W-9 box 3a." error={e.taxClassification} className="sm:col-span-2">
            <Select id="taxClassification" name="taxClassification" defaultValue={payee?.taxClassification ?? ""}>
              <option value="">Not known yet</option>
              {TAX_CLASSIFICATIONS.map((c) => (
                <option key={c} value={c}>
                  {TAX_CLASSIFICATION_LABELS[c]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tax ID type" htmlFor="tinType" error={e.tinType}>
            <Select id="tinType" name="tinType" defaultValue={payee?.tinType ?? ""}>
              <option value="">—</option>
              <option value="ssn">SSN</option>
              <option value="ein">EIN</option>
            </Select>
          </Field>
          <Field label="Last 4 digits" htmlFor="tinLast4" hint="The full number goes into the IRS filing site, not here." error={e.tinLast4}>
            <Input id="tinLast4" name="tinLast4" inputMode="numeric" maxLength={11} autoComplete="off" defaultValue={payee?.tinLast4 ?? ""} placeholder="1234" />
          </Field>
          <Field label="Legal services" htmlFor="isAttorney" hint="Lawyers get a 1099 even if they're a corporation.">
            <label className="flex h-9 items-center gap-2 text-sm">
              <input id="isAttorney" type="checkbox" name="isAttorney" defaultChecked={payee?.isAttorney} /> This is an attorney / law firm
            </label>
          </Field>
        </CardContent>
      </Card>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : payee ? "Save payee" : "Add payee"}
        </Button>
        <Link href={payee ? `/payees/${payee.id}` : "/payees"} className={buttonVariants({ variant: "ghost" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
