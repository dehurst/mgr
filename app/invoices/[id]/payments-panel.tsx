"use client";

import { ActionButton } from "@/components/action-button";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { Alert, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/misc";
import { useFormAction } from "@/components/use-form-action";
import { PAYMENT_METHODS, type Payment } from "@/db/schema";
import { formatDate } from "@/lib/dates";
import { centsToInput, formatCents } from "@/lib/money";
import { PAYMENT_METHOD_LABELS } from "@/lib/payment-methods";
import { markSentAction, markUnsentAction, recordPaymentAction, voidPaymentAction } from "../actions";

export function SentPanel({
  invoiceId,
  sentOn,
  today,
  canUndo,
}: {
  invoiceId: number;
  sentOn: string | null;
  today: string;
  canUndo: boolean;
}) {
  const { state, errors, onSubmit, pending } = useFormAction(markSentAction.bind(null, invoiceId));
  if (sentOn) {
    return (
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground">Sent</span>
        <span className="flex items-center gap-1">
          {formatDate(sentOn)}
          {canUndo && (
            <ActionButton
              variant="link"
              size="sm"
              confirm="Move this invoice back to Draft? Use this only if you marked it sent by mistake."
              action={markUnsentAction.bind(null, invoiceId)}
            >
              Undo
            </ActionButton>
          )}
        </span>
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit} className="grid gap-2">
      <p className="text-sm text-muted-foreground">
        Sent the PDF to your client yourself? Mark it sent so it counts as owed and shows when it&apos;s overdue.
      </p>
      <div className="flex items-end gap-2">
        <Field label="Date sent" htmlFor="sentOn" error={errors.sentOn}>
          <Input id="sentOn" name="sentOn" type="date" defaultValue={today} max={today} className="w-40" required />
        </Field>
        <Button type="submit" disabled={pending}>
          Mark as sent
        </Button>
      </div>
      {state.message && !errors.sentOn && <p className="text-xs text-destructive">{state.message}</p>}
    </form>
  );
}

export function PaymentsPanel({
  invoiceId,
  payments,
  balanceCents,
  isVoid,
  today,
}: {
  invoiceId: number;
  payments: Payment[];
  balanceCents: number;
  isVoid: boolean;
  today: string;
}) {
  const { state, errors: e, onSubmit, pending, formRef } = useFormAction(recordPaymentAction.bind(null, invoiceId), {
    resetOnSuccess: true,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payments</CardTitle>
        {balanceCents === 0 && payments.some((p) => !p.voidedAt) && <CardDescription>Paid in full.</CardDescription>}
      </CardHeader>
      <CardContent className="grid gap-4">
        {payments.length > 0 && (
          <ul className="grid gap-2 text-sm">
            {payments.map((p) => (
              <li key={p.id} className={`grid gap-0.5 border-b pb-2 last:border-0 ${p.voidedAt ? "text-muted-foreground line-through" : ""}`}>
                <div className="flex justify-between gap-2">
                  <span>{formatDate(p.receivedOn)}</span>
                  <span className="tabular font-medium">{formatCents(p.amountCents)}</span>
                </div>
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {PAYMENT_METHOD_LABELS[p.method]}
                    {p.reference ? ` · ${p.reference}` : ""}
                    {p.voidedAt ? " · voided" : ""}
                  </span>
                  {!p.voidedAt && (
                    <ActionButton
                      variant="link"
                      size="sm"
                      confirm={`Void the ${formatCents(p.amountCents)} payment from ${formatDate(p.receivedOn)}? It stays on record but no longer counts.`}
                      action={voidPaymentAction.bind(null, p.id)}
                    >
                      Void
                    </ActionButton>
                  )}
                </div>
                {p.notes && <div className="text-xs">{p.notes}</div>}
              </li>
            ))}
          </ul>
        )}

        {!isVoid && balanceCents > 0 && (
          <form ref={formRef} onSubmit={onSubmit} className="grid gap-3 border-t pt-4">
            <div className="text-sm font-medium">Record a payment</div>
            {state.message && <Alert variant={state.ok ? "success" : "destructive"}>{state.message}</Alert>}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date received" htmlFor="receivedOn" error={e.receivedOn}>
                <Input id="receivedOn" name="receivedOn" type="date" defaultValue={today} max={today} required />
              </Field>
              <Field label="Amount" htmlFor="amount" error={e.amount}>
                <Input id="amount" name="amount" inputMode="decimal" defaultValue={centsToInput(balanceCents)} key={balanceCents} required />
              </Field>
              <Field label="Method" htmlFor="method" error={e.method}>
                <Select id="method" name="method" defaultValue="check">
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {PAYMENT_METHOD_LABELS[m]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Check # / note" htmlFor="reference">
                <Input id="reference" name="reference" placeholder="optional" />
              </Field>
            </div>
            <Input name="notes" aria-label="Notes" placeholder="Notes (optional)" />
            <div>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Record payment"}
              </Button>
            </div>
          </form>
        )}

        {payments.length === 0 && (isVoid || balanceCents === 0) && <p className="text-sm text-muted-foreground">No payments.</p>}
      </CardContent>
    </Card>
  );
}
