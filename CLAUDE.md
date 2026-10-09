@AGENTS.md

# Ledger — personal bookkeeping app

Local-only, single-user bookkeeping for a one-person business. Replaces QuickBooks Online for:
expenses, invoices, client payments (Venmo/check, recorded by hand), and tax-time reports.

> Status: **Phase 6 mostly done** (everything except backup). Commands marked *(Phase N)* don't
> exist yet.

**Cutover decision:** the app is the system of record for all of 2026. Expenses from Jan 1, 2026 are
backfilled by hand. Invoice numbering continues QBO's sequence (set "Next number" in Settings).
Line items are always hourly (quantity = hours). No one else bills under this business.

## Non-negotiable conventions

1. **Money is integer cents.** Every money column is an `integer` named `*_cents`. No floats, no
   `real` columns, no `parseFloat` on money. Parse user input ("1,234.5") with `lib/money.ts`
   `parseCents()`, display with `formatCents()`. All arithmetic stays in integers.
2. **Quantities are integer thousandths** (`quantity_milli`, so 1.5 hrs = 1500). Line amount =
   `roundHalfUp(quantity_milli * unit_price_cents / 1000)`, computed in one place
   (`lib/money.ts` `lineAmountCents()`). Invoice total = sum of rounded line amounts.
3. **Dates are `YYYY-MM-DD` strings** (SQLite `text`), compared lexically. Never round-trip
   a calendar date through `new Date()`; that's how Dec 31 becomes Jan 1. "Today" comes from
   `lib/dates.ts` `today()` (local time zone), and is injectable in tests.
   Timestamps (`created_at`, `sent_at`) are ISO-8601 UTC strings.
4. **Cash basis, single entry.** Income is recognized on the payment's `received_on` date (plus
   `other_income.received_on`); expenses on `paid_on`. Invoice issue dates never affect the P&L.
   No chart of accounts beyond expense categories, and no double entry.
5. **Invoice status is derived, not stored**, by `lib/invoice-status.ts` `deriveStatus()`:
   - `void`: `voided_at` is set (the only manual status)
   - `draft`: `sent_at` is null
   - `paid`: balance ≤ 0
   - `partially_paid`: some payments, balance > 0
   - `overdue`: balance > 0 and `due_on < today` (shown alongside partial if both apply)
   - `sent`: otherwise
   "Mark as sent" (without emailing) sets `sent_at` too, for invoices delivered outside the app.
6. **Void is the default; permanent delete is the owner's explicit choice.** Invoices can be voided
   (kept, excluded from totals) or permanently deleted (`deleteInvoice`, removes its lines and
   payments). Drafts delete after a confirm; sent invoices require typing the invoice number.
   Payments are voided, never deleted on their own. Voided rows are excluded from every report.
7. **Personal spending is not a business expense.** Categories whose `schedule_c_line` is
   `personal` (`PERSONAL_LINE`; the "Personal (not business)" category is added by migration 0002)
   are recorded but excluded from P&L, the expense report total, the tax summary, and the
   dashboard; screens and CSVs show them as a separate line. Use `isPersonal()` in report code.
   **Mixed-use expenses** carry `business_pct` (1–100, default from the category's
   `business_pct`). `splitExpense()` in `lib/reports/data.ts` is the only place an expense is split:
   business share = `businessShareCents()` (rounded half up), personal share = the remainder, so
   parts always add back to the amount paid. Reports count the business share; the personal share
   joins personal spending. Meals' 50% limit applies to the business share.
8. **Categories are archived, not deleted.** Expenses keep their `category_id`; renaming a
   category renames it in historical reports, which is intended. The Schedule C mapping lives on
   the category.
9. **One source of truth per number.** Report math lives in pure functions under `lib/reports/`
   that take plain rows and return plain objects. Pages, CSV export, and PDF all call the same
   function. Reconciliation is tested: P&L expense total == expense report total == the tax
   summary's recorded total. The tax summary's line 24b (and so line 28 and net) uses the
   deductible 50% of meals (`halfCents`, rounded half up); P&L and expense reports show cash spent.
