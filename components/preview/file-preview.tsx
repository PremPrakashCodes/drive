"use client";

import type { DriveFile } from "@/types";
import { ArrowLeft, Download, FileQuestion, Info } from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useQueryState } from "nuqs";
import { useEffect, useState } from "react";

import { downloadFile } from "@/components/files/download";
import { FileIcon } from "@/components/files/file-visual";
import { inlineUrl } from "@/components/files/remote-url";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspace } from "@/components/workspace/store";
import { formatLongDate } from "@/lib/date";
import { accessLabel, formatSize } from "@/lib/workspace/data";

// Video.js is large; load it only when a video is opened.
const VideoPlayer = dynamic(
  () => import("@/components/preview/video-player").then((m) => m.VideoPlayer),
  {
    ssr: false,
    loading: () => (
      <Skeleton className="h-full w-full max-w-[1200px] overflow-hidden rounded-[12px] bg-black" />
    ),
  }
);
// Video.js picks a playback tech from the type (detected from the file's
// bytes at upload); blob URLs don't carry one.
function videoType(file: DriveFile) {
  // QuickTime is usually H.264 inside; browsers play it when told it's MP4.
  if (file.mime === "video/quicktime") return "video/mp4";
  return file.mime?.startsWith("video/") ? file.mime : "video/mp4";
}
export function FilePreview() {
  const [id, setId] = useQueryState("preview", { history: "push" });
  const { data } = useWorkspace();
  const file = data.files.find((f) => f.id === id && !f.trashed);
  // Details stay tucked away until asked for via the info button.
  const [info, setInfo] = useState(false);
  return (
    <Dialog
      open={!!id}
      onOpenChange={(o) => {
        if (!o) void setId(null);
      }}
    >
      <DialogContent
        className="flex h-[calc(100svh-48px)] w-[calc(100vw-48px)] max-w-[1500px]! flex-col gap-0 p-0 max-md:h-svh max-md:max-h-[100svh]! max-md:w-screen max-md:rounded-none"
        showCloseButton={false}
      >
        <DialogHeader className="flex-row items-center gap-[18px] border-b px-[22px] py-4 max-md:gap-2 max-md:p-3">
          <Button
            variant="ghost"
            aria-label="Close preview"
            className="max-md:p-1.5 max-md:text-[10px]"
            onClick={() => void setId(null)}
          >
            <ArrowLeft />
            Back
          </Button>
          <div className="flex-1">
            <DialogTitle className="text-[14px] max-md:max-w-[140px] max-md:overflow-hidden max-md:text-[11px] max-md:text-ellipsis">
              {file?.name || "File not found"}
            </DialogTitle>
            <DialogDescription className="mt-1 text-[11px] max-md:text-[9px]">
              {file
                ? `${formatSize(file.size)} · ${file.owner}`
                : "This file is not available in this workspace."}
            </DialogDescription>
          </div>
          <Button
            variant="outline"
            className="max-md:p-1.5 max-md:text-[10px]"
            disabled={!file}
            onClick={() => file && void downloadFile(file)}
          >
            <Download />
            Download
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="max-md:p-1.5 max-md:text-[10px]"
            aria-label="Toggle file information"
            aria-pressed={info}
            onClick={() => setInfo(!info)}
          >
            <Info />
          </Button>
        </DialogHeader>
        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 items-center justify-center overflow-auto bg-muted p-[35px] max-md:p-[15px]">
            {file ? (
              <PreviewContent key={file.id} file={file} />
            ) : (
              <div className="text-center">
                <FileQuestion className="mx-auto mb-3 size-12" />
                <p>Check the link or return to your files.</p>
              </div>
            )}
          </div>
          {info && file && (
            <aside className="w-[260px] overflow-y-auto border-l p-6 max-md:hidden">
              <h3 className="mb-6 text-[13px] font-semibold">File information</h3>
              <FileIcon file={file} className="mb-6" />
              <dl className="flex flex-col gap-4 text-[12px]">
                {Object.entries({
                  Name: file.name,
                  Type: file.kind,
                  Size: formatSize(file.size),
                  Owner: file.owner,
                  Modified: formatLongDate(file.modified),
                  Storage: file.provider,
                  Access: accessLabel(file),
                }).map(([k, v]) => (
                  <div key={k} className="flex flex-col justify-between gap-[5px]">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="text-left wrap-break-word">{v}</dd>
                  </div>
                ))}
              </dl>
            </aside>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
function PreviewContent({ file }: { file: DriveFile }) {
  const [url, setUrl] = useState<string>();
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    inlineUrl(file.id)
      .then((remote) => {
        if (remote && active) setUrl(remote);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [file.id]);
  if (loading) return <Skeleton className="h-96 w-3/4" />;
  if (url && file.kind === "image")
    return (
      <Image
        src={url}
        alt={file.name}
        width={1600}
        height={1200}
        unoptimized
        className="max-h-full max-w-full object-contain"
      />
    );
  if (url && file.kind === "pdf")
    return <iframe src={url} title={file.name} className="h-full w-full border-0" />;
  if (url && file.kind === "video")
    return <VideoPlayer src={url} type={videoType(file)} size={file.size} title={file.name} />;
  if (url && file.kind === "audio") return <audio controls src={url} />;
  return (
    <div className="flex flex-col items-center gap-[17px] text-center">
      <FileIcon file={file} className="[&_svg]:size-16" />
      <h2 className="text-[18px]">File preview unavailable</h2>
      <p className="max-w-[310px] text-[12px] text-muted-foreground">
        This format is not supported by the built-in viewer.
      </p>
      <Button onClick={() => void downloadFile(file)}>
        <Download />
        Download file
      </Button>
    </div>
  );
}
