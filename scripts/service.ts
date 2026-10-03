// Run Ledger in the background on macOS via a per-user LaunchAgent, so it starts at login and
// restarts if it crashes. Usage: tsx scripts/service.ts <install|uninstall|restart|status|logs>
import "./env";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const LABEL = "com.ledger.app";
// npm runs scripts from the project root.
const ROOT = process.cwd();
const PLIST = path.join(os.homedir(), "Library", "LaunchAgents", `${LABEL}.plist`);
const LOG_DIR = path.join(os.homedir(), "Library", "Logs", "Ledger");
const LOG_FILE = path.join(LOG_DIR, "ledger.log");

export function appHost(): string {
  return process.env.LEDGER_HOST || "127.0.0.1";
}

export function appPort(): string {
  return process.env.LEDGER_PORT || "4747";
}

function xml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildPlist(opts: { node: string; root: string; host: string; port: string; log: string; path: string }): string {
  const args = [opts.node, path.join(opts.root, "node_modules", "next", "dist", "bin", "next"), "start", "-H", opts.host, "-p", opts.port];
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
${args.map((a) => `    <string>${xml(a)}</string>`).join("\n")}
  </array>
  <key>WorkingDirectory</key>
  <string>${xml(opts.root)}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>NODE_ENV</key>
    <string>production</string>
    <key>PATH</key>
    <string>${xml(opts.path)}</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>30</integer>
  <key>StandardOutPath</key>
  <string>${xml(opts.log)}</string>
  <key>StandardErrorPath</key>
  <string>${xml(opts.log)}</string>
</dict>
</plist>
`;
}

function domain(): string {
  return `gui/${os.userInfo().uid}`;
}

function launchctl(args: string[], allowFail = false): boolean {
  const r = spawnSync("launchctl", args, { stdio: allowFail ? "ignore" : "inherit" });
  if (r.status !== 0 && !allowFail) throw new Error(`launchctl ${args.join(" ")} failed`);
  return r.status === 0;
}

function isLoaded(): boolean {
  return spawnSync("launchctl", ["print", `${domain()}/${LABEL}`], { stdio: "ignore" }).status === 0;
}

function npm(script: string) {
  execFileSync("npm", ["run", script], { cwd: ROOT, stdio: "inherit" });
}

function url(): string {
  return `http://${appHost() === "0.0.0.0" ? "localhost" : appHost()}:${appPort()}`;
}

function install() {
  console.log("1/3 Updating the database…");
  npm("db:migrate");
  console.log("2/3 Building the app (about a minute)…");
  npm("build");
  console.log("3/3 Registering the background service…");
  fs.mkdirSync(path.dirname(PLIST), { recursive: true });
  fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.writeFileSync(
    PLIST,
    buildPlist({
      node: process.execPath,
      root: ROOT,
      host: appHost(),
      port: appPort(),
      log: LOG_FILE,
      path: `${path.dirname(process.execPath)}:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin`,
    }),
  );
  if (isLoaded()) launchctl(["bootout", `${domain()}/${LABEL}`], true);
  launchctl(["bootstrap", domain(), PLIST]);
  console.log(`\nLedger is running and will start automatically when you log in.\nOpen ${url()} (bookmark it).`);
}

function uninstall() {
  if (isLoaded()) launchctl(["bootout", `${domain()}/${LABEL}`], true);
  fs.rmSync(PLIST, { force: true });
  console.log("Ledger background service removed. Your data is untouched.");
}

function restart() {
  if (!isLoaded()) {
    console.log("The background service isn't installed. Run: npm run service:install");
    return;
  }
  launchctl(["kickstart", "-k", `${domain()}/${LABEL}`]);
  console.log(`Restarted. Open ${url()}`);
}

function status() {
  console.log(isLoaded() ? `Installed and loaded. ${url()}` : "Not installed. Run: npm run service:install");
  console.log(`Logs: ${LOG_FILE}`);
}

function logs() {
  if (!fs.existsSync(LOG_FILE)) return console.log("No log file yet.");
  const lines = fs.readFileSync(LOG_FILE, "utf8").trimEnd().split("\n");
  console.log(lines.slice(-50).join("\n"));
}

const isMain = /scripts[\\/]service\.ts$/.test(process.argv[1] ?? "");
if (isMain) {
  if (process.platform !== "darwin") {
    console.error("The background service is macOS-only. Use `npm run start:app` instead.");
    process.exit(1);
  }
  const commands: Record<string, () => void> = { install, uninstall, restart, status, logs };
  const cmd = commands[process.argv[2] ?? ""];
  if (!cmd) {
    console.error("Usage: service <install|uninstall|restart|status|logs>");
    process.exit(1);
  }
  cmd();
}
