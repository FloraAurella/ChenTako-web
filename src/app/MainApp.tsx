import { useLayoutEffect, useMemo } from "react";
import { createStore } from "./state/store.js";
import { bootApp } from "./bootstrap.js";
import { createThemeController } from "../modules/appearance/public/controller.js";
import { queryShell } from "./shell/query.js";
import { createComposition } from "./composition";
import { ContributionsProvider } from "../shared/state/contributions";
import { createReactDialogManager } from "../shared/overlays/dialog-service";
import { clearInlineError, reportInlineFeedback } from "../shared/overlays/inline-error-service";
import { useStoreValue } from "../shared/state/react";
import { AppShell } from "./shell/AppShell";

export function MainApp() {
  const composition = useMemo(() => createComposition((import.meta.env.VITE_DISABLED_MODULES || "").split(",").filter(Boolean)), []);
  const store = useMemo(() => createStore(), []);
  const theme = useMemo(() => createThemeController(), []);
  const dialogs = useMemo(() => createReactDialogManager(), []);
  const settings = useMemo(() => composition.createSettingsService({ store, theme, dialogs, toast: reportInlineFeedback }), [composition, dialogs, store, theme]);
  const appState = useStoreValue<any>(store, "app");
  useLayoutEffect(() => {
    // 设置目录、设置详情和设置条目切换都结束当前编辑态，避免旧表单跨条目复活。
    settings.resetNavigationState(appState.route);
    clearInlineError();
  }, [appState.route.name, appState.route.settingsSection, appState.route.settingsDetail, appState.route.settingsProviderId, settings]);
  useLayoutEffect(() => {
    const root = document.getElementById("app");
    if (!root) throw new Error("缺少应用根节点 #app");
    const app = bootApp({ contributions: composition.contributions, existingShell: queryShell(root), store, theme, dialogs, toast: reportInlineFeedback, beforeNavigate: settings.beforeNavigate });
    return () => { app.dispose(); theme.dispose(); composition.dispose(); };
  }, [composition, dialogs, store, theme]);

  const conversation = appState.conversations.find(
    (item: { id: string }) => item.id === appState.activeConversationId
  );
  return <ContributionsProvider value={composition.contributions}><AppShell
    route={appState.route}
    sidebar={appState.sidebar}
    conversationTitle={conversation?.title || "新对话"}
    store={store}
    settings={settings}
  /></ContributionsProvider>;
}
