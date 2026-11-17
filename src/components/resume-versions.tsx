"use client";

import { useState, useTransition } from "react";
import { addResumeVersion, makeResumeDefault } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Resume {
  id: string;
  name: string;
  url: string | null;
  notes: string;
  isDefault: boolean;
  createdAt: Date;
}

export function ResumeVersions({ resumes }: { resumes: Resume[] }) {
  const [form, setForm] = useState({ name: "", url: "", notes: "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add() {
    setError(null);
    startTransition(async () => {
      const result = await addResumeVersion({ ...form, makeDefault: true });
      if (!result.ok) setError(result.error);
      else setForm({ name: "", url: "", notes: "" });
    });
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-heading text-xl font-semibold">CV versions</h2>
      {resumes.length ? (
        <ul className="flex flex-col divide-y rounded-xl border bg-card">
          {resumes.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="flex items-center gap-2 font-medium">
                  {r.url ? (
                    <a href={r.url} target="_blank" rel="noreferrer" className="hover:underline">
                      {r.name}
                    </a>
                  ) : (
                    r.name
                  )}
                  {r.isDefault ? <Badge variant="secondary">Default</Badge> : null}
                </span>
                <span className="text-sm text-muted-foreground">
                  Added {r.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  {r.notes ? ` · ${r.notes}` : ""}
                </span>
              </div>
              {!r.isDefault ? (
                <Button variant="outline" size="sm" disabled={pending} onClick={() => startTransition(async () => void (await makeResumeDefault(r.id)))}>
                  Make default
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No versions yet. Add the CV you&apos;re sending now.</p>
      )}
      <div className="grid gap-3 rounded-xl border bg-card/60 p-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cv-name">Name</Label>
          <Input id="cv-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Nov 2026 — Galatea" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cv-url">Link (optional)</Label>
          <Input id="cv-url" type="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="Overleaf or PDF link" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cv-notes">What changed (optional)</Label>
          <Input id="cv-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
        <div className="flex items-center gap-3 sm:col-span-3">
          <Button onClick={add} disabled={pending || !form.name.trim()}>
            Add as the default version
          </Button>
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        </div>
      </div>
    </section>
  );
}
