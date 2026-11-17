"use client";

import { CheckIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { applyToJob } from "@/app/actions";
import { ApplyFields, applyFieldsToInput, initialApplyFields, type ResumeOption } from "@/components/jobs/apply-fields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/** Mark a job applied. Defaults are pre-filled, so it's one more click. */
export function ApplyDialog({
  jobId,
  title,
  resumes,
  onApplied,
}: {
  jobId: string;
  title: string;
  resumes: ResumeOption[];
  onApplied: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(() => initialApplyFields(resumes));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await applyToJob(jobId, applyFieldsToInput(value));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      onApplied();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setValue(initialApplyFields(resumes));
        setOpen(next);
      }}
    >
      <DialogTrigger render={<Button />}>
        <CheckIcon />
        Applied
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Mark as applied</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>
        <ApplyFields value={value} onChange={setValue} resumes={resumes} />
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Saving…" : "Save application"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
