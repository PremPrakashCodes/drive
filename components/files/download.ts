import type { DriveFile } from "@/types";
import { toast } from "sonner";

import { getFileUrl } from "@/lib/drive/uploads";

export async function downloadFile(file: DriveFile) {
  // The signed URL carries `Content-Disposition: attachment`.
  const result = await getFileUrl(file.id);
  if (!result.ok) {
    toast.error(result.error);
    return;
  }
  const a = document.createElement("a");
  a.href = result.data;
  a.rel = "noopener";
  a.click();
}
