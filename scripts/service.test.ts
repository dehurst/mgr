import { describe, expect, it } from "vitest";
import { buildPlist } from "./service";

describe("LaunchAgent plist", () => {
  const plist = buildPlist({
    node: "/usr/local/bin/node",
    root: "/Users/me/Projects/R&D ledger",
    host: "127.0.0.1",
    port: "4747",
    log: "/Users/me/Library/Logs/Ledger/ledger.log",
    path: "/usr/local/bin:/usr/bin:/bin",
  });

  it("binds to localhost only on the configured port", () => {
    expect(plist).toContain("<string>-H</string>\n    <string>127.0.0.1</string>");
    expect(plist).toContain("<string>-p</string>\n    <string>4747</string>");
  });

  it("starts at login and restarts on crash", () => {
    expect(plist).toMatch(/<key>RunAtLoad<\/key>\s*<true\/>/);
    expect(plist).toMatch(/<key>KeepAlive<\/key>\s*<true\/>/);
  });

  it("escapes XML special characters in paths", () => {
    expect(plist).toContain("R&amp;D ledger");
    expect(plist).not.toContain("R&D");
  });
});
