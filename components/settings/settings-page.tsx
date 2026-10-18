import "server-only";

import { SettingsContent } from "./settings-content";

export function SettingsPage({ organization = false }: { organization?: boolean }) {
  return (
    <>
      <div className="mb-7.25 flex items-center justify-between gap-6 max-md:mb-5.75 max-md:items-start max-md:gap-3">
        <div>
          <h1 className="text-[29px] leading-[1.3] font-[550] tracking-[-1.2px] max-md:text-[27px]">
            {organization ? "Organization settings" : "Settings"}
            <span className="text-folder-green">.</span>
          </h1>
          <p className="mt-2 text-[13px] text-muted-foreground max-md:max-w-60 max-md:text-[11px] max-md:leading-[1.6]">
            Make this space work for you.
          </p>
        </div>
      </div>
      <SettingsContent organization={organization} />
    </>
  );
}
