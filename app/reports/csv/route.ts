import { getDb } from "@/db";
import { csvResponse } from "@/lib/csv";
import { today } from "@/lib/dates";
import { resolveRange } from "@/lib/range";
import {
  agingCsv,
  agingReport,
  expensesCsv,
  expensesReportData,
  incomeByClientCsv,
  incomeByClientReport,
  pnlCsv,
  pnlReport,
  taxCsv,
  taxReport,
} from "@/lib/reports";

// GET /reports/csv?report=pnl|expenses|aging|income-by-client|tax&range=…|from=…&to=…|year=…
export async function GET(req: Request) {
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const db = getDb();
  const range = resolveRange(sp, today());
  const tag = `${range.from}_to_${range.to}`;
  switch (sp.report) {
    case "pnl":
      return csvResponse(`profit-and-loss_${tag}.csv`, pnlCsv(pnlReport(db, range, sp.compare === "1")));
    case "expenses":
      return csvResponse(`expenses_${tag}.csv`, expensesCsv(expensesReportData(db, range)));
    case "aging":
      return csvResponse(`ar-aging_${today()}.csv`, agingCsv(agingReport(db, today())));
    case "income-by-client":
      return csvResponse(`income-by-client_${tag}.csv`, incomeByClientCsv(incomeByClientReport(db, range)));
    case "tax": {
      const year = Number(sp.year) || Number(today().slice(0, 4));
      return csvResponse(`schedule-c-summary_${year}.csv`, taxCsv(taxReport(db, year)));
    }
    default:
      return new Response("Unknown report", { status: 400 });
  }
}
