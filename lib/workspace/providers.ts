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
type Preferences = Record<string, string | boolean>;

// Each personal or organization workspace is backed by exactly one provider.
export function getActiveProvider(preferences: Preferences, workspace: string) {
  const id =
    preferences[`${workspace}:storage-provider`] ||
    // Configurations saved before the one-provider rule kept a flag per provider.
    storageProviders.find((p) => preferences[`${workspace}:provider:${p.id}`])?.id;
  const provider = storageProviders.find((p) => p.id === id);
  if (!provider) return null;
  return {
    provider,
    bucket: String(
      preferences[`${workspace}:storage-bucket`] ??
        preferences[`${workspace}:bucket:${provider.id}`] ??
        ""
    ),
    region: String(
      preferences[`${workspace}:storage-region`] ??
        preferences[`${workspace}:region:${provider.id}`] ??
        ""
    ),
  };
}

export function disconnectProvider(preferences: Preferences, workspace: string): Preferences {
  const keys = ["storage-provider", "storage-bucket", "storage-region"];
  return Object.fromEntries(
    Object.entries(preferences).filter(([key]) => {
      if (!key.startsWith(`${workspace}:`)) return true;
      const name = key.slice(workspace.length + 1);
      return !(keys.includes(name) || /^(provider|bucket|region):/.test(name));
    })
  );
}

export function connectProvider(
  preferences: Preferences,
  workspace: string,
  connection: { provider: string; bucket: string; region: string }
): Preferences {
  const active = getActiveProvider(preferences, workspace);
  if (active && active.provider.id !== connection.provider)
    throw new Error(`Disconnect ${active.provider.name} before connecting another provider.`);
  return {
    ...disconnectProvider(preferences, workspace),
    [`${workspace}:storage-provider`]: connection.provider,
    [`${workspace}:storage-bucket`]: connection.bucket,
    [`${workspace}:storage-region`]: connection.region,
  };
}
