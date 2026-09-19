import type { Detected, FileKind } from "@/types";
import { fileTypeFromBuffer } from "file-type";

// What a file is, from its bytes alone. Names and browser-reported types both
// come from the extension, which lies (".ts" is TypeScript and MPEG video).
//
// `file-type` reads the magic numbers for binary formats. It deliberately
// detects no text formats (CSV, JSON, SVG, source), and it stops at the
// container for a few others, so those are worked out here.

// file-type walks ZIP entries to tell .xlsx/.docx/.odt from a plain archive,
// and the entry naming the format sits past the first few KB in real documents.
export const HEAD_BYTES = 64 * 1024;

export async function detectFile(head: Uint8Array): Promise<Detected> {
  // A file too malformed to parse is still a file: fall through to the text
  // check rather than failing the upload.
  const found = await fileTypeFromBuffer(head).catch(() => undefined);
  if (found) {
    // The legacy Office container; its stream names tell the apps apart.
    if (found.mime === "application/x-cfb") return legacyOffice(head);
    // Matroska holds audio-only files too, which file-type still calls video.
    if (found.mime === "video/matroska" || found.mime === "video/webm")
      return matroska(head, found.mime);
    // An XML declaration hides SVG (and anything else text) behind one mime,
    // so those go on to the text check below.
    if (found.mime !== "application/xml") return { kind: kindOf(found.mime), mime: found.mime };
  }

  const text = decodeText(head);
  if (text !== undefined) {
    const detected = detectText(text, head.length >= HEAD_BYTES);
    // Keep file-type's application/xml unless the text says what the XML is.
    return found && detected.mime === "text/plain" ? { kind: "code", mime: found.mime } : detected;
  }
  return { kind: "document", mime: found?.mime ?? "application/octet-stream" };
}

// Which part of the drive UI a mime belongs to. "code" means the preview pane
// can show it as text, so only text formats land there.
function kindOf(mime: string): Exclude<FileKind, "folder"> {
  if (mime === "application/pdf") return "pdf";
  if (SPREADSHEETS.has(mime)) return "spreadsheet";
  if (ARCHIVES.has(mime)) return "archive";
  if (DRAWABLE.has(mime)) return "image";
  const type = mime.slice(0, mime.indexOf("/"));
  if (type === "video") return "video";
  // Ogg without a video track, plus everything audio/* (which may carry
  // parameters, as audio/ogg does for Opus).
  if (type === "audio" || mime === "application/ogg") return "audio";
  if (type === "text" || mime === "application/json") return "code";
  // Fonts, models, binaries, and images no browser draws (HEIC, TIFF, raw).
  return "document";
}

const SPREADSHEETS = new Set([
  "application/vnd.ms-excel",
  "application/vnd.ms-excel.sheet.macroenabled.12",
  "application/vnd.ms-excel.template.macroenabled.12",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.template",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.oasis.opendocument.spreadsheet-template",
  "application/vnd.apple.numbers",
  "text/csv",
  "text/tab-separated-values",
]);

const ARCHIVES = new Set([
  "application/zip",
  "application/gzip",
  "application/lzip",
  "application/zstd",
  "application/java-archive",
  "application/vnd.android.package-archive",
  "application/vnd.ms-cab-compressed",
  "application/vnd.rar",
  "application/x-7z-compressed",
  "application/x-ace-compressed",
  "application/x-apple-diskimage",
  "application/x-arj",
  "application/x-asar",
  "application/x-bzip2",
  "application/x-compress",
  "application/x-cpio",
  "application/x-deb",
  "application/x-google-chrome-extension",
  "application/x-iso9660-image",
  "application/x-lz4",
  "application/x-lzh-compressed",
  "application/x-rar-compressed",
  "application/x-rpm",
  "application/x-tar",
  "application/x-unix-archive",
  "application/x-xpinstall",
  "application/x-xz",
]);

// Images browsers can draw.
const DRAWABLE = new Set([
  "image/apng",
  "image/avif",
  "image/bmp",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/svg+xml",
  "image/webp",
  "image/x-icon",
]);

// One character per byte. (TextDecoder's "latin1" is really windows-1252,
// which remaps 0x80–0x9F and breaks byte comparisons.)
function latin1(head: Uint8Array) {
  let text = "";
  for (let i = 0; i < head.length; i += 4096)
    text += String.fromCharCode(...head.subarray(i, i + 4096));
  return text;
}

// The legacy Office files share one container, and file-type reports only that.
function legacyOffice(head: Uint8Array): Detected {
  const latin = latin1(head);
  const utf16 = (text: string) => latin.includes(text.split("").join("\0"));
  if (utf16("Workbook") || utf16("Book"))
    return { kind: "spreadsheet", mime: "application/vnd.ms-excel" };
  if (utf16("PowerPoint Document"))
    return { kind: "document", mime: "application/vnd.ms-powerpoint" };
  return { kind: "document", mime: "application/msword" };
}

// Video if any track has a video codec, audio if the tracks are all audio.
function matroska(head: Uint8Array, mime: string): Detected {
  const latin = latin1(head);
  if (/V_(VP8|VP9|AV1|MPEG)/.test(latin) || !latin.includes("A_")) return { kind: "video", mime };
  return { kind: "audio", mime: mime === "video/webm" ? "audio/webm" : "audio/matroska" };
}

// The bytes as text, or undefined if they aren't text.
function decodeText(head: Uint8Array) {
  let text: string | undefined;
  if (head[0] === 0xff && head[1] === 0xfe)
    text = new TextDecoder("utf-16le").decode(head.subarray(2));
  else if (head[0] === 0xfe && head[1] === 0xff)
    text = new TextDecoder("utf-16be").decode(head.subarray(2));
  else
    // The head may end partway through a multi-byte character.
    for (let cut = 0; cut < 4 && text === undefined; cut++)
      try {
        text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(
          head.subarray(0, head.length - cut)
        );
      } catch {}
  if (text === undefined) return undefined;
  let control = 0;
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (code === 0) return undefined;
    if (code < 32 && !"\t\n\r\f\x1b".includes(char)) control++;
  }
  return control > text.length / 100 ? undefined : text;
}

function detectText(text: string, truncated: boolean): Detected {
  const start = text.trimStart().slice(0, 512).toLowerCase();
  if (
    start.startsWith("<svg") ||
    ((start.startsWith("<?xml") || start.startsWith("<!doctype svg")) && text.includes("<svg"))
  )
    return { kind: "image", mime: "image/svg+xml" };
  if (start.startsWith("<!doctype html") || start.startsWith("<html"))
    return { kind: "code", mime: "text/html" };
  const lines = text.split(/\r?\n/);
  // The last line may be cut off by the head, or be the trailing newline.
  if (truncated || lines.at(-1) === "") lines.pop();
  const sample = lines.slice(0, 10);
  if (sample.length >= 2)
    for (const [delimiter, mime] of [
      ["\t", "text/tab-separated-values"],
      [",", "text/csv"],
      [";", "text/csv"],
    ]) {
      const counts = sample.map((l) => fieldsOutsideQuotes(l, delimiter));
      if (counts[0] > 0 && counts.every((c) => c === counts[0]))
        return { kind: "spreadsheet", mime };
    }
  if (!truncated && (start.startsWith("{") || start.startsWith("[")))
    try {
      JSON.parse(text);
      return { kind: "code", mime: "application/json" };
    } catch {}
  return { kind: "code", mime: "text/plain" };
}

function fieldsOutsideQuotes(line: string, delimiter: string) {
  let count = 0;
  let quoted = false;
  for (const char of line) {
    if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) count++;
  }
  return count;
}
