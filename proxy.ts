// Sends anyone who isn't signed in to /signin before a page renders. The data itself is guarded
// separately in getDb() (lib/require-user.ts), so this is a convenience, not the only lock.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { authRequired, isAllowedEmail } from "@/lib/auth-config";

export default auth((req) => {
  if (!authRequired()) return;
  if (isAllowedEmail(req.auth?.user?.email)) return;
  if (req.nextUrl.pathname === "/signin") return;
  if (req.method !== "GET") return new NextResponse("Sign in required.", { status: 401 });
  const url = new URL("/signin", req.nextUrl);
  url.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
});

export const config = {
  // Everything except sign-in's own endpoints, the backup cron (it checks CRON_SECRET), and static assets.
  matcher: ["/((?!api/auth|api/cron|_next/static|_next/image|favicon.ico|apple-icon.png).*)"],
};
