import Link from "next/link";
import { ActionButton } from "@/components/action-button";
import { Alert, Card, CardContent, CardDescription, CardHeader, CardTitle, PageHeader } from "@/components/ui/misc";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDb } from "@/db";
import { formatDate } from "@/lib/dates";
import { listImports } from "@/lib/expense-import";
import { categoryOptions } from "@/lib/expenses";
import { formatCents } from "@/lib/money";
import { undoImportAction } from "./actions";
import { ImportWizard } from "./import-wizard";

export default async function ImportExpensesPage({ searchParams }: PageProps<"/expenses/import">) {
  const sp = await searchParams;
  const db = await getDb();
  const categories = (await categoryOptions(db)).map((c) => ({ id: c.id, name: c.name, businessPct: c.businessPct }));
  const imports = await listImports(db);
  const done = imports.find((i) => i.id === Number(sp.done));

  return (
    <>
      <PageHeader
        title="Import expenses"
        description={
          <Link href="/expenses" className="hover:underline">
            ← Expenses
          </Link>
        }
      />
      {done && (
        <Alert variant="success" className="mb-6">
          Imported {done.count} expense{done.count === 1 ? "" : "s"} from {done.fileName || "your file"}.{" "}
          <Link href="/expenses?range=this_year" className="underline">
            See expenses
          </Link>{" "}
          or import another file.
        </Alert>
      )}
      <ImportWizard key={done?.id ?? "new"} categories={categories} />

      {imports.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Past imports</CardTitle>
            <CardDescription>Undo removes every expense from that import, including any you&apos;ve edited since.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Imported</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead className="text-right">Expenses</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {imports.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(i.createdAt.slice(0, 10))}</TableCell>
                    <TableCell className="max-w-56 truncate">{i.fileName || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {i.from && i.to ? `${formatDate(i.from)} – ${formatDate(i.to)}` : "—"}
                    </TableCell>
                    <TableCell className="tabular text-right">
                      {i.count} · {formatCents(i.totalCents)}
                    </TableCell>
                    <TableCell className="text-right">
                      <ActionButton
                        variant="ghost"
                        size="sm"
                        confirm={`Undo this import? This deletes its ${i.count} expense${i.count === 1 ? "" : "s"} (${formatCents(i.totalCents)}).`}
                        action={undoImportAction.bind(null, i.id)}
                      >
                        Undo import
                      </ActionButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  );
}
