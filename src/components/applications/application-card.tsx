"use client";

import { ExternalLinkIcon, Trash2Icon, XIcon } from "lucide-react";
import { useState, useTransition } from "react";
import {
  addApplicationEvent,
  removeApplication,
  removeApplicationEvent,
  setCompanyKind,
  updateApplicationDetails,
  type ActionResult,
} from "@/app/actions";
import { localNow } from "@/components/jobs/apply-fields";
import { OptionSelect } from "@/components/option-select";
import { TierBadge } from "@/components/tier-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatAge } from "@/lib/jobs/format";
import {
  CHANNEL_LABEL,
  COMPANY_KIND_LABEL,
  COMPANY_KINDS,
  ELIGIBILITY_CHECK_LABEL,
  ELIGIBILITY_CHECKS,
  EVENT_LABEL,
  LOGGABLE_EVENTS,
  STATUS_LABEL,
  type CompanyKind,
  type EligibilityCheck,
  type EventType,
} from "@/lib/jobs/model";
import type { ApplicationRow } from "@/lib/jobs/queries";

const EVENT_OPTIONS = LOGGABLE_EVENTS.map((value) => ({ value, label: EVENT_LABEL[value] }));
const CHECK_OPTIONS = [{ value: "none", label: "Not checked yet" }, ...ELIGIBILITY_CHECKS.map((value) => ({ value, label: ELIGIBILITY_CHECK_LABEL[value] }))];
const KIND_OPTIONS = COMPANY_KINDS.map((value) => ({ value, label: COMPANY_KIND_LABEL[value] }));

const STATUS_CLASS: Record<string, string> = {
  applied: "",
  screening: "bg-tier-likely/15 text-tier-likely",
  interviewing: "bg-tier-possible/15 text-tier-possible",
  offer: "bg-tier-open/15 text-tier-open",
  accepted: "bg-tier-open/15 text-tier-open",
  rejected: "bg-destructive/10 text-destructive",
  withdrawn: "bg-muted text-muted-foreground",
};

function dateLabel(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function ApplicationCard({ app, now }: { app: ApplicationRow; now: Date }) {
  const [eventType, setEventType] = useState<EventType>("recruiter_reply");
  const [eventAt, setEventAt] = useState(localNow);
  const [eventNote, setEventNote] = useState("");
  const [notes, setNotes] = useState(app.notes);
  const [askedRate, setAskedRate] = useState(app.askedRate ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function perform(action: () => Promise<ActionResult>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error);
      else after?.();
    });
  }

  const hoursAfterPosting = app.postedAt ? (app.appliedAt.getTime() - app.postedAt.getTime()) / 3_600_000 : null;
  const speed =
    hoursAfterPosting == null
      ? null
      : hoursAfterPosting < 48
        ? `${Math.max(0, Math.round(hoursAfterPosting))}h after posting`
        : `${Math.round(hoursAfterPosting / 24)}d after posting`;

  return (
    <article className="flex flex-col gap-4 rounded-xl border bg-card p-4" aria-busy={pending}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge className={STATUS_CLASS[app.status]}>{STATUS_LABEL[app.status]}</Badge>
            <TierBadge eligibility={app.eligibility} reason={`Listed as ${app.eligibility}`} />
          </div>
          <h3 className="font-heading text-lg leading-snug font-semibold">
            <a href={app.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:underline">
              {app.title}
              <ExternalLinkIcon className="size-3.5 text-muted-foreground" />
            </a>
          </h3>
          <p className="text-sm text-muted-foreground">
            {[
              app.company,
              `applied ${dateLabel(app.appliedAt)} (${formatAge(app.appliedAt, now)})`,
              speed,
              CHANNEL_LABEL[app.channel],
              app.resumeVersion ? `CV: ${app.resumeVersion}${app.tailored ? ", tailored" : ""}` : app.tailored ? "tailored CV" : null,
              app.coverLetter ? "cover letter" : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (confirm("Remove this application and its history? The job goes back to your list.")) perform(() => removeApplication(app.id));
          }}
        >
          <Trash2Icon />
          Undo applied
        </Button>
      </div>

      <ol className="flex flex-col gap-1.5 border-l-2 border-border pl-4">
        {app.events.map((event) => (
          <li key={event.id} className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <span className="font-medium">{EVENT_LABEL[event.type]}</span>
            <span className="text-muted-foreground">{dateLabel(event.occurredAt)}</span>
            {event.notes ? <span className="text-muted-foreground">· {event.notes}</span> : null}
            {event.type !== "applied" ? (
              <button
                className="text-muted-foreground hover:text-destructive"
                aria-label={`Remove “${EVENT_LABEL[event.type]}”`}
                onClick={() => perform(() => removeApplicationEvent(event.id))}
              >
                <XIcon className="size-3.5" />
              </button>
            ) : null}
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-end gap-2 rounded-lg bg-muted/50 p-3">
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">What happened</Label>
          <OptionSelect label="What happened" value={eventType} options={EVENT_OPTIONS} onChange={setEventType} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`event-at-${app.id}`} className="text-xs text-muted-foreground">
            When
          </Label>
          <Input id={`event-at-${app.id}`} type="datetime-local" value={eventAt} onChange={(e) => setEventAt(e.target.value)} className="w-auto bg-background" />
        </div>
        <div className="flex min-w-48 flex-1 flex-col gap-1">
          <Label htmlFor={`event-note-${app.id}`} className="text-xs text-muted-foreground">
            Note (optional)
          </Label>
          <Input
            id={`event-note-${app.id}`}
            value={eventNote}
            onChange={(e) => setEventNote(e.target.value)}
            placeholder="e.g. asked about rate and time zone"
            className="bg-background"
          />
        </div>
        <Button
          disabled={pending}
          onClick={() =>
            perform(
              () => addApplicationEvent(app.id, { type: eventType as Exclude<EventType, "applied">, occurredAt: new Date(eventAt).toISOString(), notes: eventNote || undefined }),
              () => {
                setEventNote("");
                setEventAt(localNow());
              },
            )
          }
        >
          Add
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Really open to you?</Label>
          <OptionSelect
            label="Really open to you"
            value={app.eligibilityCheck ?? "none"}
            options={CHECK_OPTIONS}
            onChange={(v) => perform(() => updateApplicationDetails(app.id, { eligibilityCheck: v === "none" ? null : (v as EligibilityCheck) }))}
            className="w-full"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Company type</Label>
          <OptionSelect
            label="Company type"
            value={app.companyKind}
            options={KIND_OPTIONS}
            onChange={(v: CompanyKind) => perform(() => setCompanyKind(app.companyId, v))}
            className="w-full"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`rate-${app.id}`} className="text-xs text-muted-foreground">
            Rate you asked for
          </Label>
          <Input
            id={`rate-${app.id}`}
            value={askedRate}
            onChange={(e) => setAskedRate(e.target.value)}
            onBlur={() => askedRate !== (app.askedRate ?? "") && perform(() => updateApplicationDetails(app.id, { askedRate: askedRate || null }))}
            placeholder="e.g. $35/hr"
          />
        </div>
        <div className="flex flex-col gap-1 sm:col-span-3">
          <Label htmlFor={`notes-${app.id}`} className="text-xs text-muted-foreground">
            Notes
          </Label>
          <Textarea
            id={`notes-${app.id}`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => notes !== app.notes && perform(() => updateApplicationDetails(app.id, { notes }))}
            placeholder="Who you talked to, what they asked, next step…"
            className="min-h-16"
          />
        </div>
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    </article>
  );
}
