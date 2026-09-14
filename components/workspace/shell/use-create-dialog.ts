"use client";

import { useRouter } from "next/navigation";
import { useQueryState } from "nuqs";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { orgPath, useWorkspaceRoute } from "@/components/workspace/route";
import { useWorkspace } from "@/components/workspace/store";
import { splitEmails } from "@/lib/auth-form";
import { createFolder as createDriveFolder, switchSpace } from "@/lib/drive/items";
import { checkOrganizationSlug, createOrganizationAction, inviteMembers } from "@/lib/drive/org";
import { OrgSlug, slugify } from "@/lib/workspace/org-slug";

// State and handlers for the shell's create dialog: a new folder, or the
// three-step organization wizard (name + URL, team emails, first team).
export function useCreateDialog() {
  const { data, drive } = useWorkspace();
  const { page } = useWorkspaceRoute();
  const router = useRouter();
  const [folder] = useQueryState("folder", { history: "push" });
  const [modal, setModal] = useState<"folder" | "organization" | null>(null);
  const [name, setName] = useState("");
  const [privateFolder, setPrivateFolder] = useState(false);
  const [step, setStep] = useState(1);
  const [emails, setEmails] = useState("");
  const [teamName, setTeamName] = useState("Engineering");
  const [creating, setCreating] = useState(false);
  // The organization's URL follows its name until the user edits it.
  const [customSlug, setCustomSlug] = useState<string | null>(null);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);
  const slug = customSlug ?? slugify(name);
  const currentFolder = data.files.find((f) => f.id === folder);
  // FileActions' "New folder" item opens this shell's folder dialog.
  useEffect(() => {
    function newFolder() {
      setName("");
      setModal("folder");
    }
    window.addEventListener("drive:new-folder", newFolder);
    return () => window.removeEventListener("drive:new-folder", newFolder);
  }, []);
  const parentPrivate = currentFolder?.visibility === "private";
  async function createFolder() {
    if (!name.trim()) return;
    const result = await drive.run(
      createDriveFolder({
        name: name.trim(),
        parentId: folder,
        private: privateFolder,
        locked: page === "locked",
      }),
      "Folder created"
    );
    if (!result.ok) return;
    setModal(null);
    setName("");
    setPrivateFolder(false);
  }
  async function createOrganization() {
    if (creating) return;
    setCreating(true);
    try {
      const result = await createOrganizationAction({
        name: name.trim(),
        slug,
        teamName: teamName.trim() || undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      // Open the new organization's drive (switch the server-side space).
      if (result.data.id !== drive.listing?.workspace.id) await switchSpace(result.data.id);
      // The wizard's optional team emails become real invitations.
      const list = splitEmails(emails);
      if (list.length) await inviteMembers(result.data.slug, { emails, role: "member" });
      await drive.reload();
      setModal(null);
      setStep(1);
      setName("");
      setCustomSlug(null);
      setEmails("");
      router.push(orgPath(result.data.slug));
      toast.success("Organization created");
    } finally {
      setCreating(false);
    }
  }
  // Step 1 → 2 only with a valid organization URL that's still free.
  async function continueFromName() {
    const parsed = OrgSlug.safeParse(slug);
    if (!parsed.success) {
      setSlugError(parsed.error.issues[0]?.message ?? "Choose a different URL.");
      return;
    }
    setCheckingSlug(true);
    const result = await checkOrganizationSlug(parsed.data);
    setCheckingSlug(false);
    if (!result.ok) setSlugError(result.error);
    else if (!result.data) setSlugError("That URL is already taken. Choose another.");
    else {
      setSlugError(null);
      setStep(2);
    }
  }
  function openOrganization() {
    setName("");
    setCustomSlug(null);
    setSlugError(null);
    setModal("organization");
  }
  return {
    page,
    modal,
    setModal,
    name,
    setName,
    privateFolder,
    setPrivateFolder,
    parentPrivate,
    step,
    setStep,
    emails,
    setEmails,
    teamName,
    setTeamName,
    creating,
    slug,
    setCustomSlug,
    slugError,
    setSlugError,
    checkingSlug,
    createFolder,
    createOrganization,
    continueFromName,
    openOrganization,
  };
}
