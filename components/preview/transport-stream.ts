// Browsers can't play a raw MPEG transport stream, but Video.js's HLS engine
// can: it transmuxes TS to MP4 itself. So a .ts file is described as an HLS
// playlist whose segments are byte ranges of the one file.

const PACKET = 188;
// About 4 MB per segment, on packet boundaries.
const SEGMENT = PACKET * 21_000;
const PROBE = PACKET * 5_000;
const WRAP = 2 ** 33;

async function range(src: string, start: number, end: number) {
  const res = await fetch(src, { headers: { Range: `bytes=${start}-${end}` } });
  if (!res.ok) throw new Error(`Couldn't read the video (${res.status}).`);
  return new Uint8Array(await res.arrayBuffer());
}

// Presentation timestamps (90 kHz) of audio/video packets that start a PES.
function timestamps(bytes: Uint8Array) {
  const times: number[] = [];
  let i = bytes.indexOf(0x47);
  for (; i >= 0 && i + PACKET <= bytes.length; i += PACKET) {
    if (bytes[i] !== 0x47) {
      // Lost sync: skip ahead to the next sync byte.
      const next = bytes.indexOf(0x47, i + 1);
      if (next < 0) break;
      i = next - PACKET;
      continue;
    }
    if (!(bytes[i + 1] & 0x40)) continue; // no payload start
    const control = (bytes[i + 3] >> 4) & 3;
    if (!(control & 1)) continue; // no payload
    const o = i + 4 + (control & 2 ? 1 + bytes[i + 4] : 0);
    if (o + 14 > i + PACKET) continue;
    if (bytes[o] !== 0 || bytes[o + 1] !== 0 || bytes[o + 2] !== 1) continue;
    const stream = bytes[o + 3];
    const media = (stream & 0xe0) === 0xc0 || (stream & 0xf0) === 0xe0;
    if (!media || !(bytes[o + 7] & 0x80)) continue;
    times.push(
      (bytes[o + 9] & 0x0e) * 2 ** 29 +
        bytes[o + 10] * 2 ** 22 +
        (bytes[o + 11] & 0xfe) * 2 ** 14 +
        bytes[o + 12] * 2 ** 7 +
        (bytes[o + 13] >> 1)
    );
  }
  return times;
}

// Duration in seconds from the first and last timestamps, if both are found.
async function probeDuration(src: string, size: number) {
  const head = await range(src, 0, Math.min(size, PROBE) - 1);
  const tailStart = Math.max(0, Math.floor((size - PROBE) / PACKET) * PACKET);
  const tail = await range(src, tailStart, size - 1);
  const first = Math.min(...timestamps(head));
  let last = Math.max(...timestamps(tail));
  if (!Number.isFinite(first) || !Number.isFinite(last)) return undefined;
  if (last < first) last += WRAP;
  const seconds = (last - first) / 90_000;
  return seconds > 0 ? seconds : undefined;
}

// A blob URL for an HLS playlist of `src`; revoke it when done.
export async function transportStreamPlaylist(src: string, size: number) {
  // Without timestamps, assume a typical ~8 Mbps stream.
  const duration =
    (await probeDuration(src, size).catch(() => undefined)) ?? (size * 8) / 8_000_000;
  const lines: string[] = [];
  let longest = 1;
  for (let offset = 0; offset < size; offset += SEGMENT) {
    const length = Math.min(SEGMENT, size - offset);
    const seconds = (duration * length) / size;
    longest = Math.max(longest, seconds);
    lines.push(`#EXTINF:${seconds.toFixed(3)},`, `#EXT-X-BYTERANGE:${length}@${offset}`, src);
  }
  const playlist = [
    "#EXTM3U",
    "#EXT-X-VERSION:4",
    `#EXT-X-TARGETDURATION:${Math.ceil(longest)}`,
    "#EXT-X-MEDIA-SEQUENCE:0",
    "#EXT-X-PLAYLIST-TYPE:VOD",
    ...lines,
    "#EXT-X-ENDLIST",
  ].join("\n");
  return URL.createObjectURL(new Blob([playlist], { type: "application/x-mpegURL" }));
}
