import { asc, count, eq } from "drizzle-orm";
import Link from "next/link";
import { getDb } from "@/db";
import { expenseCategories, expenses } from "@/db/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, PageHeader } from "@/components/ui/misc";
import { buttonVariants } from "@/components/ui/button";
import { AddCategoryForm, CategoryRow } from "./category-forms";

export default function CategoriesPage() {
  const db = getDb();
  const rows = db
    .select({
      id: expenseCategories.id,
      name: expenseCategories.name,
      scheduleCLine: expenseCategories.scheduleCLine,
      businessPct: expenseCategories.businessPct,
      archivedAt: expenseCategories.archivedAt,
      expenseCount: count(expenses.id),
    })
    .from(expenseCategories)
    .leftJoin(expenses, eq(expenses.categoryId, expenseCategories.id))
    .groupBy(expenseCategories.id)
    .orderBy(asc(expenseCategories.name))
    .all();
  const active = rows.filter((r) => !r.archivedAt);
  const archived = rows.filter((r) => r.archivedAt);

  return (
    <>
      <PageHeader
        title="Expense categories"
        description="Each category maps to a Schedule C line for the tax summary, and has a default business-use % for new expenses (e.g. 40% for a phone you also use personally). Archive instead of deleting so past expenses keep their category."
        actions={
          <Link href="/settings" className={buttonVariants({ variant: "outline" })}>
            Back to settings
          </Link>
        }
      />
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Add a category</CardTitle>
          </CardHeader>
          <CardContent>
            <AddCategoryForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active ({active.length})</CardTitle>
            <CardDescription>Renaming a category also renames it in past reports.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {active.map((c) => (
              <CategoryRow key={c.id} category={c} />
            ))}
          </CardContent>
        </Card>

        {archived.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Archived ({archived.length})</CardTitle>
              <CardDescription>Hidden from the expense form; still shown in reports.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {archived.map((c) => (
                <CategoryRow key={c.id} category={c} />
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
