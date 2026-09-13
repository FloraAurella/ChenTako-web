import type { ReactNode } from "react";
import { Surface } from "./primitives";
export function SettingsGroup({ id, title, description, children }: { id: string; title: string; description?: string; children: ReactNode }) {
  return <section className="settings-group" aria-labelledby={`${id}-title`}>
    <header className="settings-group-head"><h3 id={`${id}-title`} className="settings-card-title">{title}</h3>{description ? <p className="settings-card-desc">{description}</p> : null}</header>
    {children}
  </section>;
}
export function SettingsCard({ id, title, description, children }: { id: string; title: string; description?: string; children: ReactNode }) {
  return <Surface as="section" id={id} tabIndex={-1} className="paper-panel settings-card" aria-labelledby={`${id}-title`}><header className="settings-card-head"><h3 id={`${id}-title`} className="settings-card-title">{title}</h3>{description ? <p className="settings-card-desc">{description}</p> : null}</header>{children}</Surface>;
}
