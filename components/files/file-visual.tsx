"use client";

import type { DriveFile } from "@/types";
import {
  FileArchive,
  FileAudio,
  FileCode2,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Folder,
  Play,
} from "lucide-react";
import Image from "next/image";
import type { RefObject } from "react";
import { useEffect, useRef, useState } from "react";

import { inlineUrl } from "@/components/files/remote-url";
import { getFileSnippet } from "@/lib/drive/uploads";
import { cn } from "@/lib/utils";

// Svg sizing uses the `[&_svg]:` form so a consumer's `[&_svg]:size-*` replaces it.
const iconKind: Record<DriveFile["kind"], string> = {
  folder: "text-muted-foreground [&_svg]:h-7.5 [&_svg]:w-8.75 [&_svg]:stroke-1",
  pdf: "text-[#b57660] [&_svg]:size-4.25 [&_svg]:stroke-[1.5]",
  image: "text-[#799381] [&_svg]:size-4.25 [&_svg]:stroke-[1.5]",
  document: "text-[#9c7aa4] [&_svg]:size-4.25 [&_svg]:stroke-[1.5]",
  spreadsheet: "text-[#5e957d] [&_svg]:size-4.25 [&_svg]:stroke-[1.5]",
  video: "text-[#a38b62] [&_svg]:size-4.25 [&_svg]:stroke-[1.5]",
  code: "text-[#7d8795] [&_svg]:size-4.25 [&_svg]:stroke-[1.5]",
  archive: "text-muted-foreground [&_svg]:size-4.25 [&_svg]:stroke-[1.5]",
  audio: "text-muted-foreground [&_svg]:size-4.25 [&_svg]:stroke-[1.5]",
};
const folderColor: Record<string, string> = {
  green: "[&_svg]:fill-folder-green [&_svg]:stroke-folder-green",
  purple: "[&_svg]:fill-folder-purple [&_svg]:stroke-folder-purple",
  amber: "[&_svg]:fill-folder-amber [&_svg]:stroke-folder-amber",
  blue: "[&_svg]:fill-folder-blue [&_svg]:stroke-folder-blue",
};
const art =
  "relative size-full overflow-hidden transition-[scale] duration-300 ease-[ease] group-hover/card:scale-[1.02] group-aria-selected/card:scale-none";
const genericArt = "flex items-center justify-center gap-3.5 bg-sidebar p-6.25";

export function FileIcon({
  file,
  className,
}: {
  file: Pick<DriveFile, "kind" | "color">;
  className?: string;
}) {
  const Icon = {
    folder: Folder,
    pdf: FileText,
    image: FileImage,
    video: FileVideo,
    code: FileCode2,
    document: FileText,
    spreadsheet: FileSpreadsheet,
    archive: FileArchive,
    audio: FileAudio,
  }[file.kind];
  return (
    <span
      data-kind={file.kind}
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        iconKind[file.kind],
        file.kind === "folder" && (folderColor[file.color ?? ""] ?? folderColor.green),
        className
      )}
    >
      <Icon />
    </span>
  );
}
export function FileVisual({ file }: { file: DriveFile }) {
  if (file.kind === "image") return <ImageThumbnail file={file} />;
  if (file.kind === "video")
    return file.mime === "video/mp2t" ? (
      // Browsers can't decode a .ts frame on their own.
      <div className={art}>
        <Placeholder file={file} />
        <i className="absolute top-1/2 left-1/2 grid size-9 -translate-1/2 place-items-center rounded-full bg-black/45 text-white backdrop-blur-xs">
          <Play className="ml-0.5 size-4 fill-current" />
        </i>
      </div>
    ) : (
      <VideoThumbnail file={file} />
    );
  if (file.kind === "pdf") return <PdfThumbnail file={file} />;
  if (file.kind === "code" || file.kind === "spreadsheet") return <TextThumbnail file={file} />;
  return (
    <div className={cn(art, genericArt)}>
      <FileIcon file={file} className="[&_svg]:size-11" />
    </div>
  );
}

// True once the element has come near the viewport, so cards further down
// don't sign URLs or load media until they're scrolled to.
function useSeen(ref: RefObject<Element | null>) {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setSeen(true);
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, seen]);
  return seen;
}

// A signed URL for the file's bytes, requested once `enabled`.
function useFileUrl(id: string, enabled: boolean) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    inlineUrl(id)
      .then((remote) => {
        if (remote && active) setUrl(remote);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [id, enabled]);
  return url;
}

function Placeholder({ file }: { file: DriveFile }) {
  return (
    <div className={cn(genericArt, "h-full")}>
      <FileIcon file={file} className="[&_svg]:size-11" />
    </div>
  );
}

function ImageThumbnail({ file }: { file: DriveFile }) {
  const ref = useRef<HTMLDivElement>(null);
  const url = useFileUrl(file.id, useSeen(ref));
  return (
    <div ref={ref} className={art}>
      {url ? (
        <Image src={url} alt={file.name} fill unoptimized className="object-cover" />
      ) : (
        <Placeholder file={file} />
      )}
    </div>
  );
}

function VideoThumbnail({ file }: { file: DriveFile }) {
  const ref = useRef<HTMLDivElement>(null);
  const url = useFileUrl(file.id, useSeen(ref));
  const [ready, setReady] = useState(false);
  return (
    <div ref={ref} className={art}>
      {!ready && <Placeholder file={file} />}
      {url && (
        // Seeking a little past the start gives a frame instead of black.
        <video
          src={`${url}#t=0.5`}
          preload="metadata"
          muted
          playsInline
          tabIndex={-1}
          aria-hidden="true"
          className="absolute inset-0 size-full bg-black object-cover"
          onLoadedData={() => setReady(true)}
          hidden={!ready}
        />
      )}
      {ready && (
        <i className="absolute top-1/2 left-1/2 grid size-9 -translate-1/2 place-items-center rounded-full bg-black/45 text-white backdrop-blur-xs">
          <Play className="ml-0.5 size-4 fill-current" />
        </i>
      )}
    </div>
  );
}

function PdfThumbnail({ file }: { file: DriveFile }) {
  const ref = useRef<HTMLDivElement>(null);
  const url = useFileUrl(file.id, useSeen(ref));
  return (
    <div ref={ref} className={cn(art, "bg-sidebar")}>
      {url ? (
        <iframe
          src={`${url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
          title={`${file.name} first page`}
          tabIndex={-1}
          aria-hidden="true"
          loading="lazy"
          className="pointer-events-none absolute inset-0 h-[400%] w-[calc(100%+20px)] border-0 bg-white"
        />
      ) : (
        <Placeholder file={file} />
      )}
    </div>
  );
}

function TextThumbnail({ file }: { file: DriveFile }) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useSeen(ref);
  const [text, setText] = useState<string>();
  useEffect(() => {
    if (!seen || text !== undefined) return;
    let active = true;
    getFileSnippet(file.id)
      .then((r) => (r.ok ? r.data : ""))
      // Binary spreadsheets (XLSX) have no text to show.
      .then((t) => {
        if (active) setText(t.includes("\u0000") ? "" : t);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [seen, text, file.id]);
  return (
    <div ref={ref} className={art}>
      {text ? (
        <div className="h-full bg-sidebar px-4.5 pt-3.5">
          <pre className="h-full overflow-hidden rounded-t-[6px] bg-card px-3 py-2.5 text-[7px] leading-[1.6] break-all whitespace-pre-wrap text-muted-foreground shadow-[0_0_0_1px_var(--border)]">
            {text}
          </pre>
        </div>
      ) : (
        <Placeholder file={file} />
      )}
    </div>
  );
}
