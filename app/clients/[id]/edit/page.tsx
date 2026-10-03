import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/misc";
import { getDb } from "@/db";
import { getClient } from "@/lib/clients";
import { ClientForm } from "../../client-form";

export default async function EditClientPage({ params }: PageProps<"/clients/[id]/edit">) {
  const client = getClient(getDb(), Number((await params).id));
  if (!client) notFound();
  return (
    <>
      <PageHeader title={`Edit ${client.name}`} />
      <ClientForm client={client} />
    </>
  );
}
