# Ledger

Local-only bookkeeping for a one-person business: expenses, invoices, payments, and tax-time reports.
See `CLAUDE.md` for conventions and the full spec.

## Quick start

```bash
npm install
cp .env.example .env.local   # then fill in BACKUP_DIR and SMTP_* (optional for now)
npm run service:install      # macOS: run in the background, start at login
                             # then bookmark http://127.0.0.1:4747
npm run update               # after new code is pushed: pull, rebuild, restart
npm run dev                  # development server, http://localhost:3000
npm test
```

The database lives at `data/ledger.db` and uploads in `uploads/` (both gitignored).
