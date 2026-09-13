import type { DriveItemKind, DriveItemVisibility } from "@/db/schema/enums";

// Server actions return errors as values: thrown errors are masked in production.
export type ActionResult<T = void> =
  { ok: true; data: T } | { ok: false; error: string };

export type DriveEntry = {
  id: string;
  name: string;
  kind: DriveItemKind;
  size: number;
  mimeType: string | null;
  parentId: string | null;
  visibility: DriveItemVisibility;
  color: string | null;
  createdById: string;
  createdByName: string;
  starred: boolean;
  canEdit: boolean;
  // In your Locked folder (only listed while it's unlocked).
  locked: boolean;
  trashedAt: string | null;
  updatedAt: string;
};

export type DriveSpace = { id: string; name: string; own: boolean };

// Your Locked folder in the open space. While it's unlocked, `expiresIn` is
// how many ms it stays open without activity; null while locked.
export type LockedFolder = { hasPin: boolean; expiresIn: number | null };

export type DriveListing = {
  workspace: DriveSpace & { role: "owner" | "member"; userId: string };
  lockedFolder: LockedFolder;
  spaces: DriveSpace[];
  items: DriveEntry[];
  storage:
    | { connected: false }
    | {
        connected: true;
        provider: string;
        bucket: string;
        region: string | null;
        endpoint: string | null;
      };
};

export type FamilyMember = {
  id: string; // membership id
  userId: string;
  name: string;
  email: string;
  role: "owner" | "member";
  joinedAt: string;
  you: boolean;
};

export type FamilyInvitation = { id: string; email: string; expiresAt: string };

export type Family = {
  workspace: DriveSpace & { role: "owner" | "member" };
  members: FamilyMember[];
  invitations: FamilyInvitation[];
};
