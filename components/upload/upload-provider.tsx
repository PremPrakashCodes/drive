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
import { createFolder } from "@/lib/drive/items";
import { completeUpload, prepareUpload } from "@/lib/drive/uploads";
import { formatSize } from "@/lib/workspace/data";
import type { UploadJob } from "@/types";

const UploadContext = createContext<{
  pick: (folder?: boolean) => void;
  upload: (files: File[]) => void;
} | null>(null);
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
  const paused = useRef(false);
  const [isPaused, setPaused] = useState(false);
  const cancelled = useRef(new Set<string>());
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
      const prepared = await prepareUpload({
        parentId: job.parent,
        type: job.file.type,
        locked: job.locked,
      });
      if (!prepared.ok) throw new Error(prepared.error);
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        requests.current.set(job.id, xhr);
        xhr.open("PUT", prepared.data.url);
        xhr.setRequestHeader("Content-Type", job.file.type || "application/octet-stream");
        let last = -1;
        xhr.upload.onprogress = (e) => {
          if (!e.lengthComputable) return;
          const progress = Math.round((e.loaded / e.total) * 95);
          if (progress === last) return;
          last = progress;
          setJob(job.id, { progress });
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
      if (cancelled.current.has(job.id)) return;
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
    [setJob]
  );
  const process = useCallback(
    async (job: UploadJob) => {
      setJob(job.id, { status: "uploading", progress: 0, error: undefined });
      try {
        // Pause holds uploads that haven't started; running transfers finish.
        while (paused.current && !cancelled.current.has(job.id))
          await new Promise((r) => setTimeout(r, 200));
        if (cancelled.current.has(job.id)) return;
        running.current++;
        try {
          await send(job);
        } finally {
          running.current--;
        }
        if (cancelled.current.has(job.id)) return;
        saved.current = true;
        setJob(job.id, { status: "completed", progress: 100 });
      } catch (error) {
        if (cancelled.current.has(job.id)) return;
        const message = error instanceof Error ? error.message : "Could not save to the drive.";
        setJob(job.id, { status: "failed", error: message });
        toast.error(`Upload failed: ${job.file.name}`, { description: message });
      } finally {
        if (!running.current && saved.current) {
          saved.current = false;
          void reload();
        }
      }
    },
    [send, setJob, reload]
  );
  const upload = useCallback(
    async (files: File[]) => {
      // On the Locked folder page, uploads (and their folders) go straight in.
      const locked = page === "locked";
      const paths = new Map<string, string>();
      const next: UploadJob[] = [];
      try {
        for (const file of files) {
          let parent = folder;
          let path = "";
          for (const name of file.webkitRelativePath.split("/").slice(0, -1)) {
            path += "/" + name;
            let id = paths.get(path);
            if (!id) {
              const created = await createFolder({
                name,
                parentId: parent,
                private: false,
                locked,
              });
              if (!created.ok) throw new Error(created.error);
              id = created.data;
              paths.set(path, id);
            }
            parent = id;
          }
          next.push({
            id: crypto.randomUUID(),
            file,
            progress: 0,
            status: "uploading",
            parent,
            locked,
          });
        }
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Couldn't create folders for this upload."
        );
        void reload();
        return;
      }
      setJobs((j) => [...j, ...next]);
      setCollapsed(false);
      next.forEach((job) => void process(job));
    },
    [folder, page, process, reload]
  );
  const context = useMemo(
    () => ({
      pick: (directory?: boolean) => (directory ? folderInput : fileInput).current?.click(),
      upload: (files: File[]) => void upload(files),
    }),
    [upload]
  );
  const active = jobs.filter((j) => j.status === "uploading").length;
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
        onDragLeave={() => {
          dragDepth.current--;
          if (dragDepth.current <= 0) setDragging(false);
        }}
        onDrop={(e) => {
          if (!e.dataTransfer.files.length) return;
          e.preventDefault();
          setDragging(false);
          dragDepth.current = 0;
          void upload(Array.from(e.dataTransfer.files));
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
          void upload(Array.from(e.target.files || []));
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
          void upload(Array.from(e.target.files || []));
          e.target.value = "";
        }}
      />
      {dragging && (
        <div className="pointer-events-none fixed inset-3.5 z-70 flex flex-col items-center justify-center rounded-[16px] border-2 border-dashed border-primary bg-background/95">
          <Upload className="mb-5 size-[46px] text-primary" />
          <h2 className="text-[27px]">Drop files here</h2>
          <p className="mt-3 text-muted-foreground">
            Upload to {page === "locked" ? "your Locked folder" : folder || "My Drive"}
          </p>
        </div>
      )}
      {jobs.length > 0 && (
        <section
          className="fixed right-6 bottom-[22px] z-40 w-[350px] overflow-hidden rounded-[11px] border bg-card shadow-[0_8px_35px_#00000016] max-md:right-3 max-md:bottom-[85px] max-md:w-[min(350px,calc(100vw-24px))]"
          aria-label="Upload progress"
          aria-live="polite"
        >
          <div className="flex items-center gap-2.5 px-[15px] py-3">
            <FileUp className="size-[18px] text-primary" />
            <strong className="flex-1 text-[12px]">
              {active
                ? `Uploading ${active} ${active === 1 ? "file" : "files"}`
                : "Uploads finished"}
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
              <p className="px-[15px] pb-3 text-[10px] text-muted-foreground">
                Uploading to {drive.listing?.workspace.name ?? "your drive"}
              </p>
              <div className="max-h-[280px] overflow-auto">
                {jobs.map((j) => (
                  <div className="border-t px-[15px] py-[11px]" key={j.id}>
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
                              cancelled.current.delete(j.id);
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
                              cancelled.current.add(j.id);
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
                    <small className="mt-[7px] block text-[9px] text-muted-foreground">
                      {j.error ||
                        `${formatSize(j.file.size)} · ${
                          j.status === "uploading" ? "Uploading" : j.status
                        }`}
                    </small>
                  </div>
                ))}
              </div>
              {active > 0 && (
                <Button
                  variant="outline"
                  className="m-3"
                  onClick={() => {
                    paused.current = !paused.current;
                    setPaused(paused.current);
                  }}
                >
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
