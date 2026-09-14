"use client";

import type { LucideIcon } from "lucide-react";
import { Info } from "lucide-react";
import type { ReactNode } from "react";
import { useId } from "react";

import { cn } from "@/lib/utils";
import {
  cardClass,
  cardDescriptionClass,
  cardHeaderClass,
  cardTitleClass,
  demoNoteClass,
  demoNoteIconClass,
  rowClass,
  rowDescriptionClass,
  rowIconClass,
  rowTitleClass,
  sectionDescriptionClass,
  sectionTitleClass,
} from "./styles";

export function SettingsCard({
  title,
  description,
  className,
  children,
}: {
  title?: string;
  description?: string;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section className={cn(cardClass, className)} aria-labelledby={title ? id : undefined}>
      {title && (
        <header className={cardHeaderClass}>
          <h3 id={id} className={cardTitleClass}>
            {title}
          </h3>
          {description && <p className={cardDescriptionClass}>{description}</p>}
        </header>
      )}
      {children}
    </section>
  );
}

// A settings section's title and short description.
export function SettingsHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-[26px]">
      <h2 className={sectionTitleClass}>{title}</h2>
      <p className={sectionDescriptionClass}>{description}</p>
    </div>
  );
}

// An icon, title and description, with an optional control on the right.
export function SettingsRow({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className={rowClass}>
      <span className={rowIconClass} aria-hidden="true">
        <Icon />
      </span>
      <div className="min-w-0 flex-1">
        <strong className={rowTitleClass}>{title}</strong>
        <p className={rowDescriptionClass}>{description}</p>
      </div>
      {children}
    </div>
  );
}

// A muted note with an info icon, e.g. marking demo-only settings.
export function DemoNote({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <p className={cn(demoNoteClass, className)}>
      <Info className={demoNoteIconClass} />
      {children}
    </p>
  );
}
