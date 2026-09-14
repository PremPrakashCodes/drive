import type { StorageCredentialCopy } from "@/types";
import { parseAsInteger, parseAsString } from "nuqs";

// The open connect wizard lives in the URL: ?provider=…&step=….
export const providerQuery = { provider: parseAsString, step: parseAsInteger.withDefault(1) };

export const steps = ["Credentials", "Bucket & region", "Review", "Done"];
export const stepHints = [
  "Add the keys this workspace will use.",
  "Choose where files should live.",
  "Check the details before saving.",
  "Your storage provider is ready.",
];

export const credentialCopy: Record<string, StorageCredentialCopy> = {
  s3: {
    access: {
      label: "Access key ID",
      placeholder: "AKIAIOSFODNN7EXAMPLE",
      hint: "Create one in IAM → Users → Security credentials.",
    },
    secret: {
      label: "Secret access key",
      placeholder: "Paste your secret access key",
      hint: "Shown once when the access key is created.",
    },
    bucket: {
      label: "Bucket",
      placeholder: "my-drive-files",
      hint: "An existing S3 bucket this workspace can read and write.",
    },
    region: {
      label: "Region",
      placeholder: "ap-south-1",
      hint: "The AWS region the bucket was created in.",
    },
  },
  r2: {
    access: {
      label: "Access key ID",
      placeholder: "e.g. 3f1c0e8a9b…",
      hint: "Create an R2 API token under R2 → Manage API tokens.",
    },
    secret: {
      label: "Secret access key",
      placeholder: "Paste your R2 secret",
      hint: "Shown once when the API token is created.",
    },
    bucket: {
      label: "Bucket",
      placeholder: "my-drive-files",
      hint: "An existing R2 bucket in your Cloudflare account.",
    },
    region: {
      label: "Region",
      placeholder: "auto",
      hint: "Most R2 buckets use auto.",
    },
  },
  gcs: {
    access: {
      label: "Service account email",
      placeholder: "drive@project.iam.gserviceaccount.com",
      hint: "The service account with Storage Object Admin access.",
    },
    secret: {
      label: "Service account key",
      placeholder: "Paste the private key from the JSON file",
      hint: "Download it from IAM → Service accounts → Keys.",
    },
    bucket: {
      label: "Bucket",
      placeholder: "my-drive-files",
      hint: "An existing Cloud Storage bucket.",
    },
    region: {
      label: "Location",
      placeholder: "asia-south1",
      hint: "The bucket's location in Google Cloud.",
    },
  },
  azure: {
    access: {
      label: "Storage account name",
      placeholder: "mydrivestorage",
      hint: "Found on the storage account's overview page.",
    },
    secret: {
      label: "Account key",
      placeholder: "Paste key1 or key2",
      hint: "Security + networking → Access keys.",
    },
    bucket: {
      label: "Container",
      placeholder: "my-drive-files",
      hint: "An existing blob container in this storage account.",
    },
    region: {
      label: "Region",
      placeholder: "centralindia",
      hint: "The Azure region of the storage account.",
    },
  },
};
