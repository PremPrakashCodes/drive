import { AppWindow, KeyRound, Ticket, Webhook } from "lucide-react";

// The demo credential kinds under API / Developer, one tab each.
export const developerKinds = {
  keys: {
    label: "API keys",
    singular: "API key",
    noun: "key",
    icon: KeyRound,
    description: "Authenticate server-to-server requests to this workspace.",
    emptyTitle: "No API keys yet",
    empty: "Create a key to call the API from your own services.",
  },
  tokens: {
    label: "Access tokens",
    singular: "access token",
    noun: "token",
    icon: Ticket,
    description: "Personal tokens for scripts and command-line tools.",
    emptyTitle: "No access tokens yet",
    empty: "Create a token to use the CLI or run quick scripts.",
  },
  webhooks: {
    label: "Webhooks",
    singular: "webhook",
    noun: "webhook",
    icon: Webhook,
    description: "Send file and upload events to your endpoint as they happen.",
    emptyTitle: "No webhooks yet",
    empty: "Add an endpoint to receive events from this workspace.",
  },
  oauth: {
    label: "OAuth apps",
    singular: "OAuth application",
    noun: "app",
    icon: AppWindow,
    description: "Let other apps request access on behalf of your users.",
    emptyTitle: "No OAuth apps yet",
    empty: "Register an app so it can sign users in with this workspace.",
  },
};
export type DeveloperKind = keyof typeof developerKinds;
export const developerKindIds = Object.keys(developerKinds) as DeveloperKind[];
export const webhookEvents = [
  "file.created",
  "file.updated",
  "file.deleted",
  "file.moved",
  "file.shared",
  "upload.completed",
];
