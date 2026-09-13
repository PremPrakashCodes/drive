"use client";
import { useEffect, useRef, useState, type RefObject } from "react";
import Image from "next/image";
import { getBlob } from "@/lib/workspace/storage";
import { inlineUrl } from "@/components/files/remote-url";
import { getFileSnippet } from "@/lib/drive/items";
import {
  Folder,
  FileText,
  FileCode2,
  FileSpreadsheet,
  FileArchive,
  FileImage,
  FileVideo,
  FileAudio,
  Play,
  Shapes,
} from "lucide-react";
import type { DriveFile } from "@/lib/workspace/data";
export function FileIcon({
  file,
}: {
  file: Pick<DriveFile, "kind" | "color">;
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
    <span className={`file-icon kind-${file.kind} ${file.color || ""}`}>
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
        <div className="file-art thumb-media">
          <Placeholder file={file} />
          <i className="thumb-play">
            <Play />
          </i>
        </div>
      ) : (
        <VideoThumbnail file={file} />
      );
    if (file.kind === "pdf") return <PdfThumbnail file={file} />;
    if (file.kind === "code" || file.kind === "spreadsheet")
      return <TextThumbnail file={file} />;
  }
  if (file.thumbnail === "brand")
    return (
      <div className="file-art brand-art">
        <span>FORM & FIELD®</span>
        <div>
          Good things.
          <br />
          By design.
        </div>
        <small>BRAND GUIDELINES — 2026</small>
        <i />
      </div>
    );
  if (file.thumbnail === "coast")
    return (
      <div className="file-art coast-art">
        <svg
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
              <feTurbulence
                baseFrequency=".09"
                numOctaves="3"
                stitchTiles="stitch"
              />
              <feColorMatrix type="saturate" values="0" />
              <feComponentTransfer>
                <feFuncA type="linear" slope=".13" />
              </feComponentTransfer>
              <feBlend in="SourceGraphic" mode="multiply" />
            </filter>
          </defs>
          <path fill="url(#sea)" d="M0 0h600v300H0z" />
          <path
            fill="#ecede4"
            d="M320-20c-65 70-76 101-98 150-18 43-61 89-112 170H600V0Z"
          />
          <path
            fill="#ddd0b7"
            d="M354-20c-72 94-63 103-89 151-27 51-82 121-105 169H600V0Z"
          />
          <path
            fill="#778473"
            d="M530-20c-127 117-93 109-141 161-37 40-52 74-67 159H600V0Z"
          />
          <path
            fill="#9ea591"
            d="M536 0c-108 110-84 114-123 177-27 44-36 70-32 123h219V0Z"
          />
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
      <div className="file-art roadmap-art">
        <div className="mini-board">
          <strong>Small steps. Big things.</strong>
          <span>PRODUCT ROADMAP · Q4 2026</span>
          <div className="mini-columns">
            {["Exploring", "In progress", "Coming soon"].map((n, i) => (
              <section key={n}>
                <b>{n}</b>
                {[1, 2, 3].slice(0, i === 2 ? 2 : 3).map((x) => (
                  <div key={x}>
                    <i />
                    <em />
                    <em />
                  </div>
                ))}
              </section>
            ))}
          </div>
        </div>
        <Shapes className="figma-badge" />
      </div>
    );
  if (file.thumbnail === "video")
    return (
      <div className="file-art video-art">
        <div className="video-orbit one" />
        <div className="video-orbit two" />
        <div className="video-orbit three" />
        <span>
          Room for
          <br />
          <em>what&apos;s next.</em>
        </span>
        <i className="play-circle">
          <Play />
        </i>
        <small>0:32</small>
      </div>
    );
  return (
    <div className="file-art generic-art">
      <FileIcon file={file} />
      {file.content && <pre>{file.content.slice(0, 220)}</pre>}
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
      { rootMargin: "200px" },
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
    <div className="generic-art h-full">
      <FileIcon file={file} />
    </div>
  );
}

function ImageThumbnail({ file }: { file: DriveFile }) {
  const ref = useRef<HTMLDivElement>(null);
  const url = useFileUrl(file, useSeen(ref));
  return (
    <div ref={ref} className="file-art">
      {url ? (
        <Image
          src={url}
          alt={file.name}
          fill
          unoptimized
          className="object-cover"
        />
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
    <div ref={ref} className="file-art thumb-media">
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
          onLoadedData={() => setReady(true)}
          hidden={!ready}
        />
      )}
      {ready && (
        <i className="thumb-play">
          <Play />
        </i>
      )}
    </div>
  );
}

function PdfThumbnail({ file }: { file: DriveFile }) {
  const ref = useRef<HTMLDivElement>(null);
  const url = useFileUrl(file, useSeen(ref));
  return (
    <div ref={ref} className="file-art thumb-pdf">
      {url ? (
        <iframe
          src={`${url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
          title={`${file.name} first page`}
          tabIndex={-1}
          aria-hidden="true"
          loading="lazy"
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
    <div ref={ref} className="file-art">
      {text ? (
        <div className="thumb-text">
          <pre>{text}</pre>
        </div>
      ) : (
        <Placeholder file={file} />
      )}
    </div>
  );
}
