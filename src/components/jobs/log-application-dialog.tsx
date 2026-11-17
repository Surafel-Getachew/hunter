"use client";

import { PlusIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { logManualApplication } from "@/app/actions";
import { ApplyFields, applyFieldsToInput, initialApplyFields, type ResumeOption } from "@/components/jobs/apply-fields";
import { OptionSelect } from "@/components/option-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ELIGIBILITY_LABEL } from "@/lib/jobs/format";
import { MANUAL_JOB_SOURCES } from "@/lib/jobs/model";
import { VISIBLE_TIERS } from "@/lib/jobs/view";

type Tier = (typeof VISIBLE_TIERS)[number];
type ManualSource = (typeof MANUAL_JOB_SOURCES)[number];

const SOURCE_OPTIONS = MANUAL_JOB_SOURCES.map((value) => ({ value, label: value }));
const TIER_OPTIONS = VISIBLE_TIERS.map((value) => ({ value, label: `${ELIGIBILITY_LABEL[value].badge} ${ELIGIBILITY_LABEL[value].label}` }));

/** Applications to jobs found outside the app (LinkedIn, referrals…), so the funnel counts them too. */
export function LogApplicationDialog({ resumes }: { resumes: ResumeOption[] }) {
  const [open, setOpen] = useState(false);
  const [job, setJob] = useState({ company: "", title: "", url: "" });
  const [source, setSource] = useState<ManualSource>("LinkedIn");
  const [tier, setTier] = useState<Tier>("possible");
  const [apply, setApply] = useState(() => initialApplyFields(resumes, "easy_apply"));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setJob({ company: "", title: "", url: "" });
    setApply(initialApplyFields(resumes, "easy_apply"));
    setError(null);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await logManualApplication({ ...job, source, eligibility: tier, ...applyFieldsToInput(apply) });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      reset();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="lg" />}>
        <PlusIcon />
        Log an application
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Log an application</DialogTitle>
          <DialogDescription>For jobs you found yourself: LinkedIn, X, a referral, a recruiter.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="log-company">Company</Label>
            <Input id="log-company" value={job.company} onChange={(e) => setJob({ ...job, company: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="log-title">Job title</Label>
            <Input id="log-title" value={job.title} onChange={(e) => setJob({ ...job, title: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="log-url">Link to the posting</Label>
            <Input id="log-url" type="url" value={job.url} onChange={(e) => setJob({ ...job, url: e.target.value })} placeholder="https://" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Where you found it</Label>
            <OptionSelect label="Where you found it" value={source} options={SOURCE_OPTIONS} onChange={setSource} className="w-full" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Who it&apos;s open to</Label>
            <OptionSelect label="Who it's open to" value={tier} options={TIER_OPTIONS} onChange={setTier} className="w-full" />
          </div>
        </div>
        <ApplyFields value={apply} onChange={setApply} resumes={resumes} />
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
