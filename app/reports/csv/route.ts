import { getDb } from "@/db";
import { csvResponse } from "@/lib/csv";
import { today } from "@/lib/dates";
import { resolveRange } from "@/lib/range";
import {
  agingCsv,
  agingReport,
  expensesCsv,
  expensesReportData,
  form1099Csv,
  form1099Report,
  incomeByClientCsv,
  incomeByClientReport,
  personalCsv,
  personalReport,
  pnlCsv,
  pnlReport,
  taxCsv,
  taxReport,
} from "@/lib/reports";

// GET /reports/csv?report=pnl|expenses|personal|aging|income-by-client|tax|1099&range=…|from=…&to=…|year=…
export async function GET(req: Request) {
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const db = await getDb();
  const range = resolveRange(sp, today());
  const tag = `${range.from}_to_${range.to}`;
  switch (sp.report) {
    case "pnl":
      return csvResponse(`profit-and-loss_${tag}.csv`, pnlCsv(await pnlReport(db, range, sp.compare === "1")));
    case "expenses":
      return csvResponse(`expenses_${tag}.csv`, expensesCsv(await expensesReportData(db, range)));
    case "personal":
      return csvResponse(`personal-spending_${tag}.csv`, personalCsv(await personalReport(db, range)));
    case "aging":
      return csvResponse(`ar-aging_${today()}.csv`, agingCsv(await agingReport(db, today())));
    case "income-by-client":
      return csvResponse(`income-by-client_${tag}.csv`, incomeByClientCsv(await incomeByClientReport(db, range)));
    case "tax": {
      const year = Number(sp.year) || Number(today().slice(0, 4));
      return csvResponse(`schedule-c-summary_${year}.csv`, taxCsv(await taxReport(db, year)));
    }
    case "1099": {
      const year = Number(sp.year) || Number(today().slice(0, 4));
      return csvResponse(`1099-nec-summary_${year}.csv`, form1099Csv(await form1099Report(db, year)));
    }
    default:
      return new Response("Unknown report", { status: 400 });
  }
}
