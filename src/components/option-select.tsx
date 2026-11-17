"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface Option<T extends string> {
  value: T;
  label: string;
}

/** A labelled single-choice select over a fixed list of options. */
export function OptionSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  size = "default",
  className,
}: {
  label: string;
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
  size?: "sm" | "default";
  className?: string;
}) {
  return (
    <Select items={options} value={value} onValueChange={(next) => next != null && onChange(next as T)}>
      <SelectTrigger size={size} aria-label={label} className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
