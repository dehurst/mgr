import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { authRequired, isAllowedEmail, missingAuthSettings } from "./auth-config";

/** The signed-in, allowed user's email; null when sign-in isn't required or nobody is signed in. */
export async function currentUserEmail(): Promise<string | null> {
  if (!authRequired()) return null;
  const email = (await auth())?.user?.email;
  return email && isAllowedEmail(email) ? email : null;
}

/**
 * Called by getDb(), so no page, action, or route can read or change the books without a valid
 * session for an allowed address. The proxy redirects earlier; this is the check that counts.
 */
export async function requireUser(): Promise<void> {
  if (!authRequired()) return;
  const missing = missingAuthSettings();
  if (missing.length) throw new Error(`Sign-in isn't set up. Missing: ${missing.join(", ")}.`);
  if (!(await currentUserEmail())) redirect("/signin");
}
