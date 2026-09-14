import type { DateInput, MaybeDate } from "@/types";
import { compareAsc, differenceInSeconds, format, isValid, parseISO } from "date-fns";

/** Normalizes any DateInput to a Date; invalid/missing values become undefined. */
export function toDate(value: DateInput): MaybeDate {
  if (value === null || value === undefined) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return isValid(date) ? date : undefined;
}

/**
 * Parses an ISO 8601 string with fallback for other inputs.
 * Use this instead of `new Date(string)` — it returns undefined
 * instead of an Invalid Date for garbage input.
 */
export function parseDate(value: DateInput): MaybeDate {
  if (typeof value !== "string") return toDate(value);
  return toDate(parseISO(value));
}

// --- Formatting -------------------------------------------------------------
// The app renders "en-US" short dates everywhere (file tables, invitations,
// audit log), so these presets keep every surface consistent.

/** "Sep 14" — file tables, member/invitation lists, notifications. */
export function formatShortDate(value: DateInput): string {
  const date = parseDate(value);
  return date ? format(date, "MMM d") : "—";
}

/** "Sep 14, 2026" — joined dates, credentials with a year. */
export function formatMediumDate(value: DateInput): string {
  const date = parseDate(value);
  return date ? format(date, "MMM d, yyyy") : "—";
}

/** "September 14, 2026" — long-form surfaces like preview details. */
export function formatLongDate(value: DateInput): string {
  const date = parseDate(value);
  return date ? format(date, "MMMM d, yyyy") : "—";
}

/** "Sep 14, 2:05 PM" — audit log entries. */
export function formatDateTime(value: DateInput): string {
  const date = parseDate(value);
  return date ? format(date, "MMM d, h:mm a") : "—";
}

/** "Sep 14, 2026, 2:05 PM" — full date + time, e.g. file info dialogs. */
export function formatFullTimestamp(value: DateInput): string {
  const date = parseDate(value);
  return date ? format(date, "MMM d, yyyy, h:mm a") : "—";
}

// --- Relative time ----------------------------------------------------------

/** "in 30 seconds" / "in 5 minutes" — expiry countdowns (rounds up). */
export function formatInAbout(value: DateInput): string {
  const date = parseDate(value);
  if (!date) return "in 1 second";
  const seconds = Math.max(1, differenceInSeconds(date, new Date(), { roundingMethod: "ceil" }));
  if (seconds < 60) return `in ${seconds} second${seconds === 1 ? "" : "s"}`;
  const minutes = Math.ceil(seconds / 60);
  return `in ${minutes} minute${minutes === 1 ? "" : "s"}`;
}

// --- Comparisons ------------------------------------------------------------

/** Chronological sort comparator over DateInput (nullish sorts last). */
export function compareByDate(a: DateInput, b: DateInput): number {
  const da = parseDate(a);
  const db = parseDate(b);
  if (!da && !db) return 0;
  if (!da) return 1;
  if (!db) return -1;
  return compareAsc(da, db);
}

/** True when `value` is strictly before `other` (missing values are never before). */
export function isDateBefore(value: DateInput, other: DateInput): boolean {
  const a = parseDate(value);
  const b = parseDate(other);
  return a !== undefined && b !== undefined && a < b;
}

/** True when `value` is strictly after `other` (missing values are never after). */
export function isDateAfter(value: DateInput, other: DateInput): boolean {
  const a = parseDate(value);
  const b = parseDate(other);
  return a !== undefined && b !== undefined && a > b;
}

/** True when `value` is on or after `other` (missing values are never on/after). */
export function isDateOnOrAfter(value: DateInput, other: DateInput): boolean {
  const a = parseDate(value);
  const b = parseDate(other);
  return a !== undefined && b !== undefined && a >= b;
}

/** True when the date exists and is in the past. */
export function isDatePast(value: DateInput): boolean {
  return isDateBefore(value, new Date());
}
