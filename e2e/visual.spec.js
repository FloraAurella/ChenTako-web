"use strict";

import { test, expect } from "@playwright/test";

const FIXED_NOW = Date.parse("2026-08-25T10:00:00+08:00");
const SEED_STATE = {
  version: "2.5.1",
  conversations: [],
  providers: [{
    id: "p-demo",
    displayName: "示例供应商",
    baseUrl: "https://api.example.com/v1",
    responseFormat: "openai-compatible",
    defaultModel: "demo-model",
    models: ["demo-model", "demo-pro"],
    modelCapabilities: { "demo-model": { visionInput: "auto", imageOutput: "auto" } },
    maxTokens: 8192,
    contextWindow: 131072,
    temperature: 0.7,
    topP: 1,
    streaming: true,
    saveChats: true,
    systemPrompt: "",
    userId: "",
    hasKeyConfigured: true
  }],
  activeConversationId: "",
  activeProviderId: "p-demo",
  preferredReasoningEffort: "medium"
};

async function freezePage(page) {
  await page.addStyleTag({ content: `
    *, *::before, *::after {
      animation-delay: 0s !important;
      animation-duration: 0s !important;
      caret-color: transparent !important;
      transition-delay: 0s !important;
      transition-duration: 0s !important;
    }
    .provider-dialog-backdrop, .provider-dialog-backdrop .dialog-card { animation: none !important; transform: none !important; }
  ` });
  await page.evaluate(() => document.fonts.ready);
}

async function seed(page, { scheme = "light", themeId = "everforest", hash = "#/chat", state = SEED_STATE } = {}) {
  await page.addInitScript(([state, fixedNow, selectedScheme, selectedThemeId, selectedHash]) => {
    const NativeDate = Date;
    class FixedDate extends NativeDate {
      constructor(...args) { super(...(args.length ? args : [fixedNow])); }
      static now() { return fixedNow; }
    }
    globalThis.Date = FixedDate;
    localStorage.setItem("tribblebook-v6-state", JSON.stringify(state));
    localStorage.setItem("tribblebook-ui-preferences-v1", JSON.stringify({
      themeId: selectedThemeId,
      appearanceMode: selectedScheme
    }));
    location.hash = selectedHash;
  }, [state, FIXED_NOW, scheme, themeId, hash]);
}

function reasoningState() {
  const conversationId = "visual-reasoning";
  return {
    ...SEED_STATE,
    activeConversationId: conversationId,
    conversations: [{
      id: conversationId,
      title: "思考面板视觉检查",
      createdAt: FIXED_NOW - 60_000,
      updatedAt: FIXED_NOW,
      pinned: false,
      providerId: "p-demo",
      model: "demo-model",
      reasoningEffort: "medium",
      contextCompression: null,
      draft: "",
      messages: [
        {
          id: "visual-user",
          role: "user",
          content: "请说明你会如何组织这段回答。",
          createdAt: FIXED_NOW - 8_000
        },
        {
          id: "visual-assistant",
          role: "assistant",
          reasoning: "先确认用户真正需要的是回答结构，而不是直接扩展正文；接着核对已有上下文、限制条件和期望语气，避免遗漏会影响结论的细节，并把可以验证的事实与尚待确认的判断明确区分。\n\n再按结论、依据和下一步三个层次组织内容，让长段思考充分使用与正式回答相同的消息列宽，同时保持语言简洁、层级清楚，并确保用户能够快速定位真正需要执行的部分。",
          reasoningKind: "thinking",
          reasoningMs: 2400,
          content: "我会先给出结论，再说明判断依据，最后整理成可以直接执行的下一步。",
          createdAt: FIXED_NOW - 6_000,
          durationMs: 3200
        }
      ]
    }]
  };
}

