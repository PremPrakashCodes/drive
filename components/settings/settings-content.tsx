"use client";

import dynamic from "next/dynamic";
import { parseAsString, useQueryState } from "nuqs";

import { SectionSkeleton } from "@/components/workspace/section-skeleton";
import { cn } from "@/lib/utils";
import { organizationSections, personalSections } from "./settings-data";

const loading = () => <SectionSkeleton cards={2} />;
const FamilySettings = dynamic(() => import("./family-settings").then((m) => m.FamilySettings), {
  loading,
});
const ProviderSettings = dynamic(
  () => import("./provider-settings").then((m) => m.ProviderSettings),
  { loading }
);
const MembersPage = dynamic(
  () => import("@/components/workspace/org/members-page").then((m) => m.MembersPage),
  { loading }
);
const TeamsPage = dynamic(
  () => import("@/components/workspace/org/teams-page").then((m) => m.TeamsPage),
  { loading }
);
const AuditLog = dynamic(() => import("./audit-log").then((m) => m.AuditLog), { loading });
const Preferences = dynamic(() => import("./preferences").then((m) => m.Preferences), { loading });

export function SettingsContent({ organization }: { organization: boolean }) {
  const [section, setSection] = useQueryState(
    "section",
    parseAsString.withDefault(organization ? "general" : "account").withOptions({ history: "push" })
  );
  const links = organization ? organizationSections : personalSections;
  return (
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
        {section === "family" && !organization ? (
          <FamilySettings />
        ) : section === "storage" ? (
          <ProviderSettings />
        ) : section === "members" ? (
          <MembersPage inSettings />
        ) : section === "teams" ? (
          <TeamsPage inSettings />
        ) : section === "audit" ? (
          <AuditLog />
        ) : (
          <Preferences key={section} section={section} />
        )}
      </div>
    </div>
  );
}
