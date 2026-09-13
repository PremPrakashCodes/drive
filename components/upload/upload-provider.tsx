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
import { createContext, useContext, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useWorkspaceRoute } from "@/components/workspace/route";
import { useWorkspace } from "@/components/workspace/store";
import { completeUpload, createFolder, prepareUpload } from "@/lib/drive/items";
import { formatSize } from "@/lib/workspace/data";

type Job = {
  id: string;
  file: File;
  progress: number;
  status: "uploading" | "completed" | "failed" | "cancelled";
  error?: string;
  parent: string | null;
  workspace: string;
  team?: string;
  // Upload to the drive's bucket rather than this device.
  remote: boolean;
  // Into the Locked folder; fixed when queued, so navigating away mid-upload
  // can't change where the file lands.
  locked: boolean;
};
const UploadContext = createContext<{
  pick: (folder?: boolean) => void;
  upload: (files: File[]) => void;
} | null>(null);
export const useUpload = () => useContext(UploadContext)!;
export function UploadProvider({ children }: { children: ReactNode }) {
  const { drive } = useWorkspace();
  const { workspace, team, page } = useWorkspaceRoute();
  const [folder] = useQueryState("folder");
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const paused = useRef(false);
  const [isPaused, setPaused] = useState(false);
  const cancelled = useRef(new Set<string>());
  const requests = useRef(new Map<string, XMLHttpRequest>());
  const setProgress = (id: string, progress: number) =>
    setJobs((j) => j.map((x) => (x.id === id ? { ...x, progress } : x)));
  // Browser → bucket through a presigned URL; the server then records the file.
  async function send(job: Job) {
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
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgress(job.id, Math.round((e.loaded / e.total) * 95));
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
    const saved = await completeUpload({
      key: prepared.data.key,
      name: job.file.name,
      type: job.file.type,
      parentId: job.parent,
      private: false,
      locked: job.locked,
    });
    if (!saved.ok) throw new Error(saved.error);
  }
  async function process(job: Job) {
    setJobs((j) =>
      j.map((x) =>
        x.id === job.id ? { ...x, status: "uploading", progress: 0, error: undefined } : x
      )
    );
    try {
      // Pause holds uploads that haven't started; running transfers finish.
      while (paused.current && !cancelled.current.has(job.id))
        await new Promise((r) => setTimeout(r, 200));
      if (cancelled.current.has(job.id)) return;
      await send(job);
      if (cancelled.current.has(job.id)) return;
      await drive.reload();
      setJobs((j) =>
        j.map((x) => (x.id === job.id ? { ...x, status: "completed", progress: 100 } : x))
      );
    } catch (error) {
      if (cancelled.current.has(job.id)) return;
      const message = error instanceof Error ? error.message : "Could not save to the drive.";
      setJobs((j) =>
        j.map((x) => (x.id === job.id ? { ...x, status: "failed", error: message } : x))
      );
      toast.error(`Upload failed: ${job.file.name}`, { description: message });
    }
  }
  async function upload(files: File[]) {
    const remote = drive.active;
    // On the Locked folder page, uploads (and their folders) go straight in.
    const locked = remote && page === "locked";
    const paths = new Map<string, string>();
    const next: Job[] = [];
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
          workspace,
          team,
          remote,
          locked,
        });
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't create folders for this upload."
      );
      if (remote) void drive.reload();
      return;
    }
    setJobs((j) => [...j, ...next]);
    setCollapsed(false);
    next.forEach((job) => void process(job));
  }
  const active = jobs.filter((j) => j.status === "uploading").length;
  return (
    <UploadContext.Provider
      value={{
        pick: (folder) => (folder ? folderInput.current?.click() : fileInput.current?.click()),
        upload: (files) => void upload(files),
      }}
    >
      <div
        className="workspace-drop-root"
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
        <div className="drop-overlay">
          <Upload />
          <h2>Drop files here</h2>
          <p>
            Upload to{" "}
            {drive.active && page === "locked" ? "your Locked folder" : folder || "My Drive"}
          </p>
        </div>
      )}
      {jobs.length > 0 && (
        <section className="upload-panel" aria-label="Upload progress" aria-live="polite">
          <div className="upload-heading">
            <FileUp />
            <strong>
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
              <p className="upload-note">
                {drive.active
                  ? `Uploading to ${drive.listing?.workspace.name ?? "your drive"}`
                  : "Demo · files are saved on this device"}
              </p>
              <div className="upload-items">
                {jobs.map((j) => (
                  <div className="upload-item" key={j.id}>
                    <div>
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
                    <Progress value={j.progress} />
                    <small>
                      {j.error ||
                        `${formatSize(j.file.size)} · ${
                          j.status === "uploading"
                            ? j.remote
                              ? "Uploading"
                              : "Saving locally"
                            : j.status
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
