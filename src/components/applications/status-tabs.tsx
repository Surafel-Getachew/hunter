"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function StatusTabs({ value, tabs }: { value: string; tabs: { value: string; label: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  return (
    <Tabs value={value} onValueChange={(v) => startTransition(() => router.replace(v === "active" ? pathname : `${pathname}?status=${v}`, { scroll: false }))}>
      <TabsList className="h-auto flex-wrap">
        {tabs.map((t) => (
          <TabsTrigger key={t.value} value={t.value}>
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
