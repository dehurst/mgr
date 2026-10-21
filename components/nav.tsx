"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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

const isActive = (href: string, pathname: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

function NavLinks({ pathname, signOut, onNavigate }: { pathname: string; signOut?: () => Promise<void>; onNavigate?: () => void }) {
  return (
    <ul className="grid gap-1">
      {LINKS.map((l) => (
        <li key={l.href}>
          <Link
            href={l.href}
            onClick={onNavigate}
            aria-current={isActive(l.href, pathname) ? "page" : undefined}
            className={cn(
              "block rounded-md px-3 py-2.5 text-base md:py-1.5 md:text-sm",
              isActive(l.href, pathname) ? "bg-primary text-primary-foreground" : "hover:bg-accent",
            )}
          >
            {l.label}
          </Link>
        </li>
      ))}
      {signOut && (
        <li className="mt-2 border-t pt-2 md:mt-0 md:border-t-0 md:pt-0">
          <form action={signOut}>
            <button
              type="submit"
              className="block w-full rounded-md px-3 py-2.5 text-left text-base text-muted-foreground hover:bg-accent md:py-1.5 md:text-sm"
            >
              Sign out
            </button>
          </form>
        </li>
      )}
    </ul>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
    </svg>
  );
}

export function Nav({ signOut }: { signOut?: () => Promise<void> }) {
  const pathname = usePathname();
  // The menu remembers the page it was opened on, so going to another page (a link, or the
  // browser's back button) closes it without an effect.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const close = () => setOpenOn(null);
  const button = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLDivElement>(null);
  const current = LINKS.find((l) => isActive(l.href, pathname));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenOn(null);
    };
    document.addEventListener("keydown", onKey);
    // Keep the page behind the menu from scrolling.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawer.current?.querySelector<HTMLElement>("a, button")?.focus();
    const toggle = button.current;
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      toggle?.focus({ preventScroll: true });
    };
  }, [open]);

  return (
    <>
      {/* Phones: a slim bar with a menu button. */}
      <header className="no-print sticky top-0 z-30 flex h-12 items-center gap-2 border-b bg-muted/95 px-2 backdrop-blur md:hidden">
        <button
          ref={button}
          type="button"
          onClick={() => setOpenOn(open ? null : pathname)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-menu"
          className="flex size-10 items-center justify-center rounded-md hover:bg-accent"
        >
          <MenuIcon open={open} />
        </button>
        <span className="font-semibold tracking-tight">Simple Ledger</span>
        {current && <span className="truncate text-muted-foreground">· {current.label}</span>}
      </header>

      {open && (
        <div className="no-print fixed inset-0 top-12 z-30 md:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={close} aria-hidden="true" />
          <div
            id="mobile-menu"
            ref={drawer}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="absolute inset-y-0 left-0 w-64 max-w-[80vw] overflow-y-auto border-r bg-background px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg"
          >
            <NavLinks pathname={pathname} signOut={signOut} onNavigate={close} />
          </div>
        </div>
      )}

      {/* Tablets and up: the sidebar. */}
      <nav className="no-print hidden w-52 shrink-0 border-r bg-muted/40 px-3 py-6 md:block">
        <div className="mb-6 px-3 text-lg font-semibold tracking-tight">Simple Ledger</div>
        <NavLinks pathname={pathname} signOut={signOut} />
      </nav>
    </>
  );
}
