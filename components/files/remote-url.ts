import { getFileUrl } from "@/lib/drive/items";

// Signed URLs last 5 minutes; reuse each for 4 so thumbnails and previews
// don't ask the server to sign again on every render.
const cache = new Map<string, { url: Promise<string | undefined>; expires: number }>();

export function inlineUrl(id: string) {
  const hit = cache.get(id);
  if (hit && hit.expires > Date.now()) return hit.url;
  const url = getFileUrl(id, true).then((result) => {
    if (result.ok) return result.data;
    cache.delete(id);
    return undefined;
  });
  cache.set(id, { url, expires: Date.now() + 4 * 60 * 1000 });
  return url;
}
