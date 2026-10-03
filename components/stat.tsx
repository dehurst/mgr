import { Card, CardContent } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

export function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: React.ReactNode; tone?: "danger" | "success" }) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={cn("tabular mt-1 text-xl font-semibold", tone === "danger" && "text-destructive", tone === "success" && "text-success")}>
          {value}
        </div>
        {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}
