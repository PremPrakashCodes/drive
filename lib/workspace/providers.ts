import type { DriveListing } from "@/types";

export const storageProviders = [
  {
    id: "s3",
    name: "Amazon S3",
    icon: "aws",
    description: "Flexible object storage, built to scale.",
  },
  {
    id: "r2",
    name: "Cloudflare R2",
    icon: "cloudflare",
    description: "Object storage without egress fees.",
  },
  {
    id: "gcs",
    name: "Google Cloud Storage",
    icon: "gcp",
    description: "Reliable storage on Google infrastructure.",
  },
  {
    id: "azure",
    name: "Azure Blob Storage",
    icon: "azure",
    description: "Cloud storage for your Microsoft ecosystem.",
  },
] as const;
export type StorageProvider = (typeof storageProviders)[number];

// The open drive's storage connection with its catalog entry, or null when none.
export function activeStorage(storage: DriveListing["storage"] | undefined) {
  if (!storage?.connected) return null;
  return {
    provider: storageProviders.find((p) => p.id === storage.provider) ?? storageProviders[0],
    bucket: storage.bucket,
    region: storage.region ?? storage.endpoint ?? "",
  };
}
