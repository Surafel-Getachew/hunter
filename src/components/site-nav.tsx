"use client";

import { LogOutIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth-client";
import { cn } from "cn";

const LINKS = [
  { href: "/", label: "Jobs" },
  { href: "/applications", label: "Applications" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/check", label: "Check by hand" },
  { href: "/settings", label: "Settings" },
];

export function SiteNav({ dueCount }: { dueCount: number }) {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <header className="border-b bg-card/60">
      <nav className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-1 gap-y-2 px-4 py-3">
        <Link href="/" className="mr-4 font-heading text-xl font-semibold">
          Job hunt
        </Link>
        {LINKS.map((link) => {
          const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
                active && "bg-accent text-accent-foreground",
              )}
            >
              {link.label}
              {link.href === "/check" && dueCount ? ` · ${dueCount}` : null}
            </Link>
          );
        })}
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={async () => {
            await signOut();
            router.push("/login");
          }}
        >
          <LogOutIcon />
          Sign out
        </Button>
      </nav>
    </header>
  );
}
