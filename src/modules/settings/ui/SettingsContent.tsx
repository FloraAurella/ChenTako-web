import { useContributions } from '../../../shared/state/contributions';
import { useEffect } from "react";
import { useStoreValue, type ExternalStore } from "../../../shared/state/react";
import { BackButton, useSettingsState } from "../../../shared/settings/shared";
import type { SettingsService } from "../services/settings-service";
import { InlineErrorLine } from "../../../shared/overlays/InlineErrorLine";

export function SettingsContent({ store, service, active = true }: { store: ExternalStore & { state: any }; service: SettingsService; active?: boolean }) {
  const route = useStoreValue<{ name: string; settingsSection: string; settingsProviderId?: string; settingsProjectId?: string }>(store, "route");
  const state = useSettingsState(service);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (service.hasUnsavedChanges()) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [service]);
  const section = route.settingsSection;
  const contributions = useContributions();
  const Pane = contributions.settings.get(section)?.component || contributions.settings.list()[0]?.component;
  const pane = Pane ? <Pane store={store} service={service} state={state} route={route} active={active} /> : null;
  return <div className="settings-content" id="settingsContent"><BackButton /><InlineErrorLine className="settings-inline-error" active={active} />{pane}</div>;
}
