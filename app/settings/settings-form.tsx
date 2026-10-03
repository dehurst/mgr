"use client";

import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form-controls";
import { Alert, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/misc";
import type { BusinessSettings } from "@/db/schema";
import { useFormAction } from "@/components/use-form-action";
import { updateSettings } from "./actions";

const PLACEHOLDERS =
  "{{business_name}} {{client_name}} {{client_contact}} {{invoice_number}} {{amount_due}} {{due_date}} {{payment_instructions}}";

export function SettingsForm({ settings: s, smtpConfigured }: { settings: BusinessSettings; smtpConfigured: boolean }) {
  const { state, errors: e, onSubmit, pending } = useFormAction(updateSettings);

  return (
    <form onSubmit={onSubmit} className="grid gap-6">
      {state.message && <Alert variant={state.ok ? "success" : "destructive"}>{state.message}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle>Business</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Business name" htmlFor="businessName" error={e.businessName}>
            <Input id="businessName" name="businessName" defaultValue={s.businessName} required />
          </Field>
          <Field label="Email" htmlFor="email" error={e.email}>
            <Input id="email" name="email" type="email" defaultValue={s.email} />
          </Field>
          <Field label="Phone" htmlFor="phone">
            <Input id="phone" name="phone" defaultValue={s.phone} />
          </Field>
          <Field label="Address" htmlFor="address" className="sm:row-span-2">
            <Textarea id="address" name="address" defaultValue={s.address} rows={4} />
          </Field>
          <Field label="Logo (optional)" htmlFor="logo" hint="PNG or JPEG, shown on invoice PDFs." error={e.logo}>
            <Input id="logo" name="logo" type="file" accept="image/png,image/jpeg" />
            {s.logoPath && (
              <div className="mt-2 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/files/${s.logoPath}`} alt="Current logo" className="h-12 w-auto rounded border" />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="removeLogo" /> Remove logo
                </label>
              </div>
            )}
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
          <CardDescription>
            Numbers are assigned when an invoice is created. If you&apos;re moving from QuickBooks, set the next number
            to continue your existing sequence.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Number prefix" htmlFor="invoicePrefix" error={e.invoicePrefix}>
            <Input id="invoicePrefix" name="invoicePrefix" defaultValue={s.invoicePrefix} />
          </Field>
          <Field label="Next number" htmlFor="nextInvoiceNumber" error={e.nextInvoiceNumber}>
            <Input
              id="nextInvoiceNumber"
              name="nextInvoiceNumber"
              inputMode="numeric"
              defaultValue={s.nextInvoiceNumber}
            />
          </Field>
          <Field label="Default terms (days)" htmlFor="defaultTermsDays" hint="15 = Net 15" error={e.defaultTermsDays}>
            <Input id="defaultTermsDays" name="defaultTermsDays" inputMode="numeric" defaultValue={s.defaultTermsDays} />
          </Field>
          <Field
            label="Payment instructions"
            htmlFor="paymentInstructions"
            hint="Printed on every invoice."
            className="sm:col-span-3"
          >
            <Textarea
              id="paymentInstructions"
              name="paymentInstructions"
              defaultValue={s.paymentInstructions}
              placeholder="Venmo @your-handle, or check payable to Your Name, mailed to …"
              rows={3}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email templates</CardTitle>
          <CardDescription>
            Placeholders: <code className="text-xs">{PLACEHOLDERS}</code>
            <br />
            SMTP is {smtpConfigured ? "configured" : <strong>not configured</strong>} (set SMTP_* in .env.local).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-4">
            <Field label="Invoice email subject" htmlFor="invoiceEmailSubject">
              <Input id="invoiceEmailSubject" name="invoiceEmailSubject" defaultValue={s.invoiceEmailSubject} />
            </Field>
            <Field label="Invoice email body" htmlFor="invoiceEmailBody">
              <Textarea id="invoiceEmailBody" name="invoiceEmailBody" defaultValue={s.invoiceEmailBody} rows={9} />
            </Field>
          </div>
          <div className="grid gap-4">
            <Field label="Reminder email subject" htmlFor="reminderEmailSubject">
              <Input id="reminderEmailSubject" name="reminderEmailSubject" defaultValue={s.reminderEmailSubject} />
            </Field>
            <Field label="Reminder email body" htmlFor="reminderEmailBody">
              <Textarea id="reminderEmailBody" name="reminderEmailBody" defaultValue={s.reminderEmailBody} rows={9} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </form>
  );
}
