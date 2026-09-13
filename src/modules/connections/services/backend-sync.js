import { apiFetch } from '../../../shared/api.js';
import { normalizeProvider } from '../../../contracts/normalize.js';
import { legacySettingsBackup, resolveChatConfig } from '../../context/public/domain_config.js';
import { snapshotProviderForModel } from '../domain/models.js';
export function createBackendSync({store,scope}) {
 const abort = new AbortController();
 scope.defer(() => { stopBackendRetry(); abort.abort(); });
  // 桌面版窗口先于后端就绪启动：down 状态下做有界自动重试（约 15 秒），成功即停
  const BACKEND_RETRY_INTERVAL_MS = 500;
  const BACKEND_RETRY_LIMIT = 30;
  let backendRetryTimer = 0;
  let backendAttempt = 0;

  function stopBackendRetry() {
    clearTimeout(backendRetryTimer);
    backendRetryTimer = 0;
  }

  async function checkBackend() {
    if (scope.disposed) return;
    stopBackendRetry();
    const attempt = ++backendAttempt;
    store.setBackendStatus("checking");
    try {
      const response = await apiFetch("/api/health", { signal: abort.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      // 防代理回退假 200：健康响应必须是 JSON 且 ok:true。
      // （无 /api 代理的开发服务器会回落返回 index.html，同样 200。）
      const payload = await response.json().catch(() => null);
      if (!payload || payload.ok !== true) throw new Error("健康检查响应异常");
      if (scope.disposed || attempt !== backendAttempt) return;
      store.setBackendStatus("ok");
      await syncProviderKeyStates();
    } catch (error) {
      if (scope.disposed || attempt !== backendAttempt) return; // 已有更新的探测接管状态
      store.setBackendStatus("down", error.message || "本地服务不可达");
      if (backendAttempt < BACKEND_RETRY_LIMIT) {
        backendRetryTimer = scope.timeout(() => checkBackend(), BACKEND_RETRY_INTERVAL_MS);
      }
    }
  }

  async function syncProviderKeyStates() {
    try {
      const response = await apiFetch("/api/providers", { signal: abort.signal });
      if (!response.ok) return;
      const payload = await response.json();
      if (scope.disposed) return;
      const remote = Array.isArray(payload.providers) ? payload.providers : [];
      const state = store.state;
      // Backend-only historical settings must also be recoverable before the first provider edit.
      const backedUpIds = new Set(state.legacySettingsBackup?.providers?.map((p) => p.id) || []);
      const missingLegacy = remote.filter((p) => !backedUpIds.has(p.id));
      if (missingLegacy.length) {
        const additional = legacySettingsBackup({ providers: missingLegacy });
        state.legacySettingsBackup = { providers: [...(state.legacySettingsBackup?.providers || []), ...additional.providers], conversations: state.legacySettingsBackup?.conversations || [] };
        store.persistSoon();
      }
      if (!state.providers.length && remote.length) {
        // 首次启动：采纳后端注册表为本地初始供应商（不含 Key）。
        state.providers = remote.map((provider) => normalizeProvider(provider));
        const initialProvider = state.providers.find((provider) => provider.enabled !== false) || null;
        state.activeProviderId = initialProvider?.id || "";
        const active = store.activeConversation();
        if (active && !active.providerId && initialProvider) {
          active.providerId = state.activeProviderId;
          active.providerSnapshot = snapshotProviderForModel(initialProvider, initialProvider.defaultModel);
          active.model = initialProvider.defaultModel;
          active.reasoningEffort = resolveChatConfig(state, active).reasoningEffort;
        }
        store.persistSoon();
      } else if (state.providers.length) {
        const providers = state.providers.map((provider) => {
          const match = remote.find((item) => item.id === provider.id || item.displayName === provider.displayName);
          return match ? normalizeProvider(match) : provider;
        });
        const changed = providers.some((provider, index) => (
          JSON.stringify(provider) !== JSON.stringify(state.providers[index])
        ));
        if (changed) {
          state.providers = providers;
          if (!providers.some((provider) => provider.id === state.activeProviderId && provider.enabled !== false)) {
            state.activeProviderId = providers.find((provider) => provider.enabled !== false)?.id || "";
          }
          store.persistSoon();
          store.notify("providers");
        }
      }
    } catch (error) {
      // 不打断界面，但留下可诊断的痕迹（静默吞错曾掩盖过代理故障）。
      if (scope.disposed) return;
      console.warn("[ai-chatbox] 供应商状态同步失败", error);
    }
  }

  scope.listen(window, "online", checkBackend);
  scope.listen(window, "offline", () => {
    stopBackendRetry();
    store.setBackendStatus("down", "网络已断开");
  });

 return {checkBackend};
}
