import type {
  ActionResult,
  DriveInvitation,
  DriveListing,
  DriveMember,
  DriveOrganization,
  DriveTeam,
} from "./drive";
import type { DriveFile } from "./files";

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

// Each source can fail independently; a refresh keeps successful data usable.
export type WorkspaceSnapshot = {
  drive: ActionResult<DriveListing>;
  organizations: ActionResult<DriveOrganization[]>;
  invitations: ActionResult<MyInvitation[]>;
};

export type WorkspaceContextValue = {
  data: WorkspaceData & { files: DriveFile[]; teams: DriveTeam[] };
  organization: { overview: OrgOverview | null; reload: () => Promise<void> };
  loaded: boolean;
  user: { name: string; email: string };
  drive: WorkspaceDrive;
};

// The open drive in the workspace store, and how actions refresh it.
export type WorkspaceDrive = {
  listing: DriveListing | null;
  reload: () => Promise<void>;
  // Coordinates cookie switching, navigation, and refresh as one transition.
  navigateWorkspace: (id: string, pathname: string) => Promise<ActionResult>;
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

export type WorkspaceDestination = { id: string; pathname: string };
export type WorkspaceNavigationOptions = {
  organizations: DriveOrganization[];
  listing: DriveListing | null;
  reload: WorkspaceDrive["reload"];
  run: WorkspaceDrive["run"];
};

export type WorkspaceAlignmentInput = {
  org: string | null;
  organizations: Pick<DriveOrganization, "id" | "slug">[];
  listing: {
    workspace: Pick<DriveListing["workspace"], "id" | "kind">;
    spaces: Pick<DriveListing["spaces"][number], "id" | "own">[];
  } | null;
  lastPersonalId?: string | null;
};
