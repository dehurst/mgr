"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/invoices", label: "Invoices" },
  { href: "/clients", label: "Clients" },
  { href: "/expenses", label: "Expenses" },
  { href: "/income", label: "Other income" },
  { href: "/reports", label: "Reports" },
  { href: "/settings", label: "Settings" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="no-print w-52 shrink-0 border-r bg-muted/40 px-3 py-6">
      <div className="mb-6 px-3 text-lg font-semibold tracking-tight">Ledger</div>
      <ul className="grid gap-1">
        {LINKS.map((l) => {
          const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                className={cn(
                  "block rounded-md px-3 py-1.5 text-sm",
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
