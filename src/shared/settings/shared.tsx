import { Button } from "../ui/primitives";
import { useSyncExternalStore } from "react";
import { TrustedIcon } from "../ui/Icon";
import type { SettingsService } from "../../modules/settings/public/services_settings-service";
import type { SettingsState } from "../../contracts/settings";

export function useSettingsState(service: SettingsService): SettingsState {
  return useSyncExternalStore(
    service.state.subscribe,
    () => service.state.getSnapshot().value,
    () => service.state.getSnapshot().value
  );
}

export function BackButton() {
  return <Button type="button" className="icon-btn settings-detail-close" data-settings-back title="返回设置目录" aria-label="返回"><TrustedIcon name="chevronLeft" size={17} /></Button>;
}

export function ToggleSetting({ label, hint, checked, onClick, id }: {
  label: string;
  hint: string;
  checked: boolean;
  onClick: () => void;
  id?: string;
}) {
  return <div className="toggle-zone"><div><div className="toggle-label">{label}</div><div className="toggle-hint">{hint}</div></div><Button type="button" className="toggle" role="switch" aria-label={label} id={id} aria-checked={checked} onClick={onClick} /></div>;
}
