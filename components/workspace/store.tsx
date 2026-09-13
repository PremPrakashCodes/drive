"use client";

import type { ActionResult, DriveListing } from "@/lib/drive/types";
import type { DriveFile, Member, Team } from "@/lib/workspace/data";
import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { getDrive } from "@/lib/drive/items";
import {
  initialFiles,
  initialMembers,
  initialOrganizations,
  initialTeams,
} from "@/lib/workspace/data";
import { detectFile, HEAD_BYTES, isTextMime } from "@/lib/workspace/detect";
import { getBlob } from "@/lib/workspace/storage";
import { useWorkspaceRoute } from "./route";

type Data = {
  files: DriveFile[];
  teams: Team[];
  members: Member[];
  organizations: typeof initialOrganizations;
  preferences: Record<string, string | boolean>;
  events: { id: string; action: string; resource: string; date: string }[];
};
const initial: Data = {
  files: initialFiles,
  teams: initialTeams,
  members: initialMembers,
  organizations: initialOrganizations,
  preferences: {},
  events: [
    {
      id: "1",
      action: "file.created",
      resource: "Brand guidelines.pdf",
      date: "2026-09-13T09:40:00",
    },
    {
      id: "2",
      action: "file.shared",
      resource: "Product roadmap.fig",
      date: "2026-09-12T17:30:00",
    },
    {
      id: "3",
      action: "team.created",
      resource: "Engineering",
      date: "2026-09-12T10:00:00",
    },
  ],
};
type Drive = {
  // True when the open workspace is served by the database rather than the
  // local demo store (signed in, personal workspace).
  active: boolean;
  listing: DriveListing | null;
  reload: () => Promise<void>;
  // Awaits a server action, toasts its error or `success`, reloads on success.
  run: <T>(pending: Promise<ActionResult<T>>, success?: string) => Promise<ActionResult<T>>;
};
const Store = createContext<{
  data: Data;
  update: (fn: (data: Data) => Data) => void;
  loaded: boolean;
  user: { name: string; email: string };
  log: (action: string, resource: string) => void;
  drive: Drive;
} | null>(null);
function toDriveFiles(listing: DriveListing): DriveFile[] {
  const provider = !listing.storage.connected
    ? "No storage connected"
    : listing.storage.provider === "r2"
      ? "Cloudflare R2"
      : "Amazon S3";
  return listing.items.map((i) => ({
    id: i.id,
    name: i.name,
    kind: i.kind,
    size: i.size,
    modified: i.updatedAt,
    owner: i.createdByName,
    ownerId: i.createdById,
    parent: i.parentId,
    workspace: "personal",
    starred: i.starred,
    // "Shared with me": what other people added for everyone.
    shared: i.visibility === "shared" && i.createdById !== listing.workspace.userId,
    trashed: i.trashedAt !== null,
    deletedAt: i.trashedAt ?? undefined,
    provider,
    color: i.color ?? undefined,
    mime: i.mimeType ?? undefined,
    visibility: i.visibility,
    canEdit: i.canEdit,
    locked: i.locked,
    remote: true,
  }));
}
export function WorkspaceProvider({
  children,
  user,
  remote = false,
}: {
  children: ReactNode;
  user: { name: string; email: string };
  remote?: boolean;
}) {
  const [data, setData] = useState(initial);
  const [loaded, setLoaded] = useState(false);
  const [listing, setListing] = useState<DriveListing | null>(null);
  const { workspace } = useWorkspaceRoute();
  const active = remote && workspace === "personal";
  const storageKey = `drive-demo-v2:${user.email}`;
  // Hydrate browser-only persistence after SSR; the initial skeleton prevents a mismatch.
  /* eslint-disable react-hooks/set-state-in-effect -- Browser persistence must hydrate after SSR. */
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const saved: Data = { ...initial, ...JSON.parse(stored) };
        setData(saved);
        void redetect(saved.files).then((changes) => {
          if (changes.size)
            setData((d) => ({
              ...d,
              files: d.files.map((f) => ({ ...f, ...changes.get(f.id) })),
            }));
        });
      }
    } catch {
      toast.error("Could not load saved demo data.");
    }
    setLoaded(true);
  }, [storageKey]);
  /* eslint-enable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (loaded) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(data));
      } catch {
        toast.error("Device storage is full. Your changes may not be saved.");
      }
    }
  }, [data, loaded, storageKey]);
  const reload = useCallback(async () => {
    const result = await getDrive();
    if (result.ok) setListing(result.data);
    else toast.error(result.error);
  }, []);
  // Other family members change the drive too: refresh when the tab returns.
  /* eslint-disable react-hooks/set-state-in-effect -- Loads server data after mount; state is set once the request resolves. */
  useEffect(() => {
    if (!remote) return;
    void reload();
    const refresh = () => {
      if (document.visibilityState === "visible") void reload();
    };
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, [remote, reload]);
  /* eslint-enable react-hooks/set-state-in-effect */
  // Relock on screen once the Locked folder has been idle past its window.
  // Timed from the server's remaining ms, so client clock skew can't matter.
  const expiresIn = listing?.lockedFolder.expiresIn;
  useEffect(() => {
    if (expiresIn == null) return;
    const timer = setTimeout(() => void reload(), expiresIn + 1000);
    return () => clearTimeout(timer);
  }, [listing, expiresIn, reload]);
  const run = useCallback(
    async <T,>(pending: Promise<ActionResult<T>>, success?: string) => {
      const result = await pending;
      if (!result.ok) toast.error(result.error);
      else {
        if (success) toast.success(success);
        await reload();
      }
      return result;
    },
    [reload]
  );
  const files = useMemo(
    () =>
      remote
        ? [
            ...data.files.filter((f) => f.workspace !== "personal"),
            ...(listing ? toDriveFiles(listing) : []),
          ]
        : data.files,
    [remote, data.files, listing]
  );
  const theme = data.preferences.theme;
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    // An explicit light/dark choice wins; otherwise follow the device.
    const apply = () =>
      document.documentElement.classList.toggle(
        "dark",
        theme === "dark" || (theme !== "light" && media.matches)
      );
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  return (
    <Store.Provider
      value={{
        data: remote ? { ...data, files } : data,
        update: setData,
        loaded: loaded && (!active || listing !== null),
        user,
        drive: { active, listing, reload, run },
        log: (action, resource) =>
          setData((d) => ({
            ...d,
            events: [
              {
                id: crypto.randomUUID(),
                action,
                resource,
                date: new Date().toISOString(),
              },
              ...d.events,
            ],
          })),
      }}
    >
      {children}
    </Store.Provider>
  );
}
export function useWorkspace() {
  const context = useContext(Store);
  if (!context) throw new Error("WorkspaceProvider is required");
  return context;
}

// Demo uploads saved when types came from file names: detect them again from
// their stored bytes, so a ".ts" video isn't left as code.
async function redetect(files: DriveFile[]) {
  const changes = new Map<string, Partial<DriveFile>>();
  for (const file of files) {
    if (file.provider !== "Local demo" || file.kind === "folder") continue;
    const blob = await getBlob(file.id).catch(() => undefined);
    if (!blob) continue;
    const { kind, mime } = detectFile(
      new Uint8Array(await blob.slice(0, HEAD_BYTES).arrayBuffer())
    );
    if (kind === file.kind && mime === file.mime) continue;
    changes.set(file.id, {
      kind,
      mime,
      content: isTextMime(mime)
        ? (file.content ?? (blob.size < 2000000 ? await blob.text() : undefined))
        : undefined,
    });
  }
  return changes;
}
