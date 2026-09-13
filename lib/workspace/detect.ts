import type { FileKind } from "@/lib/workspace/data";

// What a file is, from its bytes alone. Names and browser-reported types both
// come from the extension, which lies (".ts" is TypeScript and MPEG video).

// Enough for signatures past the start: tar at 257, ZIP entry names, and the
// codec IDs in a WebM header.
export const HEAD_BYTES = 8192;

export type Detected = { kind: Exclude<FileKind, "folder">; mime: string };

export function isTextMime(mime: string) {
  return mime.startsWith("text/") || mime === "application/json";
}

export function detectFile(head: Uint8Array): Detected {
  // One character per byte. (TextDecoder's "latin1" is really windows-1252,
  // which remaps 0x80–0x9F and breaks signatures like PNG's 0x89.)
  let latin = "";
  for (let i = 0; i < head.length; i += 4096)
    latin += String.fromCharCode(...head.subarray(i, i + 4096));
  const at = (offset: number, text: string) =>
    latin.startsWith(text, offset);
  const has = (text: string) => latin.includes(text);
  const utf16 = (text: string) => has(text.split("").join("\0"));

  if (latin.slice(0, 1024).includes("%PDF-"))
    return { kind: "pdf", mime: "application/pdf" };

  // Images browsers can draw.
  if (at(0, "\x89PNG\r\n\x1a\n")) return { kind: "image", mime: "image/png" };
  if (at(0, "\xff\xd8\xff")) return { kind: "image", mime: "image/jpeg" };
  if (at(0, "GIF87a") || at(0, "GIF89a"))
    return { kind: "image", mime: "image/gif" };
  if (at(0, "RIFF") && at(8, "WEBP"))
    return { kind: "image", mime: "image/webp" };
  if (at(0, "BM") && [12, 40, 56, 108, 124].includes(head[14]))
    return { kind: "image", mime: "image/bmp" };
  if (at(0, "\0\0\x01\0")) return { kind: "image", mime: "image/x-icon" };

  // ISO media (MP4, MOV, M4A, AVIF, HEIC): an "ftyp" box naming its brands.
  if (at(4, "ftyp")) {
    const brands = latin.slice(8, Math.min(latin.length, 64));
    if (brands.includes("avif") || brands.includes("avis"))
      return { kind: "image", mime: "image/avif" };
    if (/^(heic|heix|hevc|heim|heis|mif1|msf1)/.test(brands))
      return { kind: "document", mime: "image/heic" };
    if (/^(M4A |M4B |F4A )/.test(brands))
      return { kind: "audio", mime: "audio/mp4" };
    if (brands.startsWith("qt  "))
      return { kind: "video", mime: "video/quicktime" };
    if (brands.startsWith("3g")) return { kind: "video", mime: "video/3gpp" };
    return { kind: "video", mime: "video/mp4" };
  }
  // Matroska/WebM: video if any track has a video codec.
  if (at(0, "\x1a\x45\xdf\xa3")) {
    const webm = has("webm");
    if (has("V_VP8") || has("V_VP9") || has("V_AV1") || has("V_MPEG"))
      return { kind: "video", mime: webm ? "video/webm" : "video/x-matroska" };
    if (has("A_"))
      return { kind: "audio", mime: webm ? "audio/webm" : "audio/x-matroska" };
    return { kind: "video", mime: "video/webm" };
  }
  if (at(0, "OggS"))
    return has("theora")
      ? { kind: "video", mime: "video/ogg" }
      : { kind: "audio", mime: "audio/ogg" };
  if (at(0, "RIFF") && at(8, "WAVE"))
    return { kind: "audio", mime: "audio/wav" };
  if (at(0, "RIFF") && at(8, "AVI "))
    return { kind: "video", mime: "video/x-msvideo" };
  if (at(0, "FLV\x01")) return { kind: "video", mime: "video/x-flv" };
  if (at(0, "\0\0\x01\xba") || at(0, "\0\0\x01\xb3"))
    return { kind: "video", mime: "video/mpeg" };
  // MPEG transport stream: 188-byte packets that each start with 0x47.
  if (syncEvery(head, 0, 188)) return { kind: "video", mime: "video/mp2t" };
  // Blu-ray (M2TS) puts a 4-byte timestamp before each packet.
  if (syncEvery(head, 4, 192))
    return { kind: "video", mime: "video/vnd.dlna.mpeg-tts" };
  if (at(0, "fLaC")) return { kind: "audio", mime: "audio/flac" };
  if (at(0, "ID3")) return { kind: "audio", mime: "audio/mpeg" };
  if (at(0, "#!AMR")) return { kind: "audio", mime: "audio/amr" };

  // ZIP, including the Office and OpenDocument formats built on it.
  if (at(0, "PK\x03\x04") || at(0, "PK\x05\x06")) {
    if (has("mimetypeapplication/vnd.oasis.opendocument.spreadsheet"))
      return {
        kind: "spreadsheet",
        mime: "application/vnd.oasis.opendocument.spreadsheet",
      };
    if (has("mimetypeapplication/vnd.oasis.opendocument."))
      return { kind: "document", mime: "application/vnd.oasis.opendocument" };
    if (has("mimetypeapplication/epub+zip"))
      return { kind: "document", mime: "application/epub+zip" };
    if (has("xl/"))
      return {
        kind: "spreadsheet",
        mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      };
    if (has("word/"))
      return {
        kind: "document",
        mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      };
    if (has("ppt/"))
      return {
        kind: "document",
        mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      };
    return { kind: "archive", mime: "application/zip" };
  }
  if (at(0, "\x1f\x8b")) return { kind: "archive", mime: "application/gzip" };
  if (at(0, "Rar!\x1a\x07"))
    return { kind: "archive", mime: "application/vnd.rar" };
  if (at(0, "7z\xbc\xaf\x27\x1c"))
    return { kind: "archive", mime: "application/x-7z-compressed" };
  if (at(0, "\xfd7zXZ\0")) return { kind: "archive", mime: "application/x-xz" };
  if (at(0, "BZh") && head[3] >= 0x31 && head[3] <= 0x39)
    return { kind: "archive", mime: "application/x-bzip2" };
  if (at(0, "\x28\xb5\x2f\xfd"))
    return { kind: "archive", mime: "application/zstd" };
  if (at(257, "ustar")) return { kind: "archive", mime: "application/x-tar" };

  // Legacy Office files share one container; its stream names tell them apart.
  if (at(0, "\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1")) {
    if (utf16("Workbook") || utf16("Book"))
      return { kind: "spreadsheet", mime: "application/vnd.ms-excel" };
    if (utf16("PowerPoint Document"))
      return { kind: "document", mime: "application/vnd.ms-powerpoint" };
    return { kind: "document", mime: "application/msword" };
  }
  if (at(0, "{\\rtf")) return { kind: "document", mime: "application/rtf" };

  // MPEG audio frames (after JPEG and the UTF-16 check below would be too late:
  // a UTF-16 BOM also starts with 0xFF).
  if (!at(0, "\xff\xfe") && head[0] === 0xff && (head[1] & 0xe0) === 0xe0)
    return (head[1] & 0x06) === 0
      ? { kind: "audio", mime: "audio/aac" }
      : { kind: "audio", mime: "audio/mpeg" };

  const text = decodeText(head);
  if (text !== undefined) return detectText(text, head.length >= HEAD_BYTES);
  return { kind: "document", mime: "application/octet-stream" };
}

function syncEvery(head: Uint8Array, offset: number, size: number) {
  const packets = Math.min(4, Math.floor((head.length - offset) / size));
  if (packets < 2) return false;
  for (let i = 0; i < packets; i++)
    if (head[offset + i * size] !== 0x47) return false;
  return true;
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
          head.subarray(0, head.length - cut),
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
    ((start.startsWith("<?xml") || start.startsWith("<!doctype svg")) &&
      text.includes("<svg"))
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
