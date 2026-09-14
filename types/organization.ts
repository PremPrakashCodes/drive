import type { DriveInvitation, DriveMember } from "./drive";

// A member row, or a pending invitation shown as "Invited".
export type Invitee =
  (DriveMember & { kind: "member" }) | (DriveInvitation & { kind: "invitation" });
