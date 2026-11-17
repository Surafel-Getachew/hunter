"use client";

import { OptionSelect } from "@/components/option-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APPLICATION_CHANNELS, CHANNEL_LABEL, type ApplicationChannel } from "@/lib/jobs/model";

export interface ResumeOption {
  id: string;
  name: string;
  isDefault: boolean;
}

export interface ApplyFieldsValue {
  channel: ApplicationChannel;
  resumeVersionId: string;
  tailored: boolean;
  coverLetter: boolean;
  /** datetime-local value, in local time. */
  appliedAt: string;
}

const CHANNEL_OPTIONS = APPLICATION_CHANNELS.map((value) => ({ value, label: CHANNEL_LABEL[value] }));
export const NO_RESUME = "none";

/** "2026-11-02T14:30", local time, for a datetime-local input. */
export function localNow(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function initialApplyFields(resumes: ResumeOption[], channel: ApplicationChannel = "company_site"): ApplyFieldsValue {
  return {
    channel,
    resumeVersionId: resumes.find((r) => r.isDefault)?.id ?? NO_RESUME,
    tailored: false,
    coverLetter: false,
    appliedAt: localNow(),
  };
}

export function applyFieldsToInput(value: ApplyFieldsValue) {
  return {
    channel: value.channel,
    resumeVersionId: value.resumeVersionId === NO_RESUME ? null : value.resumeVersionId,
    tailored: value.tailored,
    coverLetter: value.coverLetter,
    appliedAt: new Date(value.appliedAt).toISOString(),
  };
}

/** How you applied: the fields that let the dashboard compare channels, CV versions and timing. */
export function ApplyFields({
  value,
  onChange,
  resumes,
}: {
  value: ApplyFieldsValue;
  onChange: (value: ApplyFieldsValue) => void;
  resumes: ResumeOption[];
}) {
  const set = <K extends keyof ApplyFieldsValue>(key: K, v: ApplyFieldsValue[K]) => onChange({ ...value, [key]: v });
  const resumeOptions = [{ value: NO_RESUME, label: "Not tracked" }, ...resumes.map((r) => ({ value: r.id, label: r.name }))];

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <Label>How did you apply?</Label>
        <OptionSelect label="How did you apply" value={value.channel} options={CHANNEL_OPTIONS} onChange={(v) => set("channel", v)} className="w-full" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>CV version</Label>
        <OptionSelect label="CV version" value={value.resumeVersionId} options={resumeOptions} onChange={(v) => set("resumeVersionId", v)} className="w-full" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="applied-at">When</Label>
        <Input id="applied-at" type="datetime-local" value={value.appliedAt} onChange={(e) => set("appliedAt", e.target.value)} />
      </div>
      <div className="flex flex-col justify-end gap-2">
        <Label className="font-normal">
          <Checkbox checked={value.tailored} onCheckedChange={(c) => set("tailored", c === true)} />
          CV tailored to this job
        </Label>
        <Label className="font-normal">
          <Checkbox checked={value.coverLetter} onCheckedChange={(c) => set("coverLetter", c === true)} />
          Sent a cover letter
        </Label>
      </div>
    </div>
  );
}
