import { PageHeader } from "@/components/ui/misc";
import { ClientForm } from "../client-form";

export default function NewClientPage() {
  return (
    <>
      <PageHeader title="New client" />
      <ClientForm />
    </>
  );
}