function toolTimelineState() {
  const conversationId = "visual-tools";
  const intro = "我会先加载代码审查能力，再读取当前工作区状态。\n\n";
  const afterSkill = "规则已经就绪，现在检查工作区中的相关改动。\n\n";
  const afterStatus = "改动范围已确认，最后运行前端类型检查。\n\n";
  const ending = "检查完成：当前改动通过类型检查，工具输出已按调用顺序保留。";
  return {
    ...SEED_STATE,
    activeConversationId: conversationId,
    conversations: [{
      id: conversationId,
      title: "工具时间线视觉检查",
      createdAt: FIXED_NOW - 60_000,
      updatedAt: FIXED_NOW,
      pinned: false,
      providerId: "p-demo",
      model: "demo-model",
      reasoningEffort: "medium",
      contextCompression: null,
      draft: "",
      messages: [
        {
          id: "visual-tool-user",
          role: "user",
          content: "检查当前分支并给出验证结论。",
          createdAt: FIXED_NOW - 8_000
        },
        {
          id: "visual-tool-assistant",
          role: "assistant",
          reasoning: "先读取工作区状态，再运行类型检查；结果会按调用顺序即时呈现。",
          reasoningKind: "thinking",
          reasoningMs: 1800,
          content: `${intro}${afterSkill}${afterStatus}${ending}`,
          parts: [
            { type: "skill_applied", callId: "skill-review", name: "代码审查", source: "skill", status: "applied", input: "", output: "", content: [], contentOffset: intro.length, durationMs: 0 },
            { type: "tool_result", callId: "call-status", name: "git_status", source: "sandbox", status: "succeeded", input: '{\n  "short": true\n}', output: "已读取当前工作区状态；发现 12 个与本轮功能相关的改动。", content: [], contentOffset: intro.length + afterSkill.length, durationMs: 420 },
            { type: "tool_result", callId: "call-typecheck", name: "frontend_typecheck", source: "tool", status: "succeeded", input: "{}", output: "TypeScript 检查通过，没有发现类型错误。", content: [], contentOffset: intro.length + afterSkill.length + afterStatus.length, durationMs: 1260 }
          ],
          createdAt: FIXED_NOW - 6_000,
          durationMs: 3100
        }
      ]
    }]
  };
}

function artifactPreviewState() {
  const conversationId = "visual-artifacts";
  const intro = "我已经生成了一个可运行的 HTML 页面和一个 SVG 图形。\n\n";
  const ending = [
    "产物会留在创建位置；下面同时保留 HTML 源码。",
    "",
    "```html",
    '<main class="preview-card"><h1>ai-chatbox</h1><p>一个受限沙箱中的页面预览。</p></main>',
    "```"
  ].join("\n");
  return {
    ...SEED_STATE,
    activeConversationId: conversationId,
    conversations: [{
      id: conversationId,
      title: "代码与产物视觉检查",
      createdAt: FIXED_NOW - 60_000,
      updatedAt: FIXED_NOW,
      pinned: false,
      providerId: "p-demo",
      model: "demo-model",
      reasoningEffort: "medium",
      contextCompression: null,
      draft: "",
      messages: [{
        id: "visual-artifact-user",
        role: "user",
        content: "创建一个 HTML 页面和 SVG 图标。",
        createdAt: FIXED_NOW - 8_000
      }, {
        id: "visual-artifact-assistant",
        role: "assistant",
        content: `${intro}${ending}`,
        parts: [{
          type: "tool_result", callId: "call-artifact", name: "clawbox_code_interpreter",
          source: "sandbox", status: "succeeded", output: "两个文件已创建。", content: [], contentOffset: intro.length, durationMs: 860
        }, {
          type: "file", name: "preview.html", mimeType: "text/html",
          source: "data:text/html;base64,PGgxPlNlYXNpZGU8L2gxPg==", size: 19,
          contentOffset: intro.length, artifactId: "call-artifact:0", callId: "call-artifact"
        }, {
          type: "file", name: "mark.svg", mimeType: "image/svg+xml",
          source: "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjgiLz48L3N2Zz4=", size: 71,
          contentOffset: intro.length, artifactId: "call-artifact:1", callId: "call-artifact"
        }],
        createdAt: FIXED_NOW - 6_000,
        durationMs: 2200
      }]
    }]
  };
}

