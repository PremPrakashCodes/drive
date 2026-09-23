"use client";

import {
  Check,
  ChevronDown,
  ChevronUp,
  FileUp,
  Pause,
  Play,
  RotateCcw,
  Upload,
  X,
} from "lucide-react";
import { useQueryState } from "nuqs";
import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useWorkspaceRoute } from "@/components/workspace/route";
import { useWorkspace } from "@/components/workspace/store";
import { createFolderTree } from "@/lib/drive/items";
import { completeUploads, prepareUploads } from "@/lib/drive/uploads";
import { batched } from "@/lib/workspace/batch";
import { formatSize, formatSpeed } from "@/lib/workspace/data";
import { isJunk, pickedEntry, readDrop } from "@/lib/workspace/drop";
import { createUploadQueue } from "@/lib/workspace/queue";
import type { UploadEntry, UploadJob } from "@/types";

const UploadContext = createContext<{
  pick: (folder?: boolean) => void;
  upload: (files: File[]) => void;
} | null>(null);
// Every file needs a presigned URL before and a record after its transfer;
// batching turns a folder's worth of those into a couple of requests.
const prepareUpload = batched(prepareUploads);
const completeUpload = batched(completeUploads);
export const useUpload = () => useContext(UploadContext)!;
export function UploadProvider({ children }: { children: ReactNode }) {
  const { drive } = useWorkspace();
  const { reload } = drive;
  const { page } = useWorkspaceRoute();
  const [folder] = useQueryState("folder");
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const [isPaused, setPaused] = useState(false);
  // Pause and cancellation, made once and kept for as long as this provider
  // is mounted. A pause lasts only as long as the queue it was made for, and
  // the control that shows it follows the queue out.
  const [queue] = useState(() => createUploadQueue({ onDrain: () => setPaused(false) }));
  const requests = useRef(new Map<string, XMLHttpRequest>());
  // Transfers in progress, and whether one saved since the last refresh: the
  // listing reloads once a batch drains rather than once per file.
  const running = useRef(0);
  const saved = useRef(false);
  const setJob = useCallback(
    (id: string, patch: Partial<UploadJob>) =>
      setJobs((j) => j.map((x) => (x.id === id ? { ...x, ...patch } : x))),
    []
  );
  // Browser → bucket through a presigned URL; the server then records the file.
  const send = useCallback(
    async (job: UploadJob) => {
      // Nothing is taken out for a file the queue is holding: a URL minted
      // now would sit unused for however long the pause lasts.
      if (!(await queue.ready(job.id))) return;
      const prepared = await prepareUpload({
        parentId: job.parent,
        type: job.file.type,
        locked: job.locked,
      });
      if (!prepared.ok) throw new Error(prepared.error);
      // Preparing is a round trip, and cancelling during it can't abort a
      // request that hasn't been made. Asking again here is the only thing
      // between a cancelled row and the whole file going up behind it.
      if (queue.cancelled(job.id)) return;
      // The slot for this file's bytes is open, which is where a pause taken
      // while the preparation was in flight holds it — before the first byte,
      // not before the queue starts, which every file passes in one tick.
      if (!(await queue.ready(job.id))) return;
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        requests.current.set(job.id, xhr);
        xhr.open("PUT", prepared.data.url);
        xhr.setRequestHeader("Content-Type", job.file.type || "application/octet-stream");
        let last = -1;
        // Speed is sampled at most every 500ms and smoothed so the readout
        // doesn't jitter between progress events.
        let sampledAt = performance.now();
        let sampledBytes = 0;
        let speed: number | undefined;
        xhr.upload.onprogress = (e) => {
          if (!e.lengthComputable) return;
          const now = performance.now();
          const elapsed = now - sampledAt;
          const sampled = elapsed >= 500;
          if (sampled) {
            const rate = ((e.loaded - sampledBytes) / elapsed) * 1000;
            speed = speed === undefined ? rate : speed * 0.7 + rate * 0.3;
            sampledAt = now;
            sampledBytes = e.loaded;
          }
          const progress = Math.round((e.loaded / e.total) * 95);
          if (progress === last && !sampled) return;
          last = progress;
          setJob(job.id, { progress, speed });
        };
        xhr.onload = () =>
          xhr.status < 300
            ? resolve()
            : reject(new Error(`Storage rejected the upload (${xhr.status}).`));
        xhr.onerror = () =>
          reject(new Error("Couldn't reach storage. Check the bucket's CORS settings."));
        xhr.onabort = () => reject(new Error("Upload cancelled."));
        xhr.send(job.file);
      }).finally(() => requests.current.delete(job.id));
      // Cancelled after the bytes landed but before the row: the object is
      // left for the orphan sweeper rather than recorded as a file.
      if (queue.cancelled(job.id)) return;
      const result = await completeUpload({
        key: prepared.data.key,
        name: job.file.name,
        type: job.file.type,
        parentId: job.parent,
        private: false,
        locked: job.locked,
      });
      if (!result.ok) throw new Error(result.error);
    },
    [queue, setJob]
  );
  const process = useCallback(
    (job: UploadJob) =>
      // Counted as queued from here to wherever it ends, so the pause knows
      // when it has nothing left to hold.
      queue.queued(job.id, async () => {
        setJob(job.id, { status: "uploading", progress: 0, speed: undefined, error: undefined });
        try {
          if (queue.cancelled(job.id)) return;
          running.current++;
          try {
            await send(job);
          } finally {
            running.current--;
          }
          if (queue.cancelled(job.id)) return;
          saved.current = true;
          setJob(job.id, { status: "completed", progress: 100, speed: undefined });
        } catch (error) {
          if (queue.cancelled(job.id)) return;
          const message = error instanceof Error ? error.message : "Could not save to the drive.";
          setJob(job.id, { status: "failed", speed: undefined, error: message });
          toast.error(`Upload failed: ${job.file.name}`, { description: message });
        } finally {
          if (!running.current && saved.current) {
            saved.current = false;
            void reload();
          }
        }
      }),
    [queue, send, setJob, reload]
  );
  const upload = useCallback(
    async (picked: UploadEntry[]) => {
      const entries = picked.filter((e) => !e.dirs.length || !isJunk(e.file.name));
      if (!entries.length) {
        // Something was handed over and none of it can go up. Returning
        // quietly reads as an upload that never registered.
        if (picked.length)
          toast.error("Nothing to upload", {
            description: "Those folders held only system files.",
          });
        return;
      }
      // On the Locked folder page, uploads (and their folders) go straight in.
      const locked = page === "locked";
      // Every folder on the way to a file, parents first, created in one go.
      const folders = [
        ...new Map(
          entries
            .flatMap((e) => e.dirs.map((_, i) => e.dirs.slice(0, i + 1)))
            .map((p) => [p.join("/"), p])
        ).values(),
      ].sort((a, b) => a.length - b.length);
      const ids = new Map<string, string>();
      if (folders.length) {
        const preparing = toast.loading(
          `Creating ${folders.length} ${folders.length === 1 ? "folder" : "folders"}…`
        );
        const created = await createFolderTree({ parentId: folder, folders, locked }).catch(
          () => null
        );
        toast.dismiss(preparing);
        if (!created?.ok) {
          toast.error(created?.error ?? "Couldn't create folders for this upload.");
          return;
        }
        folders.forEach((p, i) => ids.set(p.join("/"), created.data[i]));
      }
      const next: UploadJob[] = entries.map(({ file, dirs }) => ({
        id: crypto.randomUUID(),
        file,
        progress: 0,
        status: "uploading",
        parent: dirs.length ? ids.get(dirs.join("/"))! : folder,
        locked,
      }));
      setJobs((j) => [...j, ...next]);
      setCollapsed(false);
      next.forEach((job) => void process(job));
    },
    [folder, page, process]
  );
  // A dropped folder is walked one directory at a time, which for a deep one
  // takes long enough that a dismissed overlay and nothing else looks like a
  // drop that missed — and invites a second one on top of the first.
  const dropped = useCallback(
    async (data: DataTransfer) => {
      // `readDrop` must take the items before this handler returns: the list
      // empties once the drop event is over.
      const reading = readDrop(data);
      const progress = toast.loading("Reading dropped items…");
      const entries = await reading.catch(() => null);
      toast.dismiss(progress);
      if (!entries) return void toast.error("Couldn't read the dropped items.");
      if (!entries.length)
        return void toast.error("Nothing to upload", {
          description: "There were no files in what you dropped.",
        });
      void upload(entries);
    },
    [upload]
  );
  const context = useMemo(
    () => ({
      pick: (directory?: boolean) => (directory ? folderInput : fileInput).current?.click(),
      upload: (files: File[]) => void upload(files.map(pickedEntry)),
    }),
    [upload]
  );
  const inFlight = jobs.filter((j) => j.status === "uploading");
  const active = inFlight.length;
  const totalSpeed = inFlight.reduce((sum, j) => sum + (j.speed ?? 0), 0);
  return (
    <UploadContext.Provider value={context}>
      <div
        className="contents"
        onDragEnter={(e) => {
          if (e.dataTransfer.types.includes("Files")) {
            e.preventDefault();
            dragDepth.current++;
            setDragging(true);
          }
        }}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("Files")) e.preventDefault();
        }}
        onDragLeave={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          dragDepth.current--;
          if (dragDepth.current <= 0) setDragging(false);
        }}
        onDrop={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setDragging(false);
          dragDepth.current = 0;
          void dropped(e.dataTransfer);
        }}
      >
        {children}
      </div>
      <input
        ref={fileInput}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          void upload(Array.from(e.target.files || [], pickedEntry));
          e.target.value = "";
        }}
      />
      <input
        ref={folderInput}
        type="file"
        multiple
        hidden
        {...{ webkitdirectory: "" }}
        onChange={(e) => {
          void upload(Array.from(e.target.files || [], pickedEntry));
          e.target.value = "";
        }}
      />
      {dragging && (
        <div className="pointer-events-none fixed inset-3.5 z-70 flex flex-col items-center justify-center rounded-[16px] border-2 border-dashed border-primary bg-background/95">
          <Upload className="mb-5 size-11.5 text-primary" />
          <h2 className="text-[27px]">Drop files or folders</h2>
          <p className="mt-3 text-muted-foreground">
            Upload to{" "}
            <strong className="font-medium text-foreground">
              {page === "locked"
                ? "your Locked folder"
                : (folder && drive.listing?.items.find((i) => i.id === folder)?.name) ||
                  drive.listing?.workspace.name ||
                  "My Drive"}
            </strong>
          </p>
          <p className="mt-1.5 text-[12px] text-muted-foreground">Folders keep their structure</p>
        </div>
      )}
      {jobs.length > 0 && (
        <section
          className="fixed right-6 bottom-5.5 z-40 w-87.5 overflow-hidden rounded-[11px] border bg-card shadow-[0_8px_35px_#00000016] max-md:right-3 max-md:bottom-21.25 max-md:w-[min(350px,calc(100vw-24px))]"
          aria-label="Upload progress"
          aria-live="polite"
        >
          <div className="flex items-center gap-2.5 px-3.75 py-3">
            <FileUp className="size-4.5 text-primary" />
            <strong className="flex-1 text-[12px]">
              {active
                ? `Uploading ${active} ${active === 1 ? "file" : "files"}`
                : "Uploads finished"}
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
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? <ChevronUp /> : <ChevronDown />}
            </Button>
            {!active && (
              <Button
                size="icon"
                variant="ghost"
                aria-label="Dismiss uploads"
                onClick={() => setJobs([])}
              >
                <X />
              </Button>
            )}
          </div>
          {!collapsed && (
            <>
              <p className="px-3.75 pb-3 text-[10px] text-muted-foreground">
                Uploading to {drive.listing?.workspace.name ?? "your drive"}
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
                            onClick={() => {
                              queue.restore(j.id);
                              void process(j);
                            }}
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
                            onClick={() => {
                              queue.cancel(j.id);
                              requests.current.get(j.id)?.abort();
                              setJobs((js) =>
                                js.map((x) => (x.id === j.id ? { ...x, status: "cancelled" } : x))
                              );
                            }}
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
                <Button variant="outline" className="m-3" onClick={() => setPaused(queue.toggle())}>
                  {isPaused ? <Play /> : <Pause />}
                  {isPaused ? "Resume" : "Pause"}
                </Button>
              )}
            </>
          )}
        </section>
      )}
    </UploadContext.Provider>
  );
}
