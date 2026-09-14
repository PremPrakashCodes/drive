"use client";

import { ArrowRight, Check } from "lucide-react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { storageProviders } from "@/lib/workspace/providers";
import { providerLogoClass } from "./styles";

// S3 and R2 can be connected today; the rest are listed as coming soon.
const supported = (id: string) => id === "s3" || id === "r2";

// Choosing a provider to connect, while none is connected.
export function ProviderChoice({
  choice,
  onChoose,
  onStart,
}: {
  choice: string;
  onChoose: (id: string) => void;
  onStart: (id: string) => void;
}) {
  const chosen = storageProviders.find((p) => p.id === choice) ?? storageProviders[0];
  return (
    <section>
      <div
        role="radiogroup"
        aria-label="Storage provider"
        className="grid grid-cols-2 gap-3 max-md:grid-cols-1"
      >
        {storageProviders.map((p) => {
          const checked = p.id === choice;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={checked}
              data-checked={checked || undefined}
              className="group/option flex items-center gap-3.5 rounded-[12px] border bg-card p-4 text-left transition-[border-color,box-shadow,background-color] duration-150 ease-[ease] hover:border-[color-mix(in_srgb,var(--foreground)_22%,var(--border))] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-checked:border-primary data-checked:bg-accent data-checked:shadow-[0_0_0_1px_var(--primary)]"
              disabled={!supported(p.id)}
              onClick={() => onChoose(p.id)}
              onDoubleClick={() => onStart(p.id)}
            >
              <span className={providerLogoClass}>
                <Image
                  src={`/icons/${p.icon}.svg`}
                  alt=""
                  width={26}
                  height={26}
                  className="size-6.5"
                />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.75">
                <strong className="text-[14px] font-medium">{p.name}</strong>
                <small className="text-[12px] leading-[1.4] text-muted-foreground">
                  {supported(p.id) ? p.description : "Coming soon"}
                </small>
              </span>
              <span
                className="grid size-5 shrink-0 place-items-center rounded-full border-[1.5px] border-input text-transparent transition-[background-color,border-color] duration-150 ease-[ease] group-data-checked/option:border-primary group-data-checked/option:bg-primary group-data-checked/option:text-primary-foreground"
                aria-hidden="true"
              >
                <Check className="size-3 stroke-3" />
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-5 flex items-center justify-between gap-4 border-t pt-5 max-md:flex-col max-md:items-stretch">
        <p className="text-[12px] text-muted-foreground">
          You can switch later by disconnecting this provider.
        </p>
        <Button onClick={() => onStart(chosen.id)}>
          Continue with {chosen.name}
          <ArrowRight />
        </Button>
      </div>
    </section>
  );
}