function imageOutputState() {
  const state = structuredClone(SEED_STATE);
  state.settingsSchemaVersion = 1;
  state.modelCompatibility = { "p-demo": { "demo-model": { imageOutput: true } } };
  return state;
}

async function installPendingImageStream(page) {
  await page.addInitScript(() => {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (!url.includes("/api/chat")) return nativeFetch(input, init);
      const encoder = new TextEncoder();
      const body = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('event: chat.stream.started\ndata: {"version":1,"providerId":"p-demo","reasoningKind":"summary"}\n\n'));
        }
      });
      return Promise.resolve(new Response(body, {
        status: 200,
        headers: { "content-type": "text/event-stream; charset=utf-8" }
      }));
    };
  });
}

test.beforeEach(async ({ page }) => {
  await page.route("**/api/health", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ ok: true, service: "clawbox-server" })
  }));
  await page.route("**/api/providers", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ providers: [] })
  }));
  await page.route("**/api/providers/key*", (route) => route.fulfill({
    status: 404,
    contentType: "application/json",
    body: JSON.stringify({ error: "not configured" })
  }));
});

test("onboarding 初始浅色", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 700 });
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto("/onboarding.html");
  await freezePage(page);
  await expect(page).toHaveScreenshot("onboarding-initial-light.png", { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
});

test("onboarding 初始深色", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 700 });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto("/onboarding.html");
  await freezePage(page);
  await expect(page).toHaveScreenshot("onboarding-initial-dark.png", { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
});

