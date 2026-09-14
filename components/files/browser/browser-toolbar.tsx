"use client";

import {
  ArrowDownWideNarrow,
  ChevronDown,
  LayoutGrid,
  List,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Choice } from "@/components/workspace/common";
import { sortLabels, toolbarButton, viewToggleItem } from "./constants";
import type { FileBrowserState } from "./use-file-browser";

// Search, sort, view toggle, and the collapsible filter row.
export function BrowserToolbar({
  browser: { title, query, setQuery, filters, setFilters, owners },
}: {
  browser: FileBrowserState;
}) {
  return (
    <>
      <div className="mb-6.25 flex items-center gap-2.5 border-b pb-5.75 max-[1000px]:gap-1.75 max-md:mb-5.5 max-md:flex-wrap max-md:gap-y-3 max-md:pb-4.5">
        <div className="flex w-63.75 items-center gap-2 rounded-[7px] border bg-background pl-2.75 text-muted-foreground focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring max-[1000px]:w-52.5 max-md:w-[calc(100%-85px)]">
          <Search className="size-4" />
          <Input
            className="h-8.25 rounded-[7px] border-0 bg-transparent py-2 pr-2 pl-0 text-[11px] shadow-none focus-visible:shadow-none focus-visible:ring-0 focus-visible:outline-none md:text-[12px] dark:bg-transparent"
            aria-label="Search files"
            placeholder={`Search ${title.toLowerCase()}…`}
            value={query.search}
            onChange={(e) =>
              void setQuery({ search: e.target.value, page: 1 }, { history: "replace" })
            }
          />
          {query.search && (
            <Button
              variant="ghost"
              size="icon"
              className={toolbarButton}
              aria-label="Clear search"
              onClick={() => void setQuery({ search: "" })}
            >
              <X />
            </Button>
          )}
        </div>
        <Button
          variant={filters ? "secondary" : "outline"}
          className={toolbarButton}
          onClick={() => setFilters(!filters)}
        >
          <SlidersHorizontal />
          Filters
          {(query.type !== "all" || query.owner !== "all") && (
            <span className="size-1.25 rounded-full bg-primary" />
          )}
        </Button>
        <div className="flex-1" />
        <DropdownMenu>
          {/* data-slot="dropdown-menu-trigger" here, so the toolbar font size never applied. */}
          <DropdownMenuTrigger
            render={<Button variant="ghost" className="max-md:ml-auto max-md:min-h-9" />}
          >
            <ArrowDownWideNarrow />
            <span className="max-[1000px]:hidden">{sortLabels[query.sort]}</span>
            <ChevronDown />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-44">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Sort by</DropdownMenuLabel>
              {(Object.keys(sortLabels) as (keyof typeof sortLabels)[]).map((s) => (
                <DropdownMenuItem key={s} onClick={() => void setQuery({ sort: s })}>
                  {sortLabels[s]}
                  {query.sort === s && " ✓"}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() =>
                  void setQuery({
                    direction: query.direction === "asc" ? "desc" : "asc",
                  })
                }
              >
                {query.direction === "asc" ? "Ascending ↑" : "Descending ↓"}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <ToggleGroup
          value={[query.layout]}
          onValueChange={(v) => {
            if (v[0]) void setQuery({ layout: v[0] as "grid" | "list" });
          }}
          variant="outline"
          className="gap-0.5 rounded-[6px] bg-muted p-0.75"
        >
          <ToggleGroupItem value="grid" aria-label="Grid view" className={viewToggleItem}>
            <LayoutGrid />
          </ToggleGroupItem>
          <ToggleGroupItem value="list" aria-label="List view" className={viewToggleItem}>
            <List />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      {filters && (
        <div className="flex flex-wrap gap-2.25 pb-5">
          <Choice
            label="File type"
            value={query.type}
            onChange={(type) => void setQuery({ type, page: 1 })}
            options={[
              { label: "All types", value: "all" },
              ...[
                "folder",
                "image",
                "pdf",
                "video",
                "code",
                "document",
                "spreadsheet",
                "audio",
                "archive",
              ].map((value) => ({
                value,
                label: value[0].toUpperCase() + value.slice(1),
              })),
            ]}
          />
          <Choice
            label="Owner"
            value={query.owner}
            onChange={(owner) => void setQuery({ owner, page: 1 })}
            options={[
              { label: "All owners", value: "all" },
              ...owners.map((owner) => ({
                label: owner,
                value: owner,
              })),
            ]}
          />
          <Choice
            label="Modified"
            value={query.modified}
            onChange={(modified) =>
              void setQuery({ modified: modified as "all" | "today" | "week" | "month", page: 1 })
            }
            options={[
              { label: "Any time", value: "all" },
              { label: "Today", value: "today" },
              { label: "This week", value: "week" },
              { label: "This month", value: "month" },
            ]}
          />
          <Button
            variant="ghost"
            onClick={() => void setQuery({ type: "all", owner: "all", modified: "all" })}
          >
            Clear filters
          </Button>
        </div>
      )}
    </>
  );
}
