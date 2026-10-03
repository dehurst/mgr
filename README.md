# Ledger

Local-only bookkeeping for a one-person business: expenses, invoices, payments, and tax-time reports.
See `CLAUDE.md` for conventions and the full spec.

## Quick start

```bash
npm install
cp .env.example .env.local   # then fill in BACKUP_DIR and SMTP_* (optional for now)
npm run dev                  # http://localhost:3000, for development
npm run start:app            # migrate + production build + start, for day-to-day use
npm test
```

The database lives at `data/ledger.db` and uploads in `uploads/` (both gitignored).