for (const scheme of ["light", "dark"]) {
  test(`空会话 ${scheme}`, async ({ page }) => {
    await seed(page, { scheme });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.locator(".empty-stage")).toBeVisible();
    await freezePage(page);
    await expect(page).toHaveScreenshot(`empty-chat-${scheme}.png`, { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
  });

  test(`Everforest 空会话 ${scheme}`, async ({ page }) => {
    await seed(page, { scheme, themeId: "everforest" });
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "everforest");
    await expect(page.locator(".motion-layer")).toHaveCount(0);
    await expect(page.locator(".empty-stage")).toBeVisible();
    await freezePage(page);
    await expect(page).toHaveScreenshot(`everforest-empty-${scheme}.png`, { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
  });

  test(`Everforest 真实消息 ${scheme}`, async ({ page }) => {
    await seed(page, { scheme, themeId: "everforest", state: reasoningState() });
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "everforest");
    await expect(page.locator(".message-entry")).toHaveCount(2);
    await expect(page.locator(".empty-card")).toHaveCount(0);
    await freezePage(page);
    await expect(page).toHaveScreenshot(`everforest-messages-${scheme}.png`, { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
  });

  test(`思考轨迹 ${scheme}`, async ({ page }) => {
    await seed(page, { scheme, state: reasoningState() });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    await page.goto("/");
    const sheet = page.locator(".reasoning-sheet");
    await expect(sheet).toBeVisible();
    await sheet.locator(".reasoning-toggle").click();
    await expect(sheet).toHaveAttribute("data-open", "true");
    await freezePage(page);
    await expect(page).toHaveScreenshot(`reasoning-trail-${scheme}.png`, { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
  });
}

test("Everforest 外观主题卡", async ({ page }) => {
  await seed(page, { scheme: "dark", themeId: "everforest", hash: "#/settings/appearance" });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".theme-card")).toHaveCount(1);
  await expect(page.locator(".theme-card").nth(0)).toHaveAttribute("data-theme-id", "everforest");
  await freezePage(page);
  await expect(page).toHaveScreenshot("everforest-appearance.png", { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
});

test("Everforest 思考强度控件", async ({ page }) => {
  await seed(page, { scheme: "light", themeId: "everforest" });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto("/");
  await page.click("#runtimeBtn");
  await page.click('[data-runtime-open="effort"]');
  const popover = page.locator(".effort-popover");
  await expect(popover).toBeVisible();
  await expect(popover.locator(".effort-head-spacer")).toBeEmpty();
  await expect(popover.locator(".effort-head svg")).toHaveCount(1);
  await popover.locator(".effort-rail").press("End");
  await expect(popover.locator("[data-effort-current]")).toHaveText("最大");
  await freezePage(page);
  // 严格比较浮层，避免小图标残留被像素容差忽略。
  await expect(popover).toHaveScreenshot("everforest-effort-popover.png", { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
});

test("Everforest 运行配置与模型选择器", async ({ page }) => {
  await seed(page, { scheme: "light", themeId: "everforest" });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto("/");
  await freezePage(page);

  await page.click("#runtimeBtn");
  const rootPopover = page.locator(".runtime-root-popover");
  await expect(rootPopover).toBeVisible();
  await expect(rootPopover).toHaveScreenshot("everforest-runtime-root.png", { animations: "disabled", caret: "hide", maxDiffPixels: 0 });

  await page.click('[data-runtime-open="model"]');
  const modelPopover = page.locator(".model-popover");
  await expect(modelPopover).toBeVisible();
  await expect(modelPopover).toHaveScreenshot("everforest-model-popover.png", { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
});

test("未知旧路由回退到 Chat", async ({ page }) => {
  await seed(page, { hash: "#/removed-route" });
  await page.goto("/");
  await expect(page).toHaveURL(/#\/chat$/);
  await expect(page.locator("#page-chat")).toHaveClass(/page-active/);
});

test("Provider 设置页面", async ({ page }) => {
  await seed(page, { hash: "#/settings/providers" });
  await page.goto("/");
  await expect(page.locator(".provider-item")).toHaveCount(1);
  await freezePage(page);
  await expect(page).toHaveScreenshot("settings-providers.png", { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
});

test("Provider 模型编辑基础弹层", async ({ page }) => {
  await seed(page, { hash: "#/settings/providers" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.locator('[data-model-row="demo-model"] [aria-label="编辑模型"]').click();
  await expect(page.getByRole("dialog", { name: "编辑模型配置" })).toBeVisible();
  await page.mouse.move(0, 0);
  await freezePage(page);
  await expect(page).toHaveScreenshot("provider-model-dialog-basic.png", { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
});

test("Provider 模型额度弹层深色", async ({ page }) => {
  await seed(page, { scheme: "dark", hash: "#/settings/providers" });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto("/");
  await page.locator('[data-model-row="demo-model"] [aria-label="编辑模型"]').click();
  const dialog = page.getByRole("dialog", { name: "编辑模型配置" });
  await expect(dialog.locator("#model-contextWindow")).toBeVisible();
  await expect(dialog.locator("#model-temperature")).toHaveCount(0);
  await freezePage(page);
  await expect(page).toHaveScreenshot("provider-model-dialog-advanced-dark.png", { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
});

test("上下文与提示词集中配置", async ({ page }) => {
  await seed(page, { hash: "#/settings/providers" });
  await page.goto("/");
  await page.locator('[data-section="context"]').click();
  await expect(page.locator("#cc-systemPrompt")).toBeVisible();
  await freezePage(page);
  await expect(page).toHaveScreenshot("provider-advanced-open.png", { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
});

test("Provider 中等宽度顶部切换器", async ({ page }) => {
  await seed(page, { hash: "#/settings/providers" });
  await page.setViewportSize({ width: 900, height: 700 });
  await page.goto("/");
  await expect(page.locator("#pf-name")).toBeVisible();
  await freezePage(page);
  await expect(page).toHaveScreenshot("provider-medium-workbench.png", { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
});

test("Provider 移动端列表与详情", async ({ page }) => {
  await seed(page, { hash: "#/settings/providers" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("#pf-name")).toHaveCount(0);
  await freezePage(page);
  await expect(page).toHaveScreenshot("provider-mobile-list.png", { animations: "disabled", caret: "hide", maxDiffPixels: 0 });

  await page.locator(".provider-item").first().click();
  await expect(page.locator("#pf-name")).toBeVisible();
  await freezePage(page);
  await expect(page).toHaveScreenshot("provider-mobile-detail.png", { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
});

test("移动端空会话", async ({ page }) => {
  await seed(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".mobile-nav")).toBeVisible();
  await freezePage(page);
  await expect(page).toHaveScreenshot("empty-chat-mobile.png", { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
});

test("移动端思考轨迹", async ({ page }) => {
  await seed(page, { state: reasoningState() });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const sheet = page.locator(".reasoning-sheet");
  await sheet.locator(".reasoning-toggle").click();
  await expect(sheet).toHaveAttribute("data-open", "true");
  await expect(sheet.locator(".reasoning-toggle")).toHaveCSS("min-height", "44px");
  await freezePage(page);
  await expect(page).toHaveScreenshot("reasoning-trail-mobile.png", { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
});

test("工具轻量时间线深色", async ({ page }) => {
  await seed(page, { scheme: "dark", state: toolTimelineState() });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".tool-result")).toHaveCount(3);
  await expect(page.locator(".tool-result-block")).toHaveCount(2);
  await freezePage(page);
  await expect(page).toHaveScreenshot("tool-timeline-dark.png", { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
});

test("工具轻量时间线移动端", async ({ page }) => {
  await seed(page, { state: toolTimelineState() });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".tool-result")).toHaveCount(3);
  await expect(page.locator(".tool-result-content").first()).toHaveCSS("padding-left", "16px");
  await freezePage(page);
  await expect(page).toHaveScreenshot("tool-timeline-mobile.png", { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
});

test("HTML 与 SVG 产物工具栏深色", async ({ page }) => {
  await seed(page, { scheme: "dark", state: artifactPreviewState() });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".artifact-file")).toHaveCount(2);
  await expect(page.locator(".code-block .code-actions button")).toHaveCount(3);
  await freezePage(page);
  await expect(page).toHaveScreenshot("artifact-preview-toolbar-dark.png", { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
});

test("HTML 与 SVG 产物工具栏移动端", async ({ page }) => {
  await seed(page, { state: artifactPreviewState() });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".artifact-file")).toHaveCount(2);
  await freezePage(page);
  await expect(page).toHaveScreenshot("artifact-preview-toolbar-mobile.png", { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
});

test("图像生成等待态深色", async ({ page }) => {
  await installPendingImageStream(page);
  await seed(page, { scheme: "dark", state: imageOutputState() });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto("/");
  await page.fill("#composerInput", "生成一张测试图片");
  await page.click("#sendBtn");
  await expect(page.locator(".stream-image-slot")).toBeVisible();
  await freezePage(page);
  await expect(page).toHaveScreenshot("image-generation-pending-dark.png", { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
});

test("图像生成等待态移动端", async ({ page }) => {
  await installPendingImageStream(page);
  await seed(page, { state: imageOutputState() });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.fill("#composerInput", "生成一张测试图片");
  await page.click("#sendBtn");
  await expect(page.locator(".stream-image-slot")).toBeVisible();
  await freezePage(page);
  await expect(page).toHaveScreenshot("image-generation-pending-mobile.png", { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
});

test("主题变更不产生多余通知", async ({ page }) => {
  await seed(page, { scheme: "dark" });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto("/");
  await page.evaluate(() => window.ClawboxThemeAPI.setAppearance("light"));
  await expect(page.locator(".toast-note")).toHaveCount(0);
});