10. **Payments you send are expenses.** A payment to a contractor is an expense with `payee_id`
   set; there is no separate outgoing-payments table. The 1099-NEC math lives in
   `lib/reports/form-1099.ts`: box 1 = business share of that payee's expenses in the calendar year,
   excluding card and Venmo/PayPal goods-&-services payments (reported on the network's 1099-K).
   Threshold: $600 through 2025, $2,000 from 2026 (inflation-indexed from 2027: update
   `threshold1099`). Corporations are exempt unless `is_attorney`. Only the last 4 digits of a
   payee's TIN are stored; the full number goes into IRS IRIS from the W-9. The app prints Copy B
   (recipient) only, never Copy A.
11. **Overpayment is rejected.** A payment can't exceed the invoice's open balance. An invoice
   with active payments can't be voided until those payments are voided.

## Stack

- Next.js (App Router) + TypeScript, Node runtime only. Mutations use server actions.
- SQLite via `better-sqlite3` + Drizzle ORM. Migrations are generated by `drizzle-kit` into
  `drizzle/` and applied automatically at startup. WAL mode on.
- Tailwind + shadcn/ui (copied components, only the ones we use).
- Invoice PDFs: `@react-pdf/renderer`, server-side.
- Report PDFs: print stylesheet + the browser's "Save as PDF". No server-side PDF for reports.
- No email sending (owner's decision). Invoices are downloaded as PDF and sent by hand.
- Backup zip: `fflate` (zero-dependency). DB snapshot via `better-sqlite3`'s `db.backup()`, so
  a live WAL database is never copied mid-write.
- Tests: Vitest. Money math, status derivation, and reports are pure and unit-tested; DB tests
  use an in-memory SQLite with migrations applied.

## Layout

```
app/                 routes (dashboard, expenses, payees, invoices, clients, reports, settings)
components/          UI; components/ui = shadcn
lib/money.ts         cents parsing/formatting/rounding
lib/dates.ts         date strings, ranges (this month, last quarter, YTD, ...)
lib/invoice-status.ts deriveStatus, balance, totals (pure)
lib/invoices.ts      invoice rules + queries; functions take `db` so tests use in-memory SQLite
lib/clients.ts       client validation, totals (billed/paid/balance exclude drafts and voids)
lib/pdf/             @react-pdf invoice template (app/invoices/[id]/pdf) and 1099-NEC Copy B
                     (app/payees/[id]/1099?year=)
lib/expenses.ts      expense validation, filtered list + total, archived-category rules
lib/other-income.ts  other income validation + list
lib/payees.ts        payee (1099 contractor) validation, list with yearly 1099 totals, delete rules
lib/range.ts         ?range=preset or ?from&to -> {from,to}; used with components/range-filter.tsx
lib/reports/         data.ts loads plain rows (the only DB access); pnl/expenses/aging/
                     income-by-client/tax/form-1099 are pure; index.ts builds each report + its CSV table
lib/dashboard.ts     dashboard numbers + recent activity
lib/csv.ts           CSV serialization
lib/export.ts        "Export all data": every table as CSV in a zip (fflate), served by app/export
db/schema.ts         Drizzle schema
db/index.ts          connection (path from DATABASE_PATH)
db/seed.ts           demo data
drizzle/             generated migrations, committed
data/                ledger.db, demo.db (gitignored)
uploads/             receipts + logo (gitignored)
```

## Data model (summary)

- `business_settings` (single row): name, address, email, phone, logo path, default terms days,
  invoice prefix + next number, payment instructions. (Email template columns exist but are unused.)
- `clients`: name, contact name, email, billing address, `default_rate_cents` (pre-fills invoice
  lines), notes, `archived_at`. Deletable only when nothing references them; otherwise archive.
- `invoices`: number (unique), client, `issued_on`, `due_on`, notes, `sent_at`, `voided_at`,
  timestamps. The number is suggested from settings and editable (to re-enter old QBO invoices);
  saving a number at or past the counter advances it. Deleted drafts leave gaps.
- `invoice_line_items`: description, `quantity_milli`, `unit_price_cents`, `amount_cents`,
  `sort_order`.
- `payments`: invoice, `received_on`, `amount_cents`, method (venmo|check|cash|ach_zelle|other),
  reference, notes, `voided_at`. Rules in `lib/payments.ts`: no overpayment, no future dates, a
  payment on a draft marks it sent on the payment date, "un-send" only with no active payments.
  Manual `sent_at` is stored as noon UTC of the chosen date (`sentAtFor`).
- `expenses`: `paid_on`, vendor, category, `amount_cents` (full amount paid), `business_pct`,
  payment method, description, receipt path, optional client, optional payee, timestamps.
- `payees`: 1099 contractors. Name (W-9 line 1), business name, email, address, tax
  classification, `is_attorney`, `tin_type` + `tin_last4` (never the full TIN), `w9_received_on`,
  notes, `archived_at`. Deletable only with no linked expenses; otherwise archive.
  `business_settings.tax_id` is the payer TIN printed on 1099s.
- `expense_categories`: name, `schedule_c_line` (a Schedule C line, or `personal`), default
  `business_pct`, `archived_at`. Saving a category can apply its % to past expenses.
- Migration 0003 is hand-written (`ADD COLUMN`): drizzle-kit's table rebuild would have failed on
  existing data. Check generated SQL before committing; prefer `ADD COLUMN` for new columns.
  (0004_payees was generated as plain `CREATE TABLE` + `ADD COLUMN` and kept as is.)
- `other_income`: `received_on`, source, optional `client_id` (for the Jan–Sep 2026 QBO backfill:
  one entry per client per month), `amount_cents`, notes, `voided_at`. The UI hard-deletes; reports
  must still exclude `voided_at` rows.

## Commands

```
npm run dev            # dev server against data/ledger.db
npm run start:app      # migrate + build + start in the foreground, http://127.0.0.1:4747
npm run service:install    # macOS: build + run in background at login (LaunchAgent com.ledger.app)
npm run service:restart    # restart the background app (status / logs / uninstall also exist)
npm run update         # git pull + npm install + migrate + build + restart service
npm test               # vitest run
npm run typecheck      # next typegen + tsc (route PageProps/RouteContext types are generated)
npm run lint
npm run db:generate    # drizzle-kit: generate a migration after editing db/schema.ts
npm run db:migrate     # apply migrations (also runs at startup)
npm run demo           # fresh data/demo.db + data/demo-uploads, served on :4748 with a banner
npm run db:seed        # seed demo data into DATABASE_PATH (refuses if any data exists)
npm run db:wipe        # erase DATABASE_PATH's records (type the filename; saves a .before-wipe copy)
npm run backup         # (Phase 6) same as the Backup button: zip db + uploads into BACKUP_DIR
```

## Environment (`.env.local`)

```
DATABASE_PATH=./data/ledger.db
UPLOADS_DIR=./uploads
BACKUP_DIR=/path/to/cloud-synced/folder
```

## Running day to day

- The background service (`scripts/service.ts`) writes `~/Library/LaunchAgents/com.ledger.app.plist`,
  runs `next start -H 127.0.0.1 -p 4747` with `KeepAlive`, logs to `~/Library/Logs/Ledger/ledger.log`.
- It binds to 127.0.0.1 so other devices on the same Wi-Fi can't reach the books. Port 4747 avoids
  clashing with other dev servers on 3000. `LEDGER_HOST` / `LEDGER_PORT` in `.env.local` override it.
- Phone access is via **Tailscale Serve**, not by changing the bind address:
  `tailscale serve --bg 4747` proxies `https://<mac>.<tailnet>.ts.net` (tailnet-only, real TLS cert)
  to 127.0.0.1:4747. On macOS the CLI is `/Applications/Tailscale.app/Contents/MacOS/Tailscale`.
  The Mac must be awake. The layout is responsive (top menu bar below `md`), form text is 16px on
  phones so iOS doesn't zoom, and `apple-icon.png` + `appleWebApp` metadata support Add to Home Screen.
- Keep the project outside `~/Documents` / `~/Desktop`: macOS privacy controls block background
  agents there. The owner's checkout is `~/Projects/ledger`.
- npm 11 blocks dependency install scripts unless listed in `package.json` `allowScripts`. When a
  dependency with an install script changes version, add the new `name@version` there.

## Next.js 16 notes (read AGENTS.md)

- Root layout sets `dynamic = "force-dynamic"`: better-sqlite3 is synchronous, so without it pages
  would be prerendered at build time with whatever was in the DB.
- `params`/`searchParams` are Promises; use the generated `PageProps<"/route">` / `RouteContext` types.
- Forms: client components use `useFormAction()` (`components/use-form-action.ts`), which submits via
  `onSubmit` + `useActionState` so React doesn't reset inputs on validation errors. Server actions
  return `ActionState` (`lib/form.ts`).
- Uploaded files live in `UPLOADS_DIR` and are served by `app/files/[...path]/route.ts`
  (path-traversal guarded). Only the relative path is stored in the DB. Receipts are shown through
  `app/expenses/[id]/receipt` (inline, or `?download=1` as "Receipt <date> <vendor> <amount>.<ext>")
  in `components/receipt-viewer.tsx`, a native `<dialog>` overlay, so viewing never leaves the page.
- UI components are hand-written in shadcn style (`components/ui/`); native `<select>` and
  `confirm()` stand in for Radix Select/Dialog to keep dependencies down.

## Working rules

- Keep dependencies minimal. Ask before adding a runtime dependency not listed above.
- Every phase ends runnable, with click-through test steps.
- Any change to money math or reports needs a test, including date-boundary cases.
- Out of scope: auth, multi-user, bank feeds, CSV import, online payments, payroll, inventory,
  sales tax, multi-currency, double entry, estimates, mileage.

## Build phases

1. ✅ Setup, schema + migrations + seeded categories, settings page, money/date libs + tests.
2. ✅ Clients + invoices + line items + invoice PDF.
3. ✅ Mark as sent + payments (partial, void) + derived status. Email sending and reminders were
   dropped: the owner sends the PDF manually (~5 invoices/year). Nodemailer is not a dependency.
4. ✅ Expenses (CRUD, receipts, date-range + category filters, "save and add another") + other income.
5. ✅ Dashboard + reports (P&L with prior-period compare, expense report with drill-down, A/R aging,
   income by client, Schedule C summary) + CSV (`/reports/csv?report=…`) and print-to-PDF.
   Later: payees + 1099-NEC summary (`/reports/1099`, CSV `report=1099`) and recipient-copy PDFs.
6. Full CSV export (Settings → Export all data), demo + wipe, README, error/404 pages: done.
   Still to do: Backup button + `npm run backup` (owner deferred; Google Drive folder later).
