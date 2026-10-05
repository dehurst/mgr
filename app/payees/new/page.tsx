import { PageHeader } from "@/components/ui/misc";
import { PayeeForm } from "../payee-form";

export default function NewPayeePage() {
  return (
    <>
      <PageHeader title="New payee" />
      <PayeeForm />
    </>
  );
}
