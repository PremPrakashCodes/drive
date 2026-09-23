import type { DriveFile } from "@/types";

// Trashed items are permanently deleted by the daily cron after this long.
export const TRASH_RETENTION_DAYS = 30;
export function formatSize(size: number) {
  return size < 1000
    ? `${size} B`
    : size < 1000000
      ? `${(size / 1000).toFixed(1)} KB`
      : size < 1000000000
        ? `${(size / 1000000).toFixed(1)} MB`
        : `${(size / 1000000000).toFixed(1)} GB`;
}
// A transfer rate (bytes/second) in MB/s, matching formatSize's decimal units.
export function formatSpeed(bytesPerSecond: number) {
  const mb = bytesPerSecond / 1000000;
  return `${mb.toFixed(mb < 10 ? 2 : 1)} MB/s`;
}

// Who can open a file, as shown in its info panels.
export const accessLabel = (file: Pick<DriveFile, "visibility">) =>
  file.visibility === "private" ? "Only you" : "Everyone in this drive";
