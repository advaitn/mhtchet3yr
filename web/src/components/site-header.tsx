"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Menu, X } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Home" },
  { href: "/finder?course=3", label: "College Finder" },
  { href: "/rankings", label: "Rankings" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  function isActive(href: string): boolean {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(href.split("?")[0] ?? href);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-white shadow-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white">
            <BookOpen className="h-5 w-5" />
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-foreground leading-tight">
              LawCET Guide
            </p>
            <p className="text-xs text-muted-foreground">Admission intelligence</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "px-3.5 py-2 text-sm font-medium transition rounded-lg",
                isActive(link.href)
                  ? "bg-primary text-white shadow-sm"
                  : "text-foreground hover:bg-gray-100",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-white hover:bg-gray-50 md:hidden transition"
          onClick={() => setOpen((value) => !value)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-border bg-white px-4 py-3 md:hidden">
          <nav className="flex flex-col gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "rounded-lg px-3.5 py-2 text-sm font-medium transition",
                  isActive(link.href)
                    ? "bg-primary text-white"
                    : "text-foreground hover:bg-gray-50",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
