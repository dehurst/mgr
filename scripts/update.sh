#!/bin/sh
# Pull the latest code, install packages, update the database, rebuild, and restart the
# background service if it's installed. Run with: npm run update
set -e
cd "$(dirname "$0")/.."

# npm may rewrite the lockfile locally; it is regenerated below, so drop local edits to it.
git checkout -- package-lock.json 2>/dev/null || true

echo "Downloading the latest code…"
git pull --ff-only

echo "Installing packages…"
npm install

echo "Updating the database…"
npm run db:migrate

echo "Building…"
npm run build

if [ "$(uname)" = "Darwin" ] && launchctl print "gui/$(id -u)/com.ledger.app" >/dev/null 2>&1; then
  npm run service:restart
else
  echo "Done. Start the app with: npm run start:app"
fi
