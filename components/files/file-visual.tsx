"use client";

import type { DriveFile } from "@/lib/workspace/data";
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
  Shapes,
} from "lucide-react";
import Image from "next/image";
import type { RefObject } from "react";
import { useEffect, useRef, useState } from "react";

import { inlineUrl } from "@/components/files/remote-url";
import { getFileSnippet } from "@/lib/drive/items";
import { cn } from "@/lib/utils";
import { getBlob } from "@/lib/workspace/storage";

// Svg sizing uses the `[&_svg]:` form so a consumer's `[&_svg]:size-*` replaces it.
const iconKind: Record<DriveFile["kind"], string> = {
  folder: "text-muted-foreground [&_svg]:h-[30px] [&_svg]:w-[35px] [&_svg]:stroke-1",
  pdf: "text-[#b57660] [&_svg]:size-[17px] [&_svg]:stroke-[1.5]",
  image: "text-[#799381] [&_svg]:size-[17px] [&_svg]:stroke-[1.5]",
  document: "text-[#9c7aa4] [&_svg]:size-[17px] [&_svg]:stroke-[1.5]",
  spreadsheet: "text-[#5e957d] [&_svg]:size-[17px] [&_svg]:stroke-[1.5]",
  video: "text-[#a38b62] [&_svg]:size-[17px] [&_svg]:stroke-[1.5]",
  code: "text-[#7d8795] [&_svg]:size-[17px] [&_svg]:stroke-[1.5]",
  archive: "text-muted-foreground [&_svg]:size-[17px] [&_svg]:stroke-[1.5]",
  audio: "text-muted-foreground [&_svg]:size-[17px] [&_svg]:stroke-[1.5]",
};
const folderColor: Record<string, string> = {
  green: "[&_svg]:fill-folder-green [&_svg]:stroke-folder-green",
  purple: "[&_svg]:fill-folder-purple [&_svg]:stroke-folder-purple",
  amber: "[&_svg]:fill-folder-amber [&_svg]:stroke-folder-amber",
  blue: "[&_svg]:fill-folder-blue [&_svg]:stroke-folder-blue",
};
const art =
  "relative size-full overflow-hidden transition-[scale] duration-300 ease-[ease] group-hover/card:scale-[1.02] group-aria-selected/card:scale-none";
