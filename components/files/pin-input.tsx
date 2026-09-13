"use client";
import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";

// A masked 6-digit PIN field that only accepts digits.
export function PinInput({
  label,
  value,
  onChange,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
}) {
  const id = useId();
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type="password"
        inputMode="numeric"
        autoComplete="off"
        pattern="\d{6}"
        maxLength={6}
        required
        autoFocus={autoFocus}
        placeholder="••••••"
        className="text-center text-lg tracking-[0.5em]"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
      />
    </Field>
  );
}
