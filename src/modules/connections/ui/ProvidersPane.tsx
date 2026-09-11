import { Button } from "../../../shared/ui/primitives";
import { useEffect, useState } from "react";
import { useStoreValue, type ExternalStore } from "../../../shared/state/react";
import type { SettingsService } from "../../settings/public/services_settings-service";
import type { SettingsState } from "../../../contracts/settings";
import { ProviderCreateDialog, ProviderModelDialog } from "./provider-dialogs";
import { ProviderWorkspace } from "./provider-workspace";

interface ProviderRoute {
  name: string;
  settingsSection: string;
  settingsProviderId?: string;
}

function providerHash(providerId = "") {
  return providerId ? `#/settings/providers/${encodeURIComponent(providerId)}` : "#/settings/providers";
}

export function ProvidersPane({ store, state, service, route }: {
  store: ExternalStore & { state: any };
  state: SettingsState;
  service: SettingsService;
  route: ProviderRoute;
}) {
  const providers = useStoreValue<any[]>(store, "providers");
  const [creating, setCreating] = useState(false);
  const routeProviderId = String(route.settingsProviderId || "");

  useEffect(() => {
    if (route.name !== "settings" || route.settingsSection !== "providers") return;
    if (state.providerEditing?.mode === "new") return;
    if (routeProviderId && routeProviderId !== "new" && state.providerEditing?.draft.id !== routeProviderId) {
      service.providers.beginEdit(routeProviderId);
    }
  }, [route.name, route.settingsSection, routeProviderId, service, state.providerEditing?.draft.id, state.providerEditing?.mode]);

  useEffect(() => {
    if (route.name !== "settings" || route.settingsSection !== "providers") return;
    if (routeProviderId || !providers.length || window.matchMedia("(max-width: 720px)").matches) return;
    history.replaceState(null, "", providerHash(providers[0].id));
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }, [providers, route.name, route.settingsSection, routeProviderId]);

  const selectProvider = async (providerId: string) => {
    if (await service.providers.select(providerId)) location.hash = providerHash(providerId);
  };
  const chooseTemplate = (templateId: string) => {
    setCreating(false);
    service.providers.beginNew(templateId);
    location.hash = providerHash("new");
  };
  const save = async () => {
    const wasNew = state.providerEditing?.mode === "new";
    if (await service.providers.save() && wasNew) {
      const savedId = service.state.get().providerEditing?.draft.id;
      if (savedId) history.replaceState(null, "", providerHash(savedId));
    }
  };
  const remove = async () => {
    if (await service.providers.remove()) location.hash = providerHash();
  };

  return <div className="settings-pane provider-registry-pane">
    <div className="provider-registry-heading">
      <div>
        <h2 className="settings-pane-title">模型与供应商</h2>
        <p className="settings-pane-lede">管理 API 连接、模型上下文窗口与最大输出额度。</p>
      </div>
      <Button type="button" className="btn btn-primary" id="newProviderBtn" onClick={() => setCreating(true)}>添加供应商</Button>
    </div>
    <ProviderWorkspace
      providers={providers}
      editing={state.providerEditing}
      service={service}
      routeProviderId={routeProviderId}
      onSelect={selectProvider}
      onSave={save}
      onRemove={remove}
    />
    {creating ? <ProviderCreateDialog onClose={() => setCreating(false)} onChoose={chooseTemplate} /> : null}
    {state.providerEditing?.modelEditing ? <ProviderModelDialog editing={state.providerEditing} service={service} /> : null}
  </div>;
}
