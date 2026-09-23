import { parseAsInteger, parseAsString, parseAsStringLiteral } from "nuqs";

export const metaDot = "size-0.75 shrink-0 rounded-full bg-current opacity-50";
export const toolbarButton = "text-[11px] md:text-[12px] max-md:min-h-9";
export const viewToggleItem =
  "h-6.75 w-7.5 rounded-lg! border-0 text-muted-foreground shadow-none focus-visible:ring-0 data-pressed:bg-background data-pressed:text-foreground data-pressed:shadow-[0_1px_3px_#0000000d] max-md:min-h-9";
export const cardAction =
  "size-7.5 rounded-[8px] text-muted-foreground group-hover/card:text-foreground data-popup-open:text-foreground max-md:min-h-9 max-md:min-w-9";

export const sortLabels = { modified: "Last modified", name: "Name", size: "File size" } as const;

// Where a person is, as opposed to how they are looking at it. Opening a
// folder or a preview is somewhere to come back from, so it belongs in the
// history; narrowing a list is not, so it replaces. The role lives on the
// parser rather than on the hook because a single update often touches both
// (opening a folder also clears the search): nuqs reads `parser.history`
// first, merges the batch into one URL write, and pushes it if any parameter
// in it asked for a push. One press of Back then leaves a filtered view.
const navigation = { history: "push" } as const;

export const parsers = {
  folder: parseAsString.withOptions(navigation),
  view: parseAsString.withOptions(navigation),
  search: parseAsString.withDefault(""),
  layout: parseAsStringLiteral(["grid", "list"]).withDefault("grid"),
  sort: parseAsStringLiteral(["modified", "name", "size"]).withDefault("modified"),
  direction: parseAsStringLiteral(["asc", "desc"]).withDefault("desc"),
  type: parseAsString.withDefault("all"),
  owner: parseAsString.withDefault("all"),
  modified: parseAsStringLiteral(["all", "today", "week", "month"]).withDefault("all"),
  page: parseAsInteger.withDefault(1),
};
