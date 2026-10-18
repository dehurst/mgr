// Who may sign in. Pure (reads env only) so the proxy, the server guard, and tests share it.

type Env = Record<string, string | undefined>;

/**
 * Sign-in is required on Vercel (always, so a missing setting fails closed) and anywhere Google
 * sign-in is configured. On the Mac without it, the app stays as before: reachable only from
 * this computer and your Tailscale devices.
 */
export function authRequired(env: Env = process.env): boolean {
  return !!(env.VERCEL || env.AUTH_GOOGLE_ID);
}

/** ALLOWED_EMAIL: one address, or several separated by commas. */
export function allowedEmails(env: Env = process.env): string[] {
  return (env.ALLOWED_EMAIL ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedEmail(email: string | null | undefined, env: Env = process.env): boolean {
  return !!email && allowedEmails(env).includes(email.trim().toLowerCase());
}

/** What's missing for sign-in to work, if anything. */
export function missingAuthSettings(env: Env = process.env): string[] {
  return ["AUTH_SECRET", "AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET", "ALLOWED_EMAIL"].filter((k) => !env[k]);
}

/** Only same-site paths are allowed as the post-sign-in destination. */
export function safeNext(next: unknown): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}
