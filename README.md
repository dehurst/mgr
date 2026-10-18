# Ledger

Bookkeeping for a one-person business: invoices, payments you receive, expenses, payees (1099
contractors), and tax-time reports. It runs online (Vercel, with Google sign-in that only lets your
account in) or on your own Mac. See "Moving it online" below.

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
| Keep your own copy of the books | Settings → Download backup |

## Commands (run in Terminal from `~/Projects/ledger`)

```bash
npm run update            # get the latest version: pull, install, migrate, rebuild, restart
npm run service:status    # is the background app running?
npm run service:restart   # restart it
npm run service:logs      # recent log lines, if something looks wrong
npm run demo              # try things on fake data at http://127.0.0.1:4748 (Ctrl+C to stop)
npm run db:wipe           # erase all data (asks you to type the filename; saves a copy first)
npm run cloud:push        # one-time: copy the Mac's books and receipts to the online version
```

`npm run demo` makes a fresh `data/demo.db` every time and shows a "Demo mode" banner. It never
touches your real books.

## Where your data lives

- `data/ledger.db`: the database (all your records)
- `uploads/`: receipts and your logo

On the Mac, both stay on this computer and are never committed to git. **Back them up:** Settings →
Download backup saves the complete books as one file, and copy the `uploads` folder for receipts.
Online, the database lives in Turso and receipts in private Vercel Blob storage, with a daily
backup kept for 30 days.

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

## Moving it online (free: Vercel + Turso + Vercel Blob)

Once online, you sign in at your Vercel address with Google on any device; the Mac can be off.
Nothing changes for the Mac version until you switch. Steps, in order:

1. **Turso (database).** Sign up at turso.tech → create a database named `ledger` (pick the US
   region closest to you) → copy its URL (`libsql://…`) → create a token. Keep both handy.
2. **Google sign-in.** console.cloud.google.com → new project "Ledger" → Google Auth Platform:
   app name "Ledger", your email, audience **External**, and add yourself as a **test user**
   (leaving the app in Testing means Google itself only lets listed users sign in). Create an
   OAuth client of type **Web application**; leave the redirect URI for step 4.
3. **Vercel.** Add New → Project → import the GitHub repo. In Storage, create a **Blob** store
   (choose Private if asked) and connect it to the project. In Settings → Environment Variables
   add: `DATABASE_URL`, `DATABASE_AUTH_TOKEN` (from Turso), `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`
   (from Google), `ALLOWED_EMAIL` (your Gmail address), and `AUTH_SECRET` and `CRON_SECRET` (run
   `openssl rand -base64 32` in Terminal, once for each). Deploy.
4. **Finish Google.** Copy your Vercel address (e.g. `https://ledger-xyz.vercel.app`) and add
   `https://ledger-xyz.vercel.app/api/auth/callback/google` as the OAuth client's authorized
   redirect URI. Open the Vercel address and sign in. Google may warn the app isn't verified;
   that's expected for a private app: Continue.
5. **Copy your data up** from the Mac: `npm run update`, then create `.env.cloud` in the project
   folder with `DATABASE_URL=…`, `DATABASE_AUTH_TOKEN=…`, and `BLOB_READ_WRITE_TOKEN=…` (Vercel →
   Storage → your Blob store → `.env.local` tab), and run `npm run cloud:push`. It checks that every
   table matches before it says Done. Delete `.env.cloud` afterward, then **Revoke Token** on the
   Blob store: the app connects with Vercel's short-lived OIDC tokens (`BLOB_STORE_ID`), so the
   long-lived read-write key is only needed for this copy.
6. **Switch over.** From now on use only the online version (two copies would drift apart). On your
   phone, open the address and Share → Add to Home Screen. Turn off the Mac version so nothing gets
   entered there by mistake: `npm run service:uninstall` and
   `/Applications/Tailscale.app/Contents/MacOS/Tailscale serve reset`. `data/ledger.db` stays as a
   frozen copy.

Online, a backup of the whole database is saved every day (newest 30 kept), and Settings →
Download backup gives you a copy anytime. Turso's free plan archives a database after 10 idle days;
the daily backup keeps it active.
