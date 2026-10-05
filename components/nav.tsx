"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/invoices", label: "Invoices" },
  { href: "/clients", label: "Clients" },
  { href: "/expenses", label: "Expenses" },
  { href: "/payees", label: "Payees" },
  { href: "/income", label: "Other income" },
  { href: "/reports", label: "Reports" },
  { href: "/settings", label: "Settings" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    // Phones: a sticky top bar with a horizontally scrolling menu. md and up: the sidebar.
    <nav className="no-print sticky top-0 z-20 border-b bg-muted/95 px-2 py-2 backdrop-blur md:static md:w-52 md:shrink-0 md:border-r md:border-b-0 md:bg-muted/40 md:px-3 md:py-6">
      <div className="hidden px-3 text-lg font-semibold tracking-tight md:mb-6 md:block">Ledger</div>
      <ul className="flex gap-1 overflow-x-auto md:grid md:overflow-visible">
        {LINKS.map((l) => {
          const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                className={cn(
                  "block whitespace-nowrap rounded-md px-3 py-1.5 text-sm",
                  active ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                )}
              >
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
