import { installPlatform } from "./platform.js";
import { createBackendSync } from "../modules/connections/public/services_backend-sync.js";
import { Scope } from "../core/scope";
import { parseRoute, routeToHash } from "./router.js";
"use strict";

/**
 * 装配入口：创建 store / 主题 / 控制器，渲染外壳，
 * 安装路由、快捷键、全局事件与健康检查。
 */

import "./styles/main.css";

import { createStore } from "./state/store.js";
import { createThemeController } from "../modules/appearance/public/controller.js";
import { queryShell } from "./shell/query.js";
import { createDialogManager } from "../shared/dialogs.js";
import { icon } from "../resources/icons/index.js";
import { showInlineFeedback, backendStatusHtml, copyText } from "../shared/utils.js";
import { createSidebar } from "./shell/sidebar.js";

export function createApp({
  existingShell = null,
  store: existingStore = null,
  theme: existingTheme = null,
  dialogs: existingDialogs = null,
  toast: suppliedToast = null,
  contributions,
  beforeNavigate = null
} = {}) {
  const scope = new Scope();
  const sections = contributions.settings.list().map(entry => entry.id);
  const store = existingStore || createStore();
  const theme = existingTheme || createThemeController();
  const root = document.getElementById("app");
  const shell = existingShell || queryShell(root);
  const dialogs = existingDialogs || createDialogManager();

  theme.loadCustomThemes();
  theme.restoreUserThemes();
  theme.installPublicApi();

  const toast = suppliedToast || ((message, options) => showInlineFeedback(message, options));
  const sidebar = createSidebar({scope,store,theme,shell});
  const {sidebarQuery,openDrawer,closeDrawer,focusDrawerControl,applyArchivesMode,persistArchivesPreference} = sidebar;
  // 移动端/窄屏下抽屉是覆盖层：会话激活后收起，避免全屏抽屉挡住对话
  const closeDrawerIfOverlay = () => {
    if (sidebarQuery.matches && sidebar.drawerOpen) closeDrawer();
  };
  const chat = contributions.controllers.get("chat").create({ store, theme, dialogs, shell, toast, backendStatusHtml, closeDrawerIfOverlay, commandRegistry: contributions.commands, requestContexts: contributions.requestContexts });

  const appEl = root;
  function syncSettingsDetail(route) {
    appEl.dataset.settingsDetail = route.name === "settings" && route.settingsDetail === true ? "open" : "closed";
  }

  // ---- 渲染调度 ----

  function renderApp(reason) {
    const { route } = store.state;
    if (route.name === "chat") {
      chat.render(reason);
    } else {
      shell.stageActions.innerHTML = backendStatusHtml(store.state.backend);
    }
  }

  scope.defer(store.subscribe((reason) => {
    renderApp(reason);
    if (reason === "archive-error") toast("本地归档写入失败，请及时导出", { tone: "danger" });
    if (reason === "archive-recovered") toast("本地归档已恢复写入", { tone: "ok" });
  }));

  // ---- 路由 ----

  let approvedHash = "";
  let navigationRevision = 0;
  async function applyRouteFromLocation() {
    const revision = ++navigationRevision;
    const requestedHash = location.hash;
    const route = parseRoute(location.hash, store.state.route.settingsSection, sections);
    if (store.state.loaded && beforeNavigate && requestedHash !== approvedHash && !(await beforeNavigate(route))) {
      if (revision === navigationRevision) history.replaceState(null, "", routeToHash(store.state.route));
      return;
    }
    if (revision !== navigationRevision) return;
    approvedHash = "";
    if (/^#\/?settings\/extensions(?:\/|$)/.test(location.hash)) {
      history.replaceState(null, "", "#/settings/tools");
    } else if (location.hash && !/^#\/?(?:chat|settings)(?:\/|$)/.test(location.hash)) {
      history.replaceState(null, "", "#/chat");
    }
    syncSettingsDetail(route);
    store.setRoute(route);
  }

  async function navigate(route) {
    const parsed = typeof route === "string" ? parseRoute(`#/${route}`, store.state.route.settingsSection, sections) : route;
    const target = {
      ...parsed,
      settingsDetail: parsed.name === "settings" ? parsed.settingsDetail !== false : false,
      settingsProviderId: parsed.name === "settings" && parsed.settingsSection === "providers" ? (parsed.settingsProviderId || "") : ""
    };
    if (beforeNavigate && !(await beforeNavigate(target))) return;
    syncSettingsDetail(target);
    const hash = routeToHash(target);
    approvedHash = hash;
    if (location.hash === hash) {
      approvedHash = "";
      store.setRoute(target);
    } else {
      location.hash = hash;
    }
    closeDrawer();
  }

  scope.listen(window, "hashchange", applyRouteFromLocation);

  // ---- 全局点击代理（导航 / 代码复制） ----

  scope.listen(document, "click", (event) => {
    const navTarget = event.target.closest("[data-nav]");
    if (navTarget) {
      event.preventDefault();
      void navigate(navTarget.dataset.nav);
      return;
    }
    const sectionTarget = event.target.closest(".settings-nav-item[data-section]");
    if (sectionTarget) {
      event.preventDefault();
      void navigate({ name: "settings", settingsSection: sectionTarget.dataset.section, settingsDetail: true, settingsProviderId: "" });
      return;
    }
    const settingsBack = event.target.closest("[data-settings-back]");
    if (settingsBack) {
      event.preventDefault();
      const route = store.state.route;
      void navigate(route.name === "settings" && route.settingsSection === "providers" && route.settingsProviderId
        ? { name: "settings", settingsSection: "providers", settingsDetail: true, settingsProviderId: "" }
        : "settings");
      return;
    }
    const copyButton = event.target.closest("[data-action='copy-code']");
    if (copyButton) {
      const code = copyButton.closest(".code-block")?.querySelector("pre code");
      if (code) {
        copyText(code.textContent).then((ok) => {
          clearTimeout(copyButton.copyResetTimer);
          copyButton.dataset.copied = String(ok);
          copyButton.innerHTML = icon(ok ? "check" : "copy", 15);
          copyButton.title = ok ? "已复制" : "复制失败";
          copyButton.setAttribute("aria-label", copyButton.title);
          copyButton.copyResetTimer = scope.timeout(() => {
            copyButton.dataset.copied = "false";
            copyButton.innerHTML = icon("copy", 15);
            copyButton.title = "复制代码";
            copyButton.setAttribute("aria-label", "复制代码");
          }, 1600);
          if (!ok) toast("复制失败，请手动选择代码", { tone: "danger" });
        });
      }
      return;
    }
    const toggleCodeButton = event.target.closest("[data-action='toggle-code']");
    if (toggleCodeButton) {
      const source = toggleCodeButton.closest(".code-block")?.querySelector(":scope > .code-source");
      if (!source) return;
      const expanded = source.hidden;
      source.hidden = !expanded;
      toggleCodeButton.closest(".code-block")?.classList.toggle("is-code-collapsed", !expanded);
      toggleCodeButton.classList.toggle("is-active", !expanded);
      toggleCodeButton.setAttribute("aria-expanded", String(expanded));
      toggleCodeButton.title = expanded ? "收起代码" : "展开代码";
      toggleCodeButton.setAttribute("aria-label", toggleCodeButton.title);
      return;
    }
    const previewButton = event.target.closest("[data-action='run-preview']");
    if (previewButton) {
      const block = previewButton.closest(".code-block");
      const code = block?.querySelector("pre code");
      if (!code || block.dataset.streaming === "true") return;
      const format = previewButton.dataset.previewKind === "svg" ? "svg" : "html";
      dialogs.previewHtml({ source: code.textContent, format, title: format === "svg" ? "SVG 预览" : "HTML 预览" });
    }
  });

  // ---- 快捷键 ----

  scope.listen(document, "keydown", (event) => {
    const meta = event.metaKey || event.ctrlKey;
    if (meta && event.key === "\\" && !document.querySelector(".dialog-backdrop, .crop-backdrop")) {
      event.preventDefault();
      if (store.state.route.name !== "chat") return;
      if (sidebarQuery.matches) {
        if (sidebar.drawerOpen) closeDrawer();
        else openDrawer();
      } else {
        sidebar.archivesCollapsed = !sidebar.archivesCollapsed;
        applyArchivesMode();
        persistArchivesPreference();
        scope.frame(() => {
          if (sidebar.archivesCollapsed) (window.innerWidth > 720 ? document.getElementById("railExpandBtn") : shell.drawerToggle).focus();
          else focusDrawerControl();
        });
      }
      return;
    }
    if (meta && event.key.toLowerCase() === "k") {
      event.preventDefault();
      // Navigation can wait for unsaved settings; reveal only after it completes.
      void navigate("chat").then(() => scope.frame(() => {
        if (store.state.route.name !== "chat") return;
        if (sidebarQuery.matches) openDrawer({ focus: false });
        else {
          sidebar.archivesCollapsed = false;
          applyArchivesMode();
          persistArchivesPreference();
        }
        scope.frame(() => scope.frame(() => {
          shell.searchInput.focus();
          shell.searchInput.select();
        }));
      }));
      return;
    }
    if (meta && event.key.toLowerCase() === "n") {
      event.preventDefault();
      navigate("chat");
      chat.handleShortcutNewConversation();
      return;
    }
    if (event.key === "/" && !meta && !isTypingTarget(event.target)) {
      event.preventDefault();
      navigate("chat");
      chat.focusComposer();
      return;
    }
    if (event.key === "Escape") {
      // 模态对话框打开时交给对话框自己的处理器（它才是最顶层）
      if (document.querySelector(".dialog-backdrop, .crop-backdrop")) return;
      if (shell.lightbox.classList.contains("lightbox-open")) {
        chat.closeLightbox();
        return;
      }
      if (chat.closeActivePopover()) return;
      if (appEl.dataset.settingsDetail === "open") {
        navigate("settings");
        return;
      }
      if (sidebar.drawerOpen) closeDrawer();
    }
  });

  function isTypingTarget(target) {
    return target instanceof HTMLElement && (
      target.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
    );
  }

  // ---- 后端健康检查 ----

  const { checkBackend } = createBackendSync({ store, scope });

  // ---- 视口与运行环境 ----

  installPlatform({scope,store,chat});

  // ---- 启动 ----

  async function boot() {
    // 主题包是主题清单的权威来源；先恢复主题，再应用纯色画布外观。
    await theme.loadThemeArchive();
    if (scope.disposed) return;
    theme.init();
    await store.load();
    if (scope.disposed) return;
    applyRouteFromLocation();
    renderApp("boot");
    await checkBackend();
  }

  return {
    dispose() { scope.dispose(); chat.dispose(); store.flushDrafts(); },
    boot,
    navigate,
    openDrawer,
    closeDrawer,
    checkBackend
  };
}

export function bootApp(options) {
  const app = createApp(options);
  app.boot().catch((error) => {
    console.error("[ChenTako] 启动失败", error);
    showInlineFeedback("应用启动失败，请刷新重试", { tone: "danger" });
  });
  return app;
}
