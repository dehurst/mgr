import { Badge } from "@/components/ui/misc";
import { FORM_1099_STATUS_LABELS, type Form1099Row } from "@/lib/reports/form-1099";

const VARIANT = { file: "warning", under_threshold: "secondary", exempt: "outline", none: "outline" } as const;

export function Form1099Badge({ row }: { row: Pick<Form1099Row, "status" | "missing"> }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Badge variant={VARIANT[row.status]}>{FORM_1099_STATUS_LABELS[row.status]}</Badge>
      {row.missing.length > 0 && <Badge variant="destructive">Missing {row.missing.join(", ")}</Badge>}
    </span>
  );
}
