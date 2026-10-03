import { Card, CardContent, PageHeader } from "@/components/ui/misc";

export function ComingSoon({ title, phase, what }: { title: string; phase: number; what: string }) {
  return (
    <>
      <PageHeader title={title} />
      <Card>
        <CardContent className="text-sm text-muted-foreground">
          Coming in Phase {phase}: {what}
        </CardContent>
      </Card>
    </>
  );
}
