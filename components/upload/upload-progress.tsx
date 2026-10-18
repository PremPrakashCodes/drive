"use client";

import { Check, ChevronDown, ChevronUp, FileUp, Pause, Play, RotateCcw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatSize, formatSpeed } from "@/lib/workspace/data";
import type { UploadProgressProps } from "@/types";

// Presentation only: the provider retains transfer, pause, cancellation,
// retry, and panel state so extracting it does not change upload lifetimes.
export function UploadProgress({
  jobs,
  workspaceName,
  collapsed,
  isPaused,
  onCollapsedChange,
  onDismiss,
  onRetry,
  onCancel,
  onPause,
}: UploadProgressProps) {
  const inFlight = jobs.filter((j) => j.status === "uploading");
  const active = inFlight.length;
  const totalSpeed = inFlight.reduce((sum, j) => sum + (j.speed ?? 0), 0);
  return (
    <section
      className="fixed right-6 bottom-5.5 z-40 w-87.5 overflow-hidden rounded-[11px] border bg-card shadow-[0_8px_35px_#00000016] max-md:right-3 max-md:bottom-21.25 max-md:w-[min(350px,calc(100vw-24px))]"
      aria-label="Upload progress"
      aria-live="polite"
    >
      <div className="flex items-center gap-2.5 px-3.75 py-3">
        <FileUp className="size-4.5 text-primary" />
        <strong className="flex-1 text-[12px]">
          {active ? `Uploading ${active} ${active === 1 ? "file" : "files"}` : "Uploads finished"}
          {totalSpeed > 0 && (
            <span className="ml-1.5 font-normal text-muted-foreground tabular-nums">
              · {formatSpeed(totalSpeed)}
            </span>
          )}
        </strong>
        <Button
          size="icon"
          variant="ghost"
          aria-label={collapsed ? "Expand uploads" : "Collapse uploads"}
          onClick={() => onCollapsedChange(!collapsed)}
        >
          {collapsed ? <ChevronUp /> : <ChevronDown />}
        </Button>
        {!active && (
          <Button
            size="icon"
            variant="ghost"
            aria-label="Dismiss uploads"
            onClick={() => onDismiss()}
          >
            <X />
          </Button>
        )}
      </div>
      {!collapsed && (
        <>
          <p className="px-3.75 pb-3 text-[10px] text-muted-foreground">
            Uploading to {workspaceName ?? "your drive"}
          </p>
          <div className="max-h-70 overflow-auto">
            {jobs.map((j) => (
              <div className="border-t px-3.75 py-2.75" key={j.id}>
                <div className="mb-2 flex items-center justify-between gap-4 text-[11px]">
                  <span className="truncate">{j.file.name}</span>
                  <span>
                    {j.status === "completed" ? (
                      <Check className="size-4" />
                    ) : j.status === "failed" ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Retry ${j.file.name}`}
                        onClick={() => onRetry(j)}
                      >
                        <RotateCcw />
                      </Button>
                    ) : j.status === "cancelled" ? (
                      "Cancelled"
                    ) : (
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Cancel ${j.file.name}`}
                        onClick={() => onCancel(j.id)}
                      >
                        <X />
                      </Button>
                    )}
                  </span>
                </div>
                <Progress value={j.progress} className="h-1" />
                <small className="mt-1.75 block text-[9px] text-muted-foreground">
                  {j.error ||
                    `${formatSize(j.file.size)} · ${
                      j.status !== "uploading"
                        ? j.status
                        : j.speed !== undefined
                          ? formatSpeed(j.speed)
                          : "Uploading"
                    }`}
                </small>
              </div>
            ))}
          </div>
          {active > 0 && (
            <Button variant="outline" className="m-3" onClick={onPause}>
              {isPaused ? <Play /> : <Pause />}
              {isPaused ? "Resume" : "Pause"}
            </Button>
          )}
        </>
      )}
    </section>
  );
}