const genericArt = "flex items-center justify-center gap-3.5 bg-sidebar p-[25px]";

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
  if (file.remote || file.provider === "Local demo") {
    if (file.kind === "image") return <ImageThumbnail file={file} />;
    if (file.kind === "video")
      return file.mime === "video/mp2t" ? (
        // Browsers can't decode a .ts frame on their own.
        <div className={art}>
          <Placeholder file={file} />
          <i className="absolute top-1/2 left-1/2 grid size-9 -translate-1/2 place-items-center rounded-full bg-black/45 text-white backdrop-blur-[4px]">
            <Play className="ml-0.5 size-4 fill-current" />
          </i>
        </div>
      ) : (
        <VideoThumbnail file={file} />
      );
    if (file.kind === "pdf") return <PdfThumbnail file={file} />;
    if (file.kind === "code" || file.kind === "spreadsheet") return <TextThumbnail file={file} />;
  }
  if (file.thumbnail === "brand")
    return (
      <div
        className={cn(
          art,
          "flex flex-col justify-between bg-[#e9e7da] px-[21px] py-[17px] text-[#475842] max-[1200px]:p-3.5"
        )}
      >
        <span className="z-1 text-[6px] tracking-[1.1px]">FORM & FIELD®</span>
        <div className="z-1 [font-family:Georgia,serif] text-[26px] leading-[1.08] tracking-[-1.4px] max-[1200px]:text-[23px] max-xs:text-[20px] min-[1600px]:text-[33px]">
          Good things.
          <br />
          By design.
        </div>
        <small className="z-1 text-[4px] tracking-[0.8px]">BRAND GUIDELINES — 2026</small>
        <i className="absolute top-[23px] -right-[23px] h-[160px] w-[110px] rotate-[23deg] rounded-[50%_10%_50%_50%] border border-[#71836660]" />
      </div>
    );
  if (file.thumbnail === "coast")
    return (
      <div className={art}>
        <svg
          className="size-full"
          viewBox="0 0 600 300"
          preserveAspectRatio="xMidYMid slice"
          aria-label="An abstract aerial coastline"
          role="img"
        >
          <defs>
            <linearGradient id="sea" x2="1" y2="1">
              <stop stopColor="#588991" />
              <stop offset="1" stopColor="#abcac6" />
            </linearGradient>
            <filter id="grain">
              <feTurbulence baseFrequency=".09" numOctaves="3" stitchTiles="stitch" />
              <feColorMatrix type="saturate" values="0" />
              <feComponentTransfer>
                <feFuncA type="linear" slope=".13" />
              </feComponentTransfer>
              <feBlend in="SourceGraphic" mode="multiply" />
            </filter>
          </defs>
          <path fill="url(#sea)" d="M0 0h600v300H0z" />
          <path fill="#ecede4" d="M320-20c-65 70-76 101-98 150-18 43-61 89-112 170H600V0Z" />
          <path fill="#ddd0b7" d="M354-20c-72 94-63 103-89 151-27 51-82 121-105 169H600V0Z" />
          <path fill="#778473" d="M530-20c-127 117-93 109-141 161-37 40-52 74-67 159H600V0Z" />
          <path fill="#9ea591" d="M536 0c-108 110-84 114-123 177-27 44-36 70-32 123h219V0Z" />
          <path
            stroke="#d4e5df"
            strokeWidth="6"
            fill="none"
            d="M297-20c-60 70-76 111-98 150-18 43-61 89-112 170"
          />
          <path fill="transparent" filter="url(#grain)" d="M0 0h600v300H0z" />
        </svg>
      </div>
    );
  if (file.thumbnail === "roadmap")
    return (
      <div className={cn(art, "bg-[#eeebf1] px-[13px] py-[19px]")}>
        <div className="w-full -rotate-[5deg] rounded-[3px] border border-[#dedbe1] bg-[#fbfbf9] p-[11px]">
          <strong className="block text-[7px] text-[#41423e]">Small steps. Big things.</strong>
          <span className="text-[3px] text-[#898b86]">PRODUCT ROADMAP · Q4 2026</span>
          <div className="mt-[9px] flex gap-1.5">
            {["Exploring", "In progress", "Coming soon"].map((n, i) => (
              <section key={n} className="flex-1">
                <b className="mb-[5px] block text-[4px] text-[#777c75]">{n}</b>
                {[1, 2, 3].slice(0, i === 2 ? 2 : 3).map((x) => (
                  <div
                    key={x}
                    className={cn(
                      "mb-1 rounded-[2px] p-[5px]",
                      ["bg-[#f0eee7]", "bg-[#e9eee5]", "bg-[#ece7ef]"][i]
                    )}
                  >
                    <i className="mb-1 block h-[3px] w-[40%] bg-[#c1c3b3]" />
                    <em className="mt-0.5 block h-0.5 w-[85%] bg-[#dadbd3]" />
                    <em className="mt-0.5 block h-0.5 w-[85%] bg-[#dadbd3]" />
                  </div>
                ))}
              </section>
            ))}
          </div>
        </div>
        <Shapes className="absolute right-2.5 bottom-[9px] size-[22px] rounded-[5px] bg-white p-1 text-[#837389]" />
      </div>
    );
  if (file.thumbnail === "video")
    return (
      <div className={cn(art, "bg-[#393e32] p-[22px] text-[#e4e5d4] max-[1200px]:p-[18px]")}>
        <div className="absolute top-[23px] -right-[45px] size-[160px] rounded-full border border-[#c6cead3b]" />
        <div className="absolute top-[43px] -right-[26px] size-[160px] rounded-full border border-[#c6cead3b]" />
        <div className="absolute top-0.5 -right-[67px] size-[160px] rounded-full border border-[#c6cead3b]" />
        <span className="relative z-1 [font-family:Georgia,serif] text-[22px] leading-[1.2] max-[1200px]:text-[19px] max-xs:text-[17px]">
          Room for
          <br />
          <em className="font-normal">what&apos;s next.</em>
        </span>
        <i className="absolute bottom-[17px] left-[22px] grid size-[26px] place-items-center rounded-full border border-[#ffffff33] bg-[#ffffff22]">
          <Play className="size-2.5 fill-current" />
        </i>
        <small className="absolute right-3 bottom-3.5 rounded-[2px] bg-[#00000040] px-1 py-0.5 text-[8px]">
          0:32
        </small>
      </div>
    );
  return (
    <div className={cn(art, genericArt)}>
      <FileIcon file={file} className="[&_svg]:size-11" />
      {file.content && (
        <pre className="max-w-[125px] overflow-hidden text-[5px] leading-[1.8] whitespace-pre-wrap text-muted-foreground">
          {file.content.slice(0, 220)}
        </pre>
      )}
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

// A URL for the file's bytes: signed for stored files, a blob URL for demo ones.
function useFileUrl(file: DriveFile, enabled: boolean) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!enabled) return;
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
    ).catch(() => {});
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file.id, file.remote, enabled]);
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
  const url = useFileUrl(file, useSeen(ref));
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
  const url = useFileUrl(file, useSeen(ref));
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
        <i className="absolute top-1/2 left-1/2 grid size-9 -translate-1/2 place-items-center rounded-full bg-black/45 text-white backdrop-blur-[4px]">
          <Play className="ml-0.5 size-4 fill-current" />
        </i>
      )}
    </div>
  );
}

function PdfThumbnail({ file }: { file: DriveFile }) {
  const ref = useRef<HTMLDivElement>(null);
  const url = useFileUrl(file, useSeen(ref));
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
  const [text, setText] = useState(file.content?.slice(0, 1500));
  useEffect(() => {
    if (!seen || text !== undefined) return;
    let active = true;
    (file.remote
      ? getFileSnippet(file.id).then((r) => (r.ok ? r.data : ""))
      : getBlob(file.id).then((blob) => blob?.slice(0, 1500).text() ?? "")
    )
      // Binary spreadsheets (XLSX) have no text to show.
      .then((t) => {
        if (active) setText(t.includes("\u0000") ? "" : t);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [seen, text, file.id, file.remote]);
  return (
    <div ref={ref} className={art}>
      {text ? (
        <div className="h-full bg-sidebar px-[18px] pt-3.5">
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
