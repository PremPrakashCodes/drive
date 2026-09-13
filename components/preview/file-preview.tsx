"use client";

import type { DriveFile } from "@/lib/workspace/data";
import { ArrowLeft, Download, FileQuestion, Info } from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useQueryState } from "nuqs";
import { useEffect, useState } from "react";

import { downloadFile } from "@/components/files/download";
import { FileIcon, FileVisual } from "@/components/files/file-visual";
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
import { useWorkspaceRoute } from "@/components/workspace/route";
import { useWorkspace } from "@/components/workspace/store";
import { formatSize } from "@/lib/workspace/data";
import { getBlob } from "@/lib/workspace/storage";

// Video.js is large; load it only when a video is opened.
const VideoPlayer = dynamic(
  () => import("@/components/preview/video-player").then((m) => m.VideoPlayer),
  { ssr: false, loading: () => <Skeleton className="video-player" /> }
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
  const { workspace } = useWorkspaceRoute();
  const file = data.files.find((f) => f.id === id && f.workspace === workspace && !f.trashed);
  // Details stay tucked away until asked for via the info button.
  const [info, setInfo] = useState(false);
  return (
    <Dialog
      open={!!id}
      onOpenChange={(o) => {
        if (!o) void setId(null);
      }}
    >
      <DialogContent className="preview-dialog" showCloseButton={false}>
        <DialogHeader className="preview-header">
          <Button variant="ghost" aria-label="Close preview" onClick={() => void setId(null)}>
            <ArrowLeft />
            Back
          </Button>
          <div>
            <DialogTitle>{file?.name || "File not found"}</DialogTitle>
            <DialogDescription>
              {file
                ? `${formatSize(file.size)} · ${file.owner}`
                : "This file is not available in this workspace."}
            </DialogDescription>
          </div>
          <Button
            variant="outline"
            disabled={!file}
            onClick={() => file && void downloadFile(file)}
          >
            <Download />
            Download
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle file information"
            aria-pressed={info}
            onClick={() => setInfo(!info)}
          >
            <Info />
          </Button>
        </DialogHeader>
        <div className="preview-layout">
          <div className="preview-stage">
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
            <aside className="preview-information">
              <h3>File information</h3>
              <FileIcon file={file} />
              <dl className="info-list">
                {Object.entries({
                  Name: file.name,
                  Type: file.kind,
                  Size: formatSize(file.size),
                  Owner: file.owner,
                  Modified: new Date(file.modified).toLocaleDateString("en-US", {
                    dateStyle: "long",
                  }),
                  Storage: file.provider,
                  Access: file.remote
                    ? file.visibility === "private"
                      ? "Only you"
                      : "Everyone in this drive"
                    : file.shared
                      ? "Shared with collaborators"
                      : "Only you",
                }).map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
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
    let objectUrl: string | undefined;
    (file.remote
      ? inlineUrl(file.id).then((remote) => {
          if (remote && active) setUrl(remote);
        })
      : getBlob(file.id).then((blob) => {
          if (blob && active) {
            objectUrl = URL.createObjectURL(blob);
            setUrl(objectUrl);
          }
        })
    )
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file.id, file.remote]);
  if (loading) return <Skeleton className="h-96 w-3/4" />;
  if (url && file.kind === "image")
    return (
      <Image
        src={url}
        alt={file.name}
        width={1600}
        height={1200}
        unoptimized
        className="preview-image"
      />
    );
  if (url && file.kind === "pdf")
    return <iframe src={url} title={file.name} className="pdf-frame" />;
  if (url && file.kind === "video")
    return <VideoPlayer src={url} type={videoType(file)} size={file.size} title={file.name} />;
  if (url && file.kind === "audio") return <audio controls src={url} />;
  if (file.kind === "image" && file.thumbnail)
    return (
      <div className="preview-art">
        <FileVisual file={file} />
      </div>
    );
  if (file.content && file.kind === "spreadsheet")
    return (
      <div className="csv-preview">
        <table>
          <tbody>
            {file.content.split("\n").map((row, i) => (
              <tr key={i}>
                {row
                  .split(",")
                  .map((cell, j) => (i === 0 ? <th key={j}>{cell}</th> : <td key={j}>{cell}</td>))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  if (file.content)
    return (
      <article className={file.kind === "pdf" ? "document-preview" : "code-preview"}>
        {file.kind === "pdf" && <small>SAMPLE DOCUMENT · TEXT PREVIEW</small>}
        <pre>{file.content}</pre>
      </article>
    );
  return (
    <div className="unsupported-preview">
      <FileIcon file={file} />
      <h2>File preview unavailable</h2>
      <p>
        {file.thumbnail
          ? "This demo sample has no source media. Upload a file to preview it."
          : "This format is not supported by the built-in viewer."}
      </p>
      <Button onClick={() => void downloadFile(file)}>
        <Download />
        Download file
      </Button>
    </div>
  );
}
