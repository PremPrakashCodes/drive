"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/workspace/common";
import { FileGrid } from "./file-grid";
import { FileTable } from "./file-table";
import type { FileBrowserState } from "./use-file-browser";

// The files section: heading, empty state or list/grid view, and pagination.
export function FileSection({ browser }: { browser: FileBrowserState }) {
  const { screen, query, setQuery, files, documents, pageCount, pageNumber, clearOnBackground } =
    browser;
  return (
    <section className="min-w-0" onClick={clearOnBackground}>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="flex items-center gap-[9px] text-[13px] font-[550] md:text-[14px]">
          {screen === "trash"
            ? "Deleted files"
            : query.search
              ? "Search results"
              : screen === "recent"
                ? "Recently opened"
                : query.folder
                  ? "Files"
                  : "All files"}{" "}
          <span className="text-[10px] font-normal text-muted-foreground">
            {(screen === "trash" ? files.length : documents.length).toString().padStart(2, "0")}
          </span>
        </h2>
        <span className="text-[11px] text-muted-foreground max-md:hidden">
          {screen === "trash" ? "Restore or remove permanently" : "A home for your work"}
        </span>
      </div>
      {files.length === 0 ? (
        <EmptyState
          title={
            query.search
              ? "No matching files"
              : screen === "locked"
                ? "Nothing hidden yet"
                : screen === "starred"
                  ? "Nothing starred"
                  : screen === "trash"
                    ? "Your trash is empty"
                    : query.folder
                      ? "This folder is a fresh start"
                      : "No files here yet"
          }
          description={
            query.search
              ? "Try a different search or clear your filters."
              : screen === "locked"
                ? "Upload files, create a folder, or choose “Move to Locked folder” on any file you added."
                : screen === "starred"
                  ? "Star a file or folder to find it here."
                  : screen === "trash"
                    ? "Items you delete will show up here."
                    : "Upload a file or create a folder to get started."
          }
        >
          {(query.search || screen !== "trash") && (
            <Button
              onClick={() =>
                query.search
                  ? void setQuery({
                      search: "",
                      type: "all",
                      owner: "all",
                      modified: "all",
                    })
                  : window.dispatchEvent(new Event("drive:new-folder"))
              }
            >
              {query.search ? "Clear search" : "New folder"}
            </Button>
          )}
        </EmptyState>
      ) : query.view === "list" || screen === "trash" ? (
        <FileTable browser={browser} />
      ) : (
        <FileGrid browser={browser} />
      )}
      {pageCount > 1 && (
        <div className="mt-[25px] flex items-center justify-center gap-[18px] text-[12px]">
          <Button
            variant="outline"
            disabled={pageNumber === 1}
            onClick={() => void setQuery({ page: pageNumber - 1 })}
          >
            <ChevronLeft />
            Previous
          </Button>
          <span>
            Page {pageNumber} of {pageCount}
          </span>
          <Button
            variant="outline"
            disabled={pageNumber === pageCount}
            onClick={() => void setQuery({ page: pageNumber + 1 })}
          >
            Next
            <ChevronRight />
          </Button>
        </div>
      )}
    </section>
  );
}
