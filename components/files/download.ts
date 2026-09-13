import type { DriveFile } from "@/lib/workspace/data";
import { getFileUrl } from "@/lib/drive/items";
import { getBlob } from "@/lib/workspace/storage";
import { toast } from "sonner";
export async function downloadFile(file: DriveFile) {
  if (file.remote) {
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
    return;
  }
  try {
    const blob = await getBlob(file.id);
    if (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return;
    }
    if (file.content) {
      const url = URL.createObjectURL(
        new Blob([file.content], { type: "text/plain" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = file.kind === "code" ? file.name : `${file.name}.txt`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.info("Downloaded the demo text content");
      return;
    }
    toast.info(
      "This sample has no source file. Upload a file to download its original.",
    );
  } catch {
    toast.error("Unable to download this file.");
  }
}
