"use client";

import { useQueryState } from "nuqs";

import { MembersPage } from "@/components/workspace/org/members-page";
import { TeamsPage } from "@/components/workspace/org/teams-page";
import { useWorkspaceRoute } from "@/components/workspace/route";
import { cn } from "@/lib/utils";
import { AuditLog } from "./audit-log";
import { DeveloperSettings } from "./developer-settings";
import { FamilySettings } from "./family-settings";
import { Preferences } from "./preferences";
import { ProviderSettings } from "./provider-settings";
import { organizationSections, personalSections } from "./settings-data";

export function SettingsPage() {
  const { org } = useWorkspaceRoute();
  const [section, setSection] = useQueryState("section", {
    defaultValue: org ? "general" : "account",
    history: "push",
  });
  const links = org ? organizationSections : personalSections;
  return (
    <>
      <div className="mb-7.25 flex items-center justify-between gap-6 max-md:mb-5.75 max-md:items-start max-md:gap-3">
        <div>
          <h1 className="text-[29px] leading-[1.3] font-[550] tracking-[-1.2px] max-md:text-[27px]">
            {org ? "Organization settings" : "Settings"}
            <span className="text-folder-green">.</span>
          </h1>
          <p className="mt-2 text-[13px] text-muted-foreground max-md:max-w-60 max-md:text-[11px] max-md:leading-[1.6]">
            Make this space work for you.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-[190px_minmax(0,1fr)] gap-9 border-t pt-6.5 max-[1200px]:grid-cols-[160px_minmax(0,1fr)] max-[1200px]:gap-6.25 max-[1000px]:gap-5 max-md:grid-cols-1 max-md:gap-6.5">
        <nav
          className="sticky top-5 flex flex-col gap-0.5 self-start max-md:static max-md:flex-row max-md:overflow-x-auto max-md:pb-1.25"
          aria-label="Settings sections"
        >
          {links.map(([id, label, Icon]) => (
            <button
              key={id}
              className={cn(
                "flex items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left text-[12.5px] text-muted-foreground transition-[background-color,color] duration-150 ease-[ease] hover:bg-accent/60 hover:text-foreground max-md:shrink-0 max-md:p-2.5 [&_svg]:size-3.75",
                section === id &&
                  "bg-accent font-medium text-primary hover:bg-accent hover:text-primary"
              )}
              aria-current={section === id ? "page" : undefined}
              onClick={() => void setSection(id)}
            >
              <Icon />
              {label}
            </button>
          ))}
        </nav>
        <div className="max-w-250 min-w-0">
          {section === "family" && !org ? (
            <FamilySettings />
          ) : section === "storage" ? (
            <ProviderSettings />
          ) : section === "members" ? (
            <MembersPage inSettings />
          ) : section === "teams" ? (
            <TeamsPage inSettings />
          ) : section === "developer" || section === "api" || section === "webhooks" ? (
            <DeveloperSettings key={section} webhooks={section === "webhooks"} />
          ) : section === "audit" ? (
            <AuditLog />
          ) : (
            <Preferences key={section} section={section} />
          )}
        </div>
      </div>
    </>
  );
}
