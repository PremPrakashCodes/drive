export type FileKind =
  | "folder"
  | "pdf"
  | "image"
  | "video"
  | "code"
  | "document"
  | "spreadsheet"
  | "archive"
  | "audio";
export type DriveFile = {
  id: string;
  name: string;
  kind: FileKind;
  size: number;
  modified: string;
  owner: string;
  parent: string | null;
  workspace: string;
  team?: string;
  starred?: boolean;
  shared?: boolean;
  trashed?: boolean;
  deletedAt?: string;
  provider: string;
  color?: string;
  thumbnail?: string;
  content?: string;
  url?: string;
  mime?: string;
  tags?: string[];
  // Set for items served by the database (signed-in personal drive).
  remote?: boolean;
  ownerId?: string;
  visibility?: "shared" | "private";
  canEdit?: boolean;
  // In the signed-in person's Locked folder: shown only on that page.
  locked?: boolean;
};
export const initialFiles: DriveFile[] = [
  {
    id: "projects",
    name: "Projects",
    kind: "folder",
    size: 0,
    modified: "2026-09-12T10:10:00",
    owner: "Prem Prakash",
    parent: null,
    workspace: "personal",
    provider: "S3",
    color: "green",
    starred: true,
    shared: true,
  },
  {
    id: "design",
    name: "Design assets",
    kind: "folder",
    size: 0,
    modified: "2026-09-11T12:00:00",
    owner: "Prem Prakash",
    parent: null,
    workspace: "personal",
    provider: "S3",
    color: "purple",
    shared: true,
  },
  {
    id: "documents",
    name: "Documents",
    kind: "folder",
    size: 0,
    modified: "2026-09-10T10:00:00",
    owner: "Prem Prakash",
    parent: null,
    workspace: "personal",
    provider: "S3",
    color: "amber",
  },
  {
    id: "photography",
    name: "Photography",
    kind: "folder",
    size: 0,
    modified: "2026-09-08T10:00:00",
    owner: "Prem Prakash",
    parent: null,
    workspace: "personal",
    provider: "S3",
    color: "blue",
    starred: true,
  },
  {
    id: "brand",
    name: "Brand guidelines.pdf",
    kind: "pdf",
    size: 2400000,
    modified: "2026-09-13T09:40:00",
    owner: "Prem Prakash",
    parent: null,
    workspace: "personal",
    provider: "S3",
    starred: true,
    shared: true,
    thumbnail: "brand",
    content:
      "FORM & FIELD\nBrand guidelines\nVersion 2.0 · September 2026\n\nThoughtfully made. Naturally connected.\n\nOur identity brings together considered typography, natural colors, and a belief that good design makes space for what matters.\n\n01 — Our purpose\nMake room for better ideas.\n\n02 — Color palette\nForest #28594D · Sand #E9E5DC · Ink #252B28\n\n03 — Typography\nClarity first. Warmth always.",
  },
  {
    id: "coast",
    name: "Coastal escape.jpg",
    kind: "image",
    size: 4800000,
    modified: "2026-09-13T08:20:00",
    owner: "Prem Prakash",
    parent: null,
    workspace: "personal",
    provider: "S3",
    thumbnail: "coast",
    url: "/demo/coast.svg",
    tags: ["photography", "travel"],
    starred: true,
  },
  {
    id: "roadmap",
    name: "Product roadmap.fig",
    kind: "document",
    size: 18200000,
    modified: "2026-09-12T17:30:00",
    owner: "Priya Singh",
    parent: null,
    workspace: "personal",
    provider: "S3",
    shared: true,
    thumbnail: "roadmap",
  },
  {
    id: "launch",
    name: "Launch teaser.mp4",
    kind: "video",
    size: 124000000,
    modified: "2026-09-12T15:00:00",
    owner: "Rahul Sharma",
    parent: null,
    workspace: "personal",
    provider: "R2",
    thumbnail: "video",
    shared: true,
  },
  {
    id: "notes",
    name: "Getting started.md",
    kind: "code",
    size: 4200,
    modified: "2026-09-12T12:00:00",
    owner: "Prem Prakash",
    parent: null,
    workspace: "personal",
    provider: "S3",
    content:
      "# Welcome to your workspace\n\nA little space for your next big idea.\n\n## Getting started\n\n1. Upload your files\n2. Organize them into folders\n3. Share with your team\n\n## Working together\n\nKeep your files close and your team closer.\nAll changes in this demo are saved on this device.",
  },
  {
    id: "budget",
    name: "Q4 budget.xlsx",
    kind: "spreadsheet",
    size: 850000,
    modified: "2026-09-11T15:45:00",
    owner: "Prem Prakash",
    parent: null,
    workspace: "personal",
    provider: "S3",
    shared: true,
    content:
      "Category,September,October,November\nInfrastructure,2400,2800,3100\nDesign,1800,1800,2000\nMarketing,3500,4200,5000\nTotal,7700,8800,10100",
  },
  {
    id: "api",
    name: "api-spec.json",
    kind: "code",
    size: 24000,
    modified: "2026-09-10T11:15:00",
    owner: "Prem Prakash",
    parent: "projects",
    workspace: "personal",
    provider: "S3",
    content:
      '{\n  "openapi": "3.1.0",\n  "info": { "title": "Drive API", "version": "1.0.0" },\n  "paths": { "/files": { "get": { "summary": "List files" } } }\n}',
  },
  {
    id: "invoice",
    name: "Invoice — September.pdf",
    kind: "pdf",
    size: 1200000,
    modified: "2026-09-09T10:00:00",
    owner: "Prem Prakash",
    parent: "documents",
    workspace: "personal",
    provider: "S3",
    content:
      "INVOICE\n\nINV-2026-009\nSeptember 1, 2026\n\nFrom: Form & Field Studio\nTo: Acme Inc.\n\nDesign services                  $2,400.00\nBrand consultation               $1,200.00\n\nTotal                            $3,600.00\n\nThank you for working with us.",
  },
  {
    id: "old",
    name: "Website backup.zip",
    kind: "archive",
    size: 48200000,
    modified: "2026-09-06T10:00:00",
    owner: "Prem Prakash",
    parent: "projects",
    workspace: "personal",
    provider: "S3",
    trashed: true,
    deletedAt: "2026-09-10T12:00:00",
  },
];
for (const workspace of ["acme", "startup-labs"]) {
  for (const [i, name] of [
    "Backend",
    "Frontend",
    "Infrastructure",
    "Documentation",
  ].entries())
    initialFiles.push({
      id: `${workspace}-${name.toLowerCase()}`,
      name,
      kind: "folder",
      size: 0,
      modified: "2026-09-12T10:00:00",
      owner: "Prem Prakash",
      parent: null,
      workspace,
      team: "engineering",
      provider: "S3",
      color: ["green", "purple", "blue", "amber"][i],
      shared: true,
    });
  for (const [i, file] of initialFiles
    .filter((f) =>
      ["brand", "coast", "roadmap", "notes", "budget"].includes(f.id),
    )
    .entries())
    initialFiles.push({
      ...file,
      id: `${workspace}-${file.id}`,
      workspace,
      team: i < 3 ? "design" : "engineering",
      shared: true,
    });
}
export type Team = {
  id: string;
  name: string;
  description: string;
  members: number;
  files: number;
  storage: string;
  color: string;
  workspace: string;
};
export const initialTeams: Team[] = ["acme", "startup-labs"].flatMap(
  (workspace) => [
    {
      id: "engineering",
      name: "Engineering",
      description:
        "Building what comes next. Backend, frontend & infrastructure.",
      members: 8,
      files: 1284,
      storage: "420 GB",
      color: "green",
      workspace,
    },
    {
      id: "design",
      name: "Design",
      description:
        "A home for thoughtful product design and great experiences.",
      members: 4,
      files: 820,
      storage: "180 GB",
      color: "purple",
      workspace,
    },
    {
      id: "marketing",
      name: "Marketing",
      description: "Stories, campaigns, and everything that gets us out there.",
      members: 5,
      files: 540,
      storage: "84 GB",
      color: "amber",
      workspace,
    },
  ],
);
export type Member = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  team: string;
  workspace: string;
};
export const initialMembers: Member[] = ["acme", "startup-labs"].flatMap(
  (workspace) => [
    {
      id: `${workspace}-prem`,
      name: "Prem Prakash",
      email: "prem@example.com",
      role: "Owner",
      status: "Active",
      team: "engineering",
      workspace,
    },
    {
      id: `${workspace}-rahul`,
      name: "Rahul Sharma",
      email: "rahul@acme.design",
      role: "Admin",
      status: "Active",
      team: "engineering",
      workspace,
    },
    {
      id: `${workspace}-priya`,
      name: "Priya Singh",
      email: "priya@acme.design",
      role: "Member",
      status: "Active",
      team: "design",
      workspace,
    },
    {
      id: `${workspace}-ankit`,
      name: "Ankit Patel",
      email: "ankit@acme.design",
      role: "Member",
      status: "Active",
      team: "engineering",
      workspace,
    },
    {
      id: `${workspace}-john`,
      name: "John Miller",
      email: "john@acme.design",
      role: "Member",
      status: "Invited",
      team: "marketing",
      workspace,
    },
  ],
);
export const initialOrganizations = [
  { id: "acme", name: "Acme Inc.", members: 12 },
  { id: "startup-labs", name: "Startup Labs", members: 8 },
];
export function formatSize(size: number) {
  return size < 1000
    ? `${size} B`
    : size < 1000000
      ? `${(size / 1000).toFixed(1)} KB`
      : size < 1000000000
        ? `${(size / 1000000).toFixed(1)} MB`
        : `${(size / 1000000000).toFixed(1)} GB`;
}
