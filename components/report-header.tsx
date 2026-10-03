"use client";

import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";

/** Title + period, with Print (browser "Save as PDF") and CSV download. Business name shows on print only. */
export function ReportHeader({
  title,
  period,
  businessName,
  csvHref,
}: {
  title: string;
  period: string;
  businessName: string;
  csvHref: string;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="no-print mb-1 text-sm">
          <Link href="/reports" className="text-muted-foreground hover:underline">
            ← Reports
          </Link>
        </div>
        {businessName && <div className="hidden text-sm font-medium print:block">{businessName}</div>}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{period}</p>
      </div>
      <div className="no-print flex gap-2">
        <Button variant="outline" onClick={() => window.print()}>
          Print / Save PDF
        </Button>
        <a href={csvHref} className={buttonVariants({ variant: "outline" })}>
          Download CSV
        </a>
      </div>
    </div>
  );
}
