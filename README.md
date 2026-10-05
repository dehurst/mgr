# Ledger

Bookkeeping for a one-person business, running on your own Mac: invoices, payments you receive,
expenses, payees (1099 contractors), and tax-time reports. Nothing is sent to the cloud, and there's
no login because only your Mac (and devices on your Tailscale network) can reach it.

Developer conventions and the full spec are in `CLAUDE.md`.

## Everyday use

Open **http://127.0.0.1:4747** (bookmark it). The app runs in the background and starts when you log
in, so there's nothing to launch. On your phone, use your Tailscale address
(`https://<your-mac>.<tailnet>.ts.net`). Your Mac has to be awake for that.

| To… | Go to |
| --- | --- |
| Bill a client | Invoices → New invoice, then download the PDF and send it yourself |
| Record a client's payment | Open the invoice → Record payment |
| Log a business (or personal) expense | Expenses → New expense |
| Pay a contractor | Payees → the person → Record a payment |
| See how the year is going | Dashboard, or Reports → Profit & Loss |
| Prepare taxes | Reports → Tax summary (Schedule C), and 1099-NEC summary in January |
| Get everything as spreadsheets | Settings → Export all data (CSV) |

## Commands (run in Terminal from `~/Projects/ledger`)

```bash
npm run update            # get the latest version: pull, install, migrate, rebuild, restart
npm run service:status    # is the background app running?
npm run service:restart   # restart it
npm run service:logs      # recent log lines, if something looks wrong
npm run demo              # try things on fake data at http://127.0.0.1:4748 (Ctrl+C to stop)
npm run db:wipe           # erase all data (asks you to type the filename; saves a copy first)
```

`npm run demo` makes a fresh `data/demo.db` every time and shows a "Demo mode" banner. It never
touches your real books.

## Where your data lives

- `data/ledger.db`: the database (all your records)
- `uploads/`: receipts and your logo

Both stay on this Mac and are never committed to git. **Back them up.** Until the Backup button
exists, copy the whole `data` and `uploads` folders somewhere safe now and then, at a moment when
you're not entering anything (the `ledger.db-wal` file next to the database is part of it). Settings → Export all data gives you a readable copy in spreadsheet form.

## First-time setup (already done on the owner's Mac)

```bash
git clone <repo> ~/Projects/ledger && cd ~/Projects/ledger
npm install                  # needs Node 22 or newer
cp .env.example .env.local   # optional: change where data and uploads are stored
npm run service:install      # build and run in the background, start at login
```

Keep the project outside `~/Documents` and `~/Desktop`: macOS blocks background apps from those
folders.

## For development

```bash
npm run dev         # development server at http://localhost:3000
npm test            # unit tests
npm run typecheck
npm run lint
```
