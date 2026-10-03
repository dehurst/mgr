"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form-controls";
import { useFormAction } from "@/components/use-form-action";
import { PERSONAL_LINE, SCHEDULE_C_LINES } from "@/lib/schedule-c";
import { createCategory, setCategoryArchived, updateCategory } from "../actions";

function LineOptions() {
  return (
    <>
      {SCHEDULE_C_LINES.map((l) => (
        <option key={l.line} value={l.line}>
          Line {l.line}: {l.label}
        </option>
      ))}
      <option value={PERSONAL_LINE}>Not deductible (personal, excluded from reports)</option>
    </>
  );
}

export function AddCategoryForm() {
  const { state, errors, onSubmit, pending, formRef } = useFormAction(createCategory, { resetOnSuccess: true });
  return (
    <form ref={formRef} onSubmit={onSubmit} className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        <Input name="name" placeholder="Category name" className="w-64" aria-invalid={!!errors.name} required />
        <Select name="scheduleCLine" defaultValue="27a" className="w-96">
          <LineOptions />
        </Select>
        <PctInput defaultValue={100} />
        <Button type="submit" disabled={pending}>
          Add
        </Button>
      </div>
      <Message state={state} />
    </form>
  );
}

type Row = { id: number; name: string; scheduleCLine: string; businessPct: number; archivedAt: string | null; expenseCount: number };

function PctInput({ defaultValue, disabled }: { defaultValue: number; disabled?: boolean }) {
  return (
    <label className="flex items-center gap-1 text-sm" title="Default business-use % for new expenses in this category">
      <Input name="businessPct" defaultValue={defaultValue} inputMode="numeric" className="w-16 text-right" disabled={disabled} aria-label="Business use %" />
      <span className="text-muted-foreground">% business</span>
    </label>
  );
}

export function CategoryRow({ category: c }: { category: Row }) {
  const { state, errors, onSubmit, pending } = useFormAction(updateCategory.bind(null, c.id));
  const [archiving, startArchive] = useTransition();
  return (
    <form onSubmit={onSubmit} className="grid gap-1 border-b pb-2 last:border-0">
      <div className="flex flex-wrap items-center gap-2">
        <Input name="name" defaultValue={c.name} className="w-64" aria-invalid={!!errors.name} required />
        <Select name="scheduleCLine" defaultValue={c.scheduleCLine} className="w-96">
          <LineOptions />
        </Select>
        <PctInput defaultValue={c.businessPct} disabled={c.scheduleCLine === PERSONAL_LINE} />
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          Save
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={archiving}
          onClick={() => startArchive(() => setCategoryArchived(c.id, !c.archivedAt))}
        >
          {c.archivedAt ? "Restore" : "Archive"}
        </Button>
        <span className="text-xs text-muted-foreground">
          {c.expenseCount} expense{c.expenseCount === 1 ? "" : "s"}
        </span>
        {c.expenseCount > 0 && c.scheduleCLine !== PERSONAL_LINE && (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input type="checkbox" name="applyToExisting" /> Apply % to past expenses too
          </label>
        )}
      </div>
      <Message state={state} />
    </form>
  );
}

function Message({ state }: { state: { ok?: boolean; message?: string; errors?: Record<string, string> } }) {
  const err = state.errors && Object.values(state.errors)[0];
  if (err) return <p className="text-xs text-destructive">{err}</p>;
  if (state.ok && state.message) return <p className="text-xs text-success">{state.message}</p>;
  return null;
}
