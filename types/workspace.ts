import type {
  ActionResult,
  DriveInvitation,
  DriveListing,
  DriveMember,
  DriveOrganization,
  DriveTeam,
} from "./drive";

// An organization's overview: the data behind its overview, teams and members pages.
export type OrgOverview = {
  organization: DriveOrganization;
  teams: DriveTeam[];
  members: DriveMember[];
  invitations: DriveInvitation[];
};

// A pending invitation addressed to the signed-in user, from any workspace.
export type MyInvitation = { id: string; organization: string; expiresAt: string };

// Server data the workspace store holds (the open drive's listing lives beside it).
export type WorkspaceData = {
  organizations: DriveOrganization[];
  invitations: MyInvitation[];
};

// The open drive in the workspace store, and how actions refresh it.
export type WorkspaceDrive = {
  listing: DriveListing | null;
  reload: () => Promise<void>;
  // Awaits a server action, toasts its error or `success`, then on success
  // refreshes: the drive by default, or `refresh` (e.g. a page's own data).
  run: <T>(
    pending: Promise<ActionResult<T>>,
    success?: string,
    refresh?: () => Promise<void>
  ) => Promise<ActionResult<T>>;
};

// What a run over several items came to (`lib/workspace/outcome.ts`):
// everything applied, nothing did, or some of each — and the one line that
// says so. A `partial` is a failure to report, never a success.
export type BatchOutcome = {
  kind: "applied" | "partial" | "failed";
  applied: string[];
  failed: { name: string; error: string }[];
  message: string;
};

// Tells an in-flight load whether it is still the newest one
// (`lib/workspace/freshness.ts`).
export type Freshness = {
  begin: () => number;
  isCurrent: (token: number) => boolean;
  cancel: () => void;
};
