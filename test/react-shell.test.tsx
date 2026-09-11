import { createComposition } from "../src/app/composition";
import { ContributionsProvider } from "../src/shared/state/contributions";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { AppShell } from "../src/app/shell/AppShell";
import { createStore } from "../src/app/state/store.js";
import { createThemeController } from "../src/modules/appearance/controller.js";

import { createReactDialogManager } from "../src/shared/overlays/dialog-service";

const compositions: ReturnType<typeof createComposition>[] = [];
const makeComposition = () => { const c = createComposition(); compositions.push(c); return c; };
const mounted: Array<{ container: HTMLDivElement; root: Root }> = [];

function render(node: ReactNode) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() => root.render(<ContributionsProvider value={makeComposition().contributions}>{node}</ContributionsProvider>));
  mounted.push({ container, root });
  return { container };
}

function createSettingsFixture(store: ReturnType<typeof createStore>) {
  return makeComposition().createSettingsService({
    store,
    theme: createThemeController(),
    dialogs: createReactDialogManager(),
    toast: () => {}
  });
}

afterEach(() => {
  for (const c of compositions.splice(0)) c.dispose();
  for (const item of mounted.splice(0)) {
    act(() => item.root.unmount());
    item.container.remove();
  }
});

describe("React App Shell DOM 契约", () => {
  it("保持关键标签层级、Class、ID、ARIA 与 data-* 契约", () => {
    const store = createStore();

    const react = render(<AppShell
      route={{ name: "chat", settingsSection: "appearance" }}
      sidebar={{ archivesMode: "full", drawerOpen: false }}
      conversationTitle="新对话"
      store={store}
      settings={createSettingsFixture(store)}
    />);

    const ids = [...react.container.querySelectorAll<HTMLElement>("[id]")].map((node) => node.id);
    expect(ids).toEqual(expect.arrayContaining([
      "appShell", "archiveDrawer", "searchInput", "conversationList", "drawerScrim",
      "drawerToggleBtn", "stageEyebrow", "stageTitle", "stageActions", "page-chat",
      "messageScroll", "messageList", "composerInput", "sendBtn",
      "page-settings", "settingsIndex", "settingsContent", "popoverHost",
      "modalHost", "lightbox"
    ]));
    // 全局 Toast 已关闭；错误由当前页面内的红色文字承载。
    expect(react.container.querySelector("#toast")).toBeNull();
    expect(react.container.querySelector(".toast-note")).toBeNull();
    expect(react.container.querySelector(".inline-error-line")).toBeNull();
    expect(react.container.querySelector("#appShell")?.getAttribute("data-show-archives")).toBe("true");
    expect(react.container.querySelector('[data-nav="chat"]')?.getAttribute("aria-current")).toBe("page");
    expect(react.container.querySelector("#page-chat")?.classList.contains("page-active")).toBe(true);
    expect(react.container.querySelector('[data-nav="work"]')).toBeNull();
    expect(react.container.querySelector("#page-work")).toBeNull();
    expect(react.container.querySelector('[data-section="appearance"]')?.classList.contains("is-active")).toBe(true);
    expect(react.container.querySelector('[data-section="appearance"]')?.textContent).toContain("外观");
    expect(react.container.querySelector("#page-chat > #messageScroll")).not.toBeNull();
    expect(react.container.querySelector("#composerInput")).not.toBeNull();
    const attachButton = react.container.querySelector<HTMLButtonElement>("#attachBtn");
    expect(attachButton?.classList.contains("composer-attach-btn")).toBe(true);
    expect(attachButton?.getAttribute("aria-label")).toBe("添加附件");
    expect(attachButton?.textContent).toBe("");
    expect(attachButton?.querySelector("svg")).not.toBeNull();
  });

  it("由 React 驱动路由和归档状态属性", () => {
    const store = createStore();
    const view = render(<AppShell
      route={{ name: "settings", settingsSection: "providers" }}
      sidebar={{ archivesMode: "collapsed", drawerOpen: true }}
      conversationTitle="对话"
      store={store}
      settings={createSettingsFixture(store)}
    />);
    expect(view.container.querySelector("#appShell")?.getAttribute("data-archives")).toBe("collapsed");
    expect(view.container.querySelector("#appShell")?.getAttribute("data-show-archives")).toBe("false");
    expect(view.container.querySelector("#page-settings")?.classList.contains("page-active")).toBe(true);
    expect(view.container.querySelector('[data-section="providers"]')?.classList.contains("is-active")).toBe(true);
    expect(view.container.querySelector("#archiveDrawer")?.classList.contains("drawer-open")).toBe(true);
  });
});
