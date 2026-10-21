import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import { authRequired } from "@/lib/auth-config";
import { currentUserEmail } from "@/lib/require-user";
import { signOutAction } from "./auth-actions";
import "./globals.css";

// Every page reads the local SQLite database, so nothing may be prerendered at build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Simple Ledger",
  description: "Local bookkeeping",
  // "Add to Home Screen" on iPhone opens it full-screen with this name.
  appleWebApp: { capable: true, title: "Simple Ledger", statusBarStyle: "default" },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Signed out (sign-in page): no menu. Signed in on the web: menu with Sign out.
  const email = await currentUserEmail();
  const showNav = !authRequired() || !!email;
  return (
    <html lang="en">
      <body className="min-h-screen">
        <div className="flex min-h-screen flex-col md:flex-row">
          {showNav && <Nav signOut={email ? signOutAction : undefined} />}
          <main className="min-w-0 flex-1 px-4 py-5 md:px-8 md:py-8 print:px-0 print:py-0">
            {process.env.LEDGER_DEMO === "1" && (
              <div className="no-print mx-auto mb-4 max-w-6xl rounded-md bg-warning/20 px-3 py-2 text-sm">
                <span className="font-medium">Demo mode:</span> fake data in data/demo.db. Nothing here touches your real books.
              </div>
            )}
            <div className="mx-auto max-w-6xl">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
