import { parseAsInteger, parseAsString, parseAsStringLiteral } from "nuqs";

export const metaDot = "size-0.75 shrink-0 rounded-full bg-current opacity-50";
export const toolbarButton = "text-[11px] md:text-[12px] max-md:min-h-9";
export const viewToggleItem =
  "h-6.75 w-7.5 rounded-lg! border-0 text-muted-foreground shadow-none focus-visible:ring-0 data-pressed:bg-background data-pressed:text-foreground data-pressed:shadow-[0_1px_3px_#0000000d] max-md:min-h-9";
export const cardAction =
  "size-7.5 rounded-[8px] text-muted-foreground group-hover/card:text-foreground data-popup-open:text-foreground max-md:min-h-9 max-md:min-w-9";

export const sortLabels = { modified: "Last modified", name: "Name", size: "File size" } as const;

export const parsers = {
  folder: parseAsString,
  search: parseAsString.withDefault(""),
  view: parseAsStringLiteral(["grid", "list"]).withDefault("grid"),
  sort: parseAsStringLiteral(["modified", "name", "size"]).withDefault("modified"),
  direction: parseAsStringLiteral(["asc", "desc"]).withDefault("desc"),
  type: parseAsString.withDefault("all"),
  owner: parseAsString.withDefault("all"),
  modified: parseAsStringLiteral(["all", "today", "week", "month"]).withDefault("all"),
  preview: parseAsString,
  page: parseAsInteger.withDefault(1),
};
