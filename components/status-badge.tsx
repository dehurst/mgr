import { Badge } from "@/components/ui/misc";
import { STATUS_LABELS, type InvoiceStatus } from "@/lib/invoice-status";

const VARIANT = {
  draft: "outline",
  sent: "secondary",
  partially_paid: "warning",
  paid: "success",
  overdue: "destructive",
  void: "outline",
} as const;

export function StatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <Badge variant={VARIANT[status]} className={status === "void" ? "line-through text-muted-foreground" : undefined}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}
