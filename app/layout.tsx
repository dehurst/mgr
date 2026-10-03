import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import "./globals.css";

// Every page reads the local SQLite database, so nothing may be prerendered at build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ledger",
  description: "Local bookkeeping",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <div className="flex min-h-screen">
          <Nav />
          <main className="min-w-0 flex-1 px-8 py-8 print:px-0 print:py-0">
            <div className="mx-auto max-w-6xl">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
