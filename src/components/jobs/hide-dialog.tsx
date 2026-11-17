"use client";

import { EyeOffIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { hideJob } from "@/app/actions";
import { OptionSelect } from "@/components/option-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SKIP_REASON_LABEL, SKIP_REASONS, type SkipReason } from "@/lib/jobs/model";

const REASONS = SKIP_REASONS.map((value) => ({ value, label: SKIP_REASON_LABEL[value] }));

/** Hide with a reason: the reasons show which filters let the wrong jobs through. */
export function HideDialog({ jobId, title, onHidden }: { jobId: string; title: string; onHidden: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<SkipReason>("wrong_stack");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await hideJob(jobId, { reason, note: note || undefined });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      onHidden();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" />}>
        <EyeOffIcon />
        Hide
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Why skip it?</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <OptionSelect label="Reason" value={reason} options={REASONS} onChange={setReason} className="w-full" />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="skip-note">Note (optional)</Label>
            <Input id="skip-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. requires a German work permit" />
          </div>
        </div>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Hiding…" : "Hide job"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
