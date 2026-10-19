import Link from "next/link";
import { Table, TableBody, TableCell, TableFooter, TableRow } from "@/components/ui/table";
import { formatCents } from "@/lib/money";

/** Label · count · share of total · amount, with a total row. Labels link to a drill-down. */
export function TotalsTable({
  rows,
  totalCents,
}: {
  rows: { key: string; label: string; count: number; cents: number; href: string }[];
  totalCents: number;
}) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Nothing yet.</p>;
  return (
    <Table>
      <TableBody>
        {rows.map((x) => (
          <TableRow key={x.key}>
            <TableCell>
              <Link href={x.href} className="hover:underline">
                {x.label}
              </Link>
              <span className="ml-2 text-xs text-muted-foreground">×{x.count}</span>
            </TableCell>
            <TableCell className="tabular w-20 text-right text-xs text-muted-foreground">
              {totalCents ? `${Math.round((x.cents / totalCents) * 100)}%` : ""}
            </TableCell>
            <TableCell className="tabular text-right">{formatCents(x.cents)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={2}>Total</TableCell>
          <TableCell className="tabular text-right">{formatCents(totalCents)}</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}
