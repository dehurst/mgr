"use client";

import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form-controls";
import { Alert, Card, CardContent } from "@/components/ui/misc";
import { useFormAction } from "@/components/use-form-action";
import type { Client } from "@/db/schema";
import { centsToInput } from "@/lib/money";
import { saveClient } from "./actions";

export function ClientForm({ client }: { client?: Client }) {
  const { state, errors: e, onSubmit, pending } = useFormAction(saveClient.bind(null, client?.id ?? null));
  return (
    <form onSubmit={onSubmit} className="grid gap-6">
      {state.message && !state.ok && <Alert variant="destructive">{state.message}</Alert>}
      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Client / company name" htmlFor="name" error={e.name}>
            <Input id="name" name="name" defaultValue={client?.name} required autoFocus={!client} />
          </Field>
          <Field label="Contact name" htmlFor="contactName">
            <Input id="contactName" name="contactName" defaultValue={client?.contactName} />
          </Field>
          <Field label="Email" htmlFor="email" hint="Invoices are emailed here." error={e.email}>
            <Input id="email" name="email" type="email" defaultValue={client?.email} />
          </Field>
          <Field label="Default hourly rate" htmlFor="defaultRateCents" hint="Pre-fills new invoice lines." error={e.defaultRateCents}>
            <Input
              id="defaultRateCents"
              name="defaultRateCents"
              inputMode="decimal"
              placeholder="e.g. 95"
              defaultValue={client?.defaultRateCents != null ? centsToInput(client.defaultRateCents) : ""}
            />
          </Field>
          <Field label="Billing address" htmlFor="billingAddress">
            <Textarea id="billingAddress" name="billingAddress" defaultValue={client?.billingAddress} rows={4} />
          </Field>
          <Field label="Notes (private)" htmlFor="notes">
            <Textarea id="notes" name="notes" defaultValue={client?.notes} rows={4} />
          </Field>
        </CardContent>
      </Card>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : client ? "Save client" : "Add client"}
        </Button>
        <Link href={client ? `/clients/${client.id}` : "/clients"} className={buttonVariants({ variant: "ghost" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
