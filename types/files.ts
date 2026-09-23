export type FileKind =
  "folder" | "pdf" | "image" | "video" | "code" | "document" | "spreadsheet" | "archive" | "audio";
export type DriveFile = {
  id: string;
  name: string;
  kind: FileKind;
  size: number;
  modified: string;
  owner: string;
  parent: string | null;
  starred?: boolean;
  shared?: boolean;
  trashed?: boolean;
  deletedAt?: string;
  provider: string;
  color?: string;
  mime?: string;
  ownerId?: string;
  visibility?: "shared" | "private";
  canEdit?: boolean;
  // In the signed-in person's Locked folder: shown only on that page.
  locked?: boolean;
};

// The file dialog open in the browser, and the files it acts on.
export type BrowserDialog = { kind: string; files: DriveFile[] };

// `mobile` styles the plain Button; `desktop` the dropdown trigger, which
// renders with data-slot="dropdown-menu-trigger" instead of "button".
export type MenuClasses = { mobile?: string; desktop?: string };

// A file chosen for upload, with the folders (outermost first) it sat in
// when a whole folder was picked or dropped.
export type UploadEntry = { file: File; dirs: string[] };

// One file in the upload queue.
export type UploadJob = {
  id: string;
  file: File;
  progress: number;
  // Smoothed transfer rate in bytes/second while the file is in flight.
  speed?: number;
  status: "uploading" | "completed" | "failed" | "cancelled";
  error?: string;
  parent: string | null;
  // Into the Locked folder; fixed when queued, so navigating away mid-upload
  // can't change where the file lands.
  locked: boolean;
};

// What a file is, sniffed from its first bytes.
export type Detected = { kind: Exclude<FileKind, "folder">; mime: string };
