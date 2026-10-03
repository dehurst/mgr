import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/dates";
import type { InvoiceSummary } from "@/lib/invoices";
import { formatCents, sumCents } from "@/lib/money";

export function InvoiceTable({ rows, showClient = true }: { rows: InvoiceSummary[]; showClient?: boolean }) {
  const counted = rows.filter((r) => r.status !== "void");
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Number</TableHead>
          {showClient && <TableHead>Client</TableHead>}
          <TableHead>Issued</TableHead>
          <TableHead>Due</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="text-right">Balance</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id} className={r.status === "void" ? "text-muted-foreground" : undefined}>
            <TableCell>
              <Link href={`/invoices/${r.id}`} className="font-medium hover:underline">
                {r.number}
              </Link>
            </TableCell>
            {showClient && <TableCell>{r.clientName}</TableCell>}
            <TableCell>{formatDate(r.issuedOn)}</TableCell>
            <TableCell>{formatDate(r.dueOn)}</TableCell>
            <TableCell>
              <StatusBadge status={r.status} />
            </TableCell>
            <TableCell className="tabular text-right">{formatCents(r.totalCents)}</TableCell>
            <TableCell className="tabular text-right">{r.status === "draft" || r.status === "void" ? "—" : formatCents(r.balanceCents)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      {rows.length > 1 && (
        <TableFooter>
          <TableRow>
            <TableCell colSpan={showClient ? 5 : 4}>Total (excluding void)</TableCell>
            <TableCell className="tabular text-right">{formatCents(sumCents(counted.map((r) => r.totalCents)))}</TableCell>
            <TableCell className="tabular text-right">{formatCents(sumCents(counted.map((r) => r.balanceCents)))}</TableCell>
          </TableRow>
        </TableFooter>
      )}
    </Table>
  );
}
