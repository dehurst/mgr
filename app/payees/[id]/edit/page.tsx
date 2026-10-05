import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/misc";
import { getDb } from "@/db";
import { getPayee } from "@/lib/payees";
import { PayeeForm } from "../../payee-form";

export default async function EditPayeePage({ params }: PageProps<"/payees/[id]/edit">) {
  const payee = getPayee(getDb(), Number((await params).id));
  if (!payee) notFound();
  return (
    <>
      <PageHeader title={`Edit ${payee.name}`} />
      <PayeeForm payee={payee} />
    </>
  );
}
