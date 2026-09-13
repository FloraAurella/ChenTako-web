"use strict";

/**
 * Playwright 端到端：mock 本地后端，覆盖外壳、流式对话、思考面板、
 * 滚动所有权按钮、努力度滑块、额度弹层、主题明暗、设置分区与移动端。
 */

import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync, rmSync, readFileSync } from "node:fs";
import os from "node:os";
import { CURRENT_RELEASE, RELEASE_NOTES } from "../src/modules/data/domain/changelog.js";
import { APP_SETTINGS_VERSION, APP_VERSION } from "../src/contracts/constants.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 1×1 红色 PNG：足以走通解码 → 裁剪 → JPEG 编码全链路
const SAMPLE_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const SEED_STATE = {
  version: "2.5.1",
  conversations: [],
  providers: [
    {
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
    }
  ],
  activeConversationId: "",
  activeProviderId: "p-demo",
  preferredReasoningEffort: "medium"
};

test("首次启动引导：展示全新开始、迁移导入与 128 位封套说明", async ({ page }) => {
  await page.goto("/onboarding.html");
  await expect(page.locator("#onboardingTitle")).toContainText("欢迎使用 ai-chatbox");
  await expect(page.locator("#onboardingFreshBtn")).toContainText("启动全新 ai-chatbox");
  await expect(page.locator("#onboardingImportBtn")).toContainText("从迁移包导入");
  await expect(page.locator(".migration-seal")).toContainText("AES · 128 BIT");
  await expect(page.locator(".migration-seal")).toContainText("KEY.MD");
  await expect(page.locator("#onboardingFreshBtn")).toBeDisabled();
  await expect(page.locator("#onboardingStatus")).toContainText("首次启动时可用");
});

const testSeedRevisions = new WeakMap();
async function seedAndLoad(page, { state = SEED_STATE, hash = "#/chat", themeId = "" } = {}) {
  const revision = (testSeedRevisions.get(page) || 0) + 1;
  testSeedRevisions.set(page, revision);
  await page.addInitScript(([seedState, seedHash, selectedThemeId, seedRevision]) => {
    // Multiple init scripts have unspecified execution order. New fixtures win, while
    // reload keeps the application's saved state instead of reseeding old settings.
    if ((window.__appTestSeedRevision || 0) >= seedRevision) return;
    window.__appTestSeedRevision = seedRevision;
    if (Number(localStorage.getItem("app-test-seed-revision") || 0) < seedRevision) {
      localStorage.setItem("app-test-seed-revision", String(seedRevision));
      localStorage.setItem("tribblebook-v6-state", JSON.stringify({ ...seedState, savedAt: Date.now() }));
      if (selectedThemeId) {
      localStorage.setItem("tribblebook-ui-preferences-v1", JSON.stringify({
        themeId: selectedThemeId,
        appearanceMode: "light"
      }));
    }
    }
    location.hash = seedHash;
  }, [state, hash, themeId, revision]);
}

async function mockBackend(page) {
  await page.route("**/api/health", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ ok: true, service: "ai-chatbox-server" })
  }));
  await page.route("**/api/providers", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ providers: [] })
  }));
  await page.route("**/api/chat", (route) => route.fulfill({
    status: 200,
    headers: { "content-type": "text/event-stream; charset=utf-8" },
    body: [
      "event: chat.stream.started\ndata: {\"version\":1,\"providerId\":\"p-demo\",\"reasoningKind\":\"thinking\"}\n\n",
      "event: chat.reasoning.delta\ndata: {\"delta\":\"先想一下用户要什么。\",\"kind\":\"thinking\"}\n\n",
      "event: chat.content.delta\ndata: {\"delta\":\"你好，这是一段 **ai-chatbox** 风格的回复。\"}\n\n",
      "event: chat.usage\ndata: {\"inputTokens\":8,\"outputTokens\":6,\"totalTokens\":14,\"estimated\":false}\n\n",
      "event: chat.stream.completed\ndata: {\"finishReason\":\"stop\"}\n\n"
    ].join("")
  }));
}

async function readProviderVaultJson(page) {
  return page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("tribblebook-provider-secrets-v1", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction("vault", "readonly");
        const request = tx.objectStore("vault").getAll();
        tx.oncomplete = () => resolve(JSON.stringify(request.result));
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  });
}

async function pointOutsidePopover(page, popoverSelector, areaSelector = null) {
  const viewport = page.viewportSize();
  return page.evaluate(({ popoverSelector: selector, areaSelector: area, viewport: size }) => {
    const popover = document.querySelector(selector);
    const areaElement = area ? document.querySelector(area) : null;
    if (!size || !popover) return null;
    const card = popover.getBoundingClientRect();
    const bounds = areaElement ? areaElement.getBoundingClientRect() : { left: 0, top: 0, right: size.width, bottom: size.height };
    const candidates = [
      [bounds.left + 8, bounds.top + 8],
      [bounds.right - 8, bounds.top + 8],
      [bounds.left + 8, bounds.bottom - 8],
      [bounds.right - 8, bounds.bottom - 8],
      [(bounds.left + bounds.right) / 2, bounds.top + 8],
      [(bounds.left + bounds.right) / 2, bounds.bottom - 8]
    ];
    return candidates.find(([x, y]) =>
      x >= 0 && y >= 0 && x < size.width && y < size.height &&
      !(x >= card.left && x <= card.right && y >= card.top && y <= card.bottom)
    ) || null;
  }, { popoverSelector, areaSelector, viewport });
}

async function closePopoverOnFirstOutsideClick(page, buttonSelector, popoverSelector) {
  await page.click(buttonSelector);
  const popover = page.locator(popoverSelector);
  await expect(popover).toBeVisible();
  const point = await pointOutsidePopover(page, popoverSelector);
  expect(point).not.toBeNull();
  await page.mouse.click(point[0], point[1]);
  await expect(popover).toHaveCount(0);
}

/** 带一问一答的种子会话。 */
function seededConversation(id, title) {
  return {
    id,
    title,
    createdAt: Date.now() - 3600_000,
    updatedAt: Date.now() - 3600_000,
    pinned: false,
    providerId: "p-demo",
    model: "demo-model",
    reasoningEffort: "medium",
    contextCompression: null,
    messages: [
      { id: `${id}-m1`, role: "user", content: "你好", createdAt: Date.now() - 3600_000 },
      { id: `${id}-m2`, role: "assistant", content: "你好，很高兴见到你。", createdAt: Date.now() - 3500_000, durationMs: 1200 }
    ],
    draft: ""
  };
}

test.beforeEach(async ({ page }) => {
  await mockBackend(page);
});

test("外壳与空状态扉页", async ({ page }) => {
  await seedAndLoad(page);
  await page.goto("/");
  await expect(page.locator('[data-section="projects"]')).toBeVisible();
  await expect(page.locator('[data-section="chats"]')).toBeVisible();
  await expect(page.locator(".empty-stage .empty-title")).toContainText("今天想聊点什么");
  await expect(page.locator(".composer-input")).toBeVisible();
  await expect(page.locator(".suggestion-card")).toHaveCount(3);
  await expect(page.locator("#stageActions > *")).toHaveCount(1);
  await expect(page.locator("#stageActions > .status-pill")).toContainText("本地服务正常");
});

test("主题切换不产生全局通知", async ({ page }) => {
  await seedAndLoad(page);
  await page.goto("/");
  await page.evaluate(() => {
    for (let index = 0; index < 12; index += 1) window.ClawboxThemeAPI.setAppearance(index % 2 ? "light" : "dark");
  });

  await expect(page.locator(".toast-note")).toHaveCount(0);
});

test("侧栏移除外观切换与版本号，保留设置入口", async ({ page }) => {
  await seedAndLoad(page, { themeId: "everforest" });
  await page.goto("/");
  await expect(page.locator("#themeCycleBtn, #appearanceModeBtn, .sidebar-version")).toHaveCount(0);
  await expect(page.locator(".sidebar-settings")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "everforest");
});

test("空状态灵感卡之间无游离逗号", async ({ page }) => {
  await seedAndLoad(page);
  await page.goto("/");
  await expect(page.locator(".suggestion-card")).toHaveCount(3);
  const strayTextNodes = await page.locator(".suggestion-list").evaluate((el) =>
    [...el.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim()).length
  );
  expect(strayTextNodes).toBe(0);
});

test("流式对话：思考面板 + Markdown 正文 + 元数据", async ({ page }) => {
  await seedAndLoad(page);
  await page.goto("/");
  await page.fill("#composerInput", "打个招呼");
  await page.click("#sendBtn");
  await expect(page.locator(".message-entry.user .markdown-body")).toContainText("打个招呼");
  await expect(page.locator(".reasoning-sheet")).toContainText("已思考", { timeout: 8000 });
  const reasoningToggle = page.locator(".reasoning-toggle");
  if (await reasoningToggle.getAttribute("aria-expanded") === "true") await reasoningToggle.click();
  await expect.poll(() => page.locator(".reasoning-content").evaluate(el => el.getBoundingClientRect().height)).toBe(0);
  const gaps = await page.locator(".message-entry.assistant").evaluate(el => {
    const head = el.querySelector(".assistant-head").getBoundingClientRect();
    const toggle = el.querySelector(".reasoning-toggle").getBoundingClientRect();
    const body = el.querySelector(".message-body").getBoundingClientRect();
    return { above: toggle.top - head.bottom, below: body.top - toggle.bottom };
  });
  expect(gaps.above).toBe(gaps.below);
  await reasoningToggle.click();
  await expect.poll(() => page.locator(".reasoning-content").evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThan(8);
  await expect(page.locator(".reasoning-body")).toContainText("先想一下用户要什么");
  await reasoningToggle.click();
  await expect.poll(() => page.locator(".reasoning-content").evaluate(el => el.getBoundingClientRect().height)).toBe(0);
  await expect(page.locator(".message-entry.assistant .message-body .markdown-body")).toContainText("ai-chatbox");
  await expect(page.locator(".message-entry.assistant .message-body .markdown-body strong")).toHaveText("ai-chatbox");
  await expect(page.locator(".message-entry.assistant")).toContainText("tokens");
  // 自动生成标题（取前 18 字）
  await expect(page.locator("#stageTitle")).toContainText("打个招呼");
});

test("多轮工具 SSE：中间完成事件不截断，思考与正文按真实字节分片持续回传", async ({ page }) => {
  await page.addInitScript(() => {
    const originalFetch = window.fetch;
    window.fetch = async (input, init) => {
      const url = String(input instanceof Request ? input.url : input);
      if (!url.includes("/api/chat")) return originalFetch(input, init);
      const frames = [
        ['event: chat.stream.started\ndata: {"version":1,"providerId":"p-demo","reasoningKind":"thinking"}\n\n', 30],
        ['event: chat.reasoning.delta\ndata: {"delta":"准备调用工具。","kind":"thinking"}\n\n', 40],
        ['event: chat.content.delta\ndata: {"delta":"我先查询天气。\\n\\n"}\n\n', 80],
        ['event: chat.extension\ndata: {"type":"tool_use","callId":"call-1","name":"lookup","source":"tool","status":"requested","input":{"query":"天气"}}\n\n', 40],
        ['event: chat.extension\ndata: {"type":"tool_result","callId":"call-1","name":"lookup","source":"tool","status":"succeeded","content":[{"type":"json","data":{"temperature":26}}]}\n\n', 350],
        ['event: chat.reasoning.delta\ndata: {"delta":"正在整理结果。","kind":"thinking"}\n\n', 50],
        ['event: chat.content.delta\ndata: {"delta":"天气结果已确认，接着读取日程。\\n\\n"}\n\n', 80],
        ['event: chat.extension\ndata: {"type":"tool_use","callId":"call-2","name":"calendar","source":"tool","status":"requested","input":{"range":"today"}}\n\n', 40],
        ['event: chat.extension\ndata: {"type":"tool_result","callId":"call-2","name":"calendar","source":"tool","status":"succeeded","output":"今天没有待办日程"}\n\n', 350],
        ['event: chat.content.delta\ndata: {"delta":"两项工具结果已经正常流式返回。"}\n\n', 40],
        ['event: chat.usage\ndata: {"inputTokens":18,"outputTokens":9,"totalTokens":27,"estimated":false}\n\n', 20],
        ['event: chat.stream.completed\ndata: {"finishReason":"stop"}\n\n', 20]
      ];
      const encoder = new TextEncoder();
      let index = 0;
      const stream = new ReadableStream({
        start(controller) {
          const push = () => {
            if (index >= frames.length) {
              controller.close();
              return;
            }
            const [text, delay] = frames[index];
            index += 1;
            const bytes = encoder.encode(text);
            const first = Math.max(1, Math.floor(bytes.length / 3));
            const second = Math.max(first + 1, Math.floor(bytes.length * 2 / 3));
            controller.enqueue(bytes.slice(0, first));
            setTimeout(() => controller.enqueue(bytes.slice(first, second)), 5);
            setTimeout(() => controller.enqueue(bytes.slice(second)), 10);
            setTimeout(push, delay);
          };
          setTimeout(push, 20);
        }
      });
      return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
    };
  });
  await seedAndLoad(page);
  await page.goto("/");
  await page.fill("#composerInput", "调用工具后回答");
  await page.click("#sendBtn");

  const entry = page.locator(".message-entry.assistant");
  await expect(entry.locator(".reasoning-body")).toContainText("准备调用工具");
  await expect(page.locator("#sendBtn")).toHaveClass(/stop-mode/);
  await expect(entry.locator(".assistant-flow")).not.toContainText("两项工具结果已经正常流式返回");
  await expect(entry.locator(".tool-result")).toHaveCount(1);
  await expect(entry.locator(".tool-result")).toContainText("lookup");
  await expect(entry.locator(".tool-result")).not.toHaveAttribute("open", "");
  await entry.locator(".tool-result > summary").click();
  await expect(entry.locator(".tool-result-block")).toContainText('"temperature": 26');
  await expect(page.locator("#sendBtn")).toHaveClass(/stop-mode/);

  await expect(entry.locator(".assistant-flow")).toContainText("两项工具结果已经正常流式返回", { timeout: 8000 });
  await expect(page.locator("#sendBtn")).not.toHaveClass(/stop-mode/);
  await expect(entry.locator(".tool-result")).toHaveCount(2);
  const flowOrder = await entry.locator(".assistant-flow > *").evaluateAll((nodes) => nodes.map((node) => ({
    kind: node.classList.contains("assistant-flow-tools") ? "tool" : "text",
    text: node.textContent.trim()
  })));
  expect(flowOrder.map((item) => item.kind)).toEqual(["text", "tool", "text", "tool", "text"]);
  expect(flowOrder[0].text).toContain("我先查询天气");
  expect(flowOrder[1].text).toContain("lookup");
  expect(flowOrder[2].text).toContain("天气结果已确认");
  expect(flowOrder[3].text).toContain("calendar");
  expect(flowOrder[4].text).toContain("两项工具结果已经正常流式返回");
  await expect(entry).toContainText("27 tokens");
  await entry.locator(".reasoning-toggle").click();
  await expect(entry.locator(".reasoning-body")).toContainText("准备调用工具。正在整理结果。");
});

test("等待响应：耗时刷新只写文本，不重建转圈元素", async ({ page }) => {
  await mockBackend(page);
  await page.addInitScript(() => {
    const originalFetch = window.fetch;
    window.fetch = (input, init) => {
      const url = typeof input === "string" ? input : input?.url || "";
      if (!url.includes("/api/chat")) return originalFetch(input, init);
      const encoder = new TextEncoder();
      const frames = [
        ['event: chat.stream.started\ndata: {"version":1,"providerId":"p-demo","reasoningKind":"thinking"}\n\n', 1500],
        ['event: chat.content.delta\ndata: {"delta":"终于开始回答"}\n\n', 30],
        ['event: chat.stream.completed\ndata: {"finishReason":"stop"}\n\n', 20]
      ];
      let index = 0;
      const stream = new ReadableStream({
        start(controller) {
          const push = () => {
            if (index >= frames.length) { controller.close(); return; }
            const [text, delay] = frames[index];
            index += 1;
            controller.enqueue(encoder.encode(text));
            setTimeout(push, delay);
          };
          push();
        }
      });
      return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
    };
  });
  await seedAndLoad(page);
  await page.goto("/");
  await page.fill("#composerInput", "等待期转圈回归");
  await page.click("#sendBtn");

  const spinner = page.locator(".message-entry.assistant .message-meta .response-spinner").first();
  await expect(spinner).toBeVisible();
  // 在转圈节点上打标记；修复前每个 paint 周期 innerHTML 重建会抹掉它
  await spinner.evaluate((node) => { node.dataset.paintProbe = "same-node"; });
  await page.waitForTimeout(1200); // 覆盖至少两个 500ms 等待期 paint 周期
  expect(await spinner.evaluate((node) => node.dataset.paintProbe || "")).toBe("same-node");
  // 耗时仍按秒推进，状态标签仍是等待响应
  await expect(page.locator(".message-entry.assistant .message-meta").first()).toContainText(/等待响应 · \d+s/);

  // 首帧到达后转圈退场，正文出现
  await expect(page.locator("#messageList")).toContainText("终于开始回答");
  await expect(page.locator(".message-entry.assistant .message-meta .response-spinner")).toHaveCount(0);
});

test("think 标签跨 SSE delta：思考进入折叠面板，闭合后的正文继续流式显示", async ({ page }) => {
  await page.addInitScript(() => {
    const originalFetch = window.fetch;
    window.fetch = async (input, init) => {
      const url = String(input instanceof Request ? input.url : input);
      if (!url.includes("/api/chat")) return originalFetch(input, init);
      const frames = [
        'event: chat.stream.started\ndata: {"version":1,"providerId":"p-demo","reasoningKind":"thinking"}\n\n',
        'event: chat.content.delta\ndata: {"delta":"<th"}\n\n',
        'event: chat.content.delta\ndata: {"delta":"ink>流式思"}\n\n',
        'event: chat.content.delta\ndata: {"delta":"考</thi"}\n\n',
        'event: chat.content.delta\ndata: {"delta":"nk>最终"}\n\n',
        'event: chat.content.delta\ndata: {"delta":"正文"}\n\n',
        'event: chat.stream.completed\ndata: {"finishReason":"stop"}\n\n'
      ];
      const encoder = new TextEncoder();
      let index = 0;
      const stream = new ReadableStream({
        start(controller) {
          const push = () => {
            if (index >= frames.length) {
              controller.close();
              return;
            }
            controller.enqueue(encoder.encode(frames[index]));
            index += 1;
            setTimeout(push, 35);
          };
          push();
        }
      });
      return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
    };
  });
  await seedAndLoad(page);
  await page.goto("/");
  await page.fill("#composerInput", "测试 think 标签");
  await page.click("#sendBtn");

  const entry = page.locator(".message-entry.assistant");
  await expect(entry.locator(".reasoning-body")).toContainText("流式思考");
  await expect(entry.locator(".message-body .markdown-body")).toContainText("最终正文");
  await expect(entry).not.toContainText("<think>");
  await expect(entry).not.toContainText("</think>");
  await expect(page.locator("#sendBtn")).not.toHaveClass(/stop-mode/);
});

test("思考阶段隐藏正文气泡并显示思考时长", async ({ page }) => {
  // 页面内替换 fetch：请求挂起 1.2s 观察等待指示器，随后先发 reasoning 帧
  // 保持 1.6s 独立推理阶段，再推正文与完成帧，制造确定性的观察窗口。
  await page.addInitScript(() => {
    const originalFetch = window.fetch;
    window.fetch = async (input, init) => {
      const url = String(input instanceof Request ? input.url : input);
      if (!url.includes("/api/chat")) return originalFetch(input, init);
      const encoder = new TextEncoder();
      let index = 0;
      const frames = [
        'event: chat.stream.started\ndata: {"version":1,"providerId":"p-demo","reasoningKind":"thinking"}\n\n',
        'event: chat.reasoning.delta\ndata: {"delta":"先想一下用户要什么。","kind":"thinking"}\n\n'
      ];
      const stream = new ReadableStream({
        start(controller) {
          const push = () => {
            if (index < frames.length) {
              controller.enqueue(encoder.encode(frames[index]));
              index += 1;
              setTimeout(push, 60);
            } else {
              setTimeout(() => {
                controller.enqueue(encoder.encode('event: chat.content.delta\ndata: {"delta":"你好，这是正式回复。"}\n\n'));
                setTimeout(() => {
                  controller.enqueue(encoder.encode('event: chat.stream.completed\ndata: {"finishReason":"stop"}\n\n'));
                  controller.close();
                }, 60);
              }, 1600);
            }
          };
          setTimeout(push, 1200);
        }
      });
      return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
    };
  });
  await seedAndLoad(page);
  await page.goto("/");
  await page.fill("#composerInput", "打个招呼");
  await page.click("#sendBtn");
  const entry = page.locator(".message-entry.assistant");
  // 请求等待阶段：meta 内稳定的圆形指示器与“等待响应”文案，空正文气泡不可见
  const meta = entry.locator(".message-meta");
  await expect(meta.locator(".response-spinner")).toBeVisible();
  await expect(meta.locator(".response-pending-label")).toContainText("等待响应");
  await expect(entry.locator(".message-body")).toBeHidden();
  // 推理阶段：面板可见并展开，正文仍未出现，思考时长从首个增量起持续增长
  const sheet = entry.locator(".reasoning-sheet");
  await expect(sheet).toBeVisible();
  await expect(sheet).toHaveAttribute("data-open", "true");
  await expect(sheet.locator(".reasoning-toggle")).toHaveAttribute("aria-expanded", "true");
  await expect(sheet.locator(".reasoning-label")).toHaveText("正在思考…");
  await expect(sheet.locator(".reasoning-body")).toContainText("先想一下用户要什么");
  await expect(sheet.locator(".reasoning-duration")).toHaveText(/（[1-9]\d*s）/);
  await expect(entry.locator(".message-body")).toBeHidden();
  // 正文开始：气泡恢复，面板按阅读规则折叠为“已思考”并保留冻结的思考时长
  await expect(entry.locator(".message-body .markdown-body")).toContainText("正式回复", { timeout: 8000 });
  await expect(sheet).toBeVisible();
  await expect(sheet).toHaveAttribute("data-open", "false");
  await expect(sheet.locator(".reasoning-label")).toHaveText("已思考");
  await expect(sheet.locator(".reasoning-duration")).toHaveText(/（用时 \d+[sm]/);
});

test("回答摘要（responses）在思考阶段展开，正文开始后自动收起", async ({ page }) => {
  // 页面内替换 fetch：先推摘要帧、停 1.2s 再推正文，制造确定性的观察窗口
  await page.addInitScript(() => {
    const originalFetch = window.fetch;
    window.fetch = async (input, init) => {
      const url = String(input instanceof Request ? input.url : input);
      if (!url.includes("/api/chat")) return originalFetch(input, init);
      const frames = [
        'event: chat.stream.started\ndata: {"version":1,"providerId":"p-demo","reasoningKind":"summary"}\n\n',
        'event: chat.reasoning.delta\ndata: {"delta":"先想一下用户要什么。","kind":"summary"}\n\n'
      ];
      const encoder = new TextEncoder();
      let index = 0;
      const stream = new ReadableStream({
        start(controller) {
          const push = () => {
            if (index < frames.length) {
              controller.enqueue(encoder.encode(frames[index]));
              index += 1;
              setTimeout(push, 60);
            } else {
              setTimeout(() => {
                controller.enqueue(encoder.encode('event: chat.content.delta\ndata: {"delta":"这是正式回复。"}\n\n'));
                setTimeout(() => {
                  controller.enqueue(encoder.encode('event: chat.stream.completed\ndata: {"finishReason":"completed"}\n\n'));
                  controller.close();
                }, 60);
              }, 1200);
            }
          };
          setTimeout(push, 40);
        }
      });
      return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
    };
  });
  await seedAndLoad(page);
  await page.goto("/");
  await page.fill("#composerInput", "打个招呼");
  await page.click("#sendBtn");
  const entry = page.locator(".message-entry.assistant");
  const sheet = entry.locator(".reasoning-sheet");
  const toggle = sheet.locator(".reasoning-toggle");
  // 摘要已到但正文未开始：面板立即可见并展开，流式展示可公开的 reasoning summary
  await page.waitForTimeout(700);
  await expect(sheet).toBeVisible();
  await expect(sheet).toHaveAttribute("data-open", "true");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const controlledId = await toggle.getAttribute("aria-controls");
  expect(controlledId).toBeTruthy();
  await expect(sheet.locator(".reasoning-body")).toHaveAttribute("id", controlledId);
  await expect(sheet.locator(".reasoning-label")).toHaveText("正在整理思考…");
  await expect(sheet.locator(".reasoning-body")).toContainText("先想一下用户要什么");
  await expect(entry.locator(".message-meta")).toContainText("正在思考");
  // 正文开始：沿用现有阅读规则自动收起，用户仍可手动重新展开
  await expect(entry.locator(".message-body .markdown-body")).toContainText("正式回复", { timeout: 8000 });
  await expect(sheet).toBeVisible();
  await expect(sheet).toHaveAttribute("data-open", "false");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(sheet.locator(".reasoning-label")).toHaveText("思考摘要");
  await toggle.click();
  await expect(sheet).toHaveAttribute("data-open", "true");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(sheet.locator(".reasoning-body")).toContainText("先想一下用户要什么");
  const reasoningBox = await sheet.locator(".reasoning-body").boundingBox();
  const messageBox = await entry.locator(".message-body").boundingBox();
  expect(reasoningBox).not.toBeNull();
  expect(messageBox).not.toBeNull();
  expect(Math.abs((reasoningBox.x + reasoningBox.width) - (messageBox.x + messageBox.width))).toBeLessThanOrEqual(1);
});

test("思维链：正文开始后状态稳定，手动重新展开不被后续正文覆盖", async ({ page }) => {
  await page.addInitScript(() => {
    const originalFetch = window.fetch;
    window.__allowFirstReasoningContent = false;
    window.__allowSecondReasoningContent = false;
    window.fetch = async (input, init) => {
      const url = String(input instanceof Request ? input.url : input);
      if (!url.includes("/api/chat")) return originalFetch(input, init);
      const frames = [
        ['event: chat.stream.started\ndata: {"version":1,"providerId":"p-demo","reasoningKind":"thinking"}\n\n', 40],
        ['event: chat.reasoning.delta\ndata: {"delta":"先思考这一题。","kind":"thinking"}\n\n', 500],
        ['event: chat.content.delta\ndata: {"delta":"第一段正文。"}\n\n', 500],
        ['event: chat.content.delta\ndata: {"delta":"第二段正文继续到达。"}\n\n', 500],
        ['event: chat.stream.completed\ndata: {"finishReason":"stop"}\n\n', 20]
      ];
      const encoder = new TextEncoder();
      let index = 0;
      const stream = new ReadableStream({
        start(controller) {
          const push = () => {
            if (index >= frames.length) {
              controller.close();
              return;
            }
            if (index === 2 && !window.__allowFirstReasoningContent) {
              setTimeout(push, 20);
              return;
            }
            if (index === 3 && !window.__allowSecondReasoningContent) {
              setTimeout(push, 20);
              return;
            }
            const [frame, delay] = frames[index];
            index += 1;
            controller.enqueue(encoder.encode(frame));
            setTimeout(push, delay);
          };
          setTimeout(push, 20);
        }
      });
      return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
    };
  });
  await seedAndLoad(page);
  await page.goto("/");
  await page.fill("#composerInput", "验证思维链状态");
  await page.click("#sendBtn");

  const entry = page.locator(".message-entry.assistant");
  const sheet = entry.locator(".reasoning-sheet");
  const toggle = sheet.locator(".reasoning-toggle");
  await expect(sheet.locator(".reasoning-body")).toContainText("先思考这一题");

  // 正文还未开始时用户先手动收起；这不能阻止正文阶段完成状态落地。
  await toggle.click();
  await expect(sheet).toHaveAttribute("data-open", "false");
  await page.evaluate(() => { window.__allowFirstReasoningContent = true; });
  await expect(entry.locator(".message-body .markdown-body")).toContainText("第一段正文", { timeout: 8000 });
  await expect(entry).not.toHaveClass(/is-thinking/);
  await expect(sheet.locator(".reasoning-label")).toHaveText("已思考");

  // 正文继续到达时，用户主动重新展开的面板必须保持展开。
  await toggle.click();
  await expect(sheet).toHaveAttribute("data-open", "true");
  await page.evaluate(() => { window.__allowSecondReasoningContent = true; });
  await expect(entry.locator(".message-body .markdown-body")).toContainText("第二段正文继续到达", { timeout: 8000 });
  await expect(sheet).toHaveAttribute("data-open", "true");
  await expect(sheet.locator(".reasoning-label")).toHaveText("已思考");
});

test("停止生成后：提示与五个操作按钮并排", async ({ page }) => {
  // 流式 fetch 持续推送不结束（并响应 abort 信号），留出点击停止的时间窗
  await page.addInitScript(() => {
    const originalFetch = window.fetch;
    window.fetch = async (input, init) => {
      const url = String(input instanceof Request ? input.url : input);
      if (!url.includes("/api/chat")) return originalFetch(input, init);
      const signal = init && init.signal;
      const encoder = new TextEncoder();
      let count = 0;
      const stream = new ReadableStream({
        start(controller) {
          const onAbort = () => controller.error(new DOMException("Aborted", "AbortError"));
          if (signal) {
            if (signal.aborted) onAbort();
            else signal.addEventListener("abort", onAbort);
          }
          const push = () => {
            count += 1;
            if (count > 200) {
              controller.close();
              return;
            }
            const frame = count === 1
              ? 'event: chat.stream.started\ndata: {"version":1,"providerId":"p-demo","reasoningKind":"thinking"}\n\n'
              : 'event: chat.content.delta\ndata: {"delta":"持续生成的长回复。"}\n\n';
            controller.enqueue(encoder.encode(frame));
            setTimeout(push, 30);
          };
          setTimeout(push, 40);
        }
      });
      return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
    };
  });
  await seedAndLoad(page);
  await page.goto("/");
  await page.fill("#composerInput", "写长文");
  await page.click("#sendBtn");
  // 正文已在流出：发送键变停止钮，点击停止
  await expect(page.locator(".message-entry.assistant .message-body .markdown-body")).toContainText("长回复");
  await page.click("#sendBtn");
  const actions = page.locator(".message-entry.assistant .message-actions");
  await expect(actions).toHaveClass(/always-visible/);
  await expect(actions.locator(".stopped-note")).toContainText("已停止生成");
  await expect(actions.locator("[data-message-action]")).toHaveCount(5);
  // 并排校验：提示与首个按钮在同一行（纵向中心对齐）
  const sameRow = await actions.evaluate((el) => {
    const note = el.querySelector(".stopped-note").getBoundingClientRect();
    const btn = el.querySelector("[data-message-action]").getBoundingClientRect();
    return Math.abs(note.top + note.height / 2 - (btn.top + btn.height / 2)) < 3;
  });
  expect(sameRow).toBe(true);
});

test("代码块按暖调主题配色渲染", async ({ page }) => {
  await seedAndLoad(page);
  await page.route("**/api/chat", (route) => route.fulfill({
    status: 200,
    headers: { "content-type": "text/event-stream; charset=utf-8" },
    body: [
      "event: chat.stream.started\ndata: {\"version\":1,\"providerId\":\"p-demo\",\"reasoningKind\":\"thinking\"}\n\n",
      "event: chat.content.delta\ndata: {\"delta\":\"```js\\nconst a = 1; // note\\n```\"}\n\n",
      "event: chat.stream.completed\ndata: {\"finishReason\":\"stop\"}\n\n"
    ].join("")
  }));
  await page.goto("/");
  await page.fill("#composerInput", "写点代码");
  await page.click("#sendBtn");
  const codeBlock = page.locator(".message-entry.assistant .code-block");
  await expect(codeBlock).toBeVisible({ timeout: 8000 });
  await expect(codeBlock.locator(".code-lang")).toHaveText("js");
  await expect(codeBlock.locator(".code-copy")).toBeVisible();
  await expect(codeBlock.locator(".code-copy svg")).toHaveCount(1);
  await expect(codeBlock.locator(".code-copy")).toHaveAttribute("aria-label", "复制代码");
  await expect(codeBlock.locator(".code-toggle")).toBeVisible();
  await expect(codeBlock.locator(".code-run")).toHaveCount(0);
  await expect(codeBlock.locator(".tok-keyword")).toContainText("const");
  await codeBlock.locator(".code-toggle").click();
  await expect(codeBlock.locator(".code-source")).toBeHidden();
  await expect(codeBlock.locator(".code-toggle")).toHaveAttribute("aria-expanded", "false");
  await codeBlock.locator(".code-toggle").click();
  await expect(codeBlock.locator(".code-source")).toBeVisible();
});

test("HTML 代码块以无权限 iframe 安全预览，关闭按钮和 Esc 均恢复焦点", async ({ page }) => {
  const source = [
    "```html",
    '<main id="preview-target">安全预览</main>',
    '<script>document.body.dataset.executed = "true"</script>',
    '<form action="https://example.invalid/submit"><button>提交</button></form>',
    "```"
  ].join("\n");
  await seedAndLoad(page);
  await page.route("**/api/chat", (route) => route.fulfill({
    status: 200,
    headers: { "content-type": "text/event-stream; charset=utf-8" },
    body: [
      'event: chat.stream.started\ndata: {"version":1,"providerId":"p-demo","reasoningKind":"thinking"}\n\n',
      `event: chat.content.delta\ndata: ${JSON.stringify({ delta: source })}\n\n`,
      'event: chat.stream.completed\ndata: {"finishReason":"stop"}\n\n'
    ].join("")
  }));
  await page.goto("/");
  await page.fill("#composerInput", "生成 HTML");
  await page.click("#sendBtn");

  const block = page.locator(".message-entry.assistant .code-block");
  await expect(block.locator(".code-actions button")).toHaveCount(3);
  const previewButton = block.locator(".code-run");
  await expect(previewButton).toBeVisible();
  await expect(previewButton.locator("svg")).toHaveCount(1);
  await expect(previewButton).toHaveAttribute("aria-label", "运行 HTML");
  await previewButton.click();

  const dialog = page.locator(".html-preview-dialog");
  const frame = dialog.locator("iframe");
  await expect(dialog).toBeVisible();
  await expect(frame).toHaveAttribute("sandbox", "");
  await expect(frame).toHaveAttribute("referrerpolicy", "no-referrer");
  await expect(frame).toHaveAttribute("srcdoc", /script-src 'none'/);
  await expect(frame).toHaveAttribute("srcdoc", /connect-src 'none'/);
  await expect(frame).toHaveAttribute("srcdoc", /form-action 'none'/);
  await expect(dialog.locator(".html-preview-close")).toBeFocused();

  await dialog.locator(".html-preview-close").click();
  await expect(dialog).toHaveCount(0);
  await expect(previewButton).toBeFocused();
  await previewButton.click();
  await expect(dialog).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(previewButton).toBeFocused();
});

test("代码解释器 HTML / SVG 产物在流完成前原位出现并可安全运行", async ({ page }) => {
  const htmlSource = '<main id="artifact-html">HTML 产物</main><script>document.body.dataset.executed="true"</script>';
  const svgSource = '<svg viewBox="0 0 40 40"><script>alert(1)</script><circle cx="20" cy="20" r="16" fill="#35bfe6"/></svg>';
  const htmlData = `data:text/html;base64,${Buffer.from(htmlSource).toString("base64")}`;
  const svgData = `data:image/svg+xml;base64,${Buffer.from(svgSource).toString("base64")}`;
  await page.addInitScript(([htmlFile, svgFile]) => {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (!url.includes("/api/chat")) return nativeFetch(input, init);
      const encoder = new TextEncoder();
      const timers = [];
      const body = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('event: chat.stream.started\ndata: {"version":1,"providerId":"p-demo","reasoningKind":"thinking"}\n\n'));
          controller.enqueue(encoder.encode('event: chat.content.delta\ndata: {"delta":"我先创建两个预览文件。\\n\\n"}\n\n'));
          controller.enqueue(encoder.encode('event: chat.extension\ndata: {"type":"tool_use","callId":"call-artifacts","name":"clawbox_code_interpreter","source":"sandbox","status":"requested"}\n\n'));
          timers.push(setTimeout(() => {
            const event = {
              type: "tool_result", callId: "call-artifacts", name: "clawbox_code_interpreter",
              source: "sandbox", status: "succeeded", content: [
                { type: "json", data: { ok: true } },
                { type: "file", name: "demo.html", mimeType: "text/html", source: htmlFile, size: 96 },
                { type: "file", name: "chart.svg", mimeType: "image/svg+xml", source: svgFile, size: 112 }
              ]
            };
            controller.enqueue(encoder.encode(`event: chat.extension\ndata: ${JSON.stringify(event)}\n\n`));
          }, 250));
          timers.push(setTimeout(() => {
            controller.enqueue(encoder.encode('event: chat.content.delta\ndata: {"delta":"文件已经创建，可以直接预览。"}\n\n'));
          }, 850));
          timers.push(setTimeout(() => {
            controller.enqueue(encoder.encode('event: chat.stream.completed\ndata: {"finishReason":"stop"}\n\n'));
            controller.close();
          }, 1200));
        },
        cancel() { timers.forEach(clearTimeout); }
      });
      return Promise.resolve(new Response(body, { status: 200, headers: { "content-type": "text/event-stream; charset=utf-8" } }));
    };
  }, [htmlData, svgData]);
  await seedAndLoad(page);
  await page.goto("/");
  await page.fill("#composerInput", "创建 HTML 和 SVG");
  await page.click("#sendBtn");

  const entry = page.locator(".message-entry.assistant");
  const artifacts = entry.locator(".artifact-file");
  await expect(artifacts).toHaveCount(2, { timeout: 2000 });
  await expect(page.locator("#sendBtn")).toHaveClass(/stop-mode/);
  await expect(entry.locator(".tool-result")).not.toHaveAttribute("open", "");
  await expect(artifacts.nth(0)).toContainText("demo.html");
  await expect(artifacts.nth(1)).toContainText("chart.svg");
  for (const card of [artifacts.nth(0), artifacts.nth(1)]) {
    await expect(card.locator(".artifact-code svg")).toHaveCount(1);
    await expect(card.locator(".artifact-run svg")).toHaveCount(1);
    await expect(card.locator(".artifact-copy svg")).toHaveCount(1);
  }

  await artifacts.nth(0).locator(".artifact-code").click();
  await expect(artifacts.nth(0).locator(".artifact-source-panel")).toBeVisible();
  await expect(artifacts.nth(0).locator(".artifact-source-panel code")).toContainText("HTML 产物");
  await artifacts.nth(0).locator(".artifact-run").click();
  const htmlPreview = page.locator(".html-preview-dialog");
  await expect(htmlPreview.locator("iframe")).toHaveAttribute("title", "HTML 预览内容");
  await htmlPreview.locator(".html-preview-close").click();
  await expect(htmlPreview).toHaveCount(0);

  await artifacts.nth(1).locator(".artifact-run").click();
  const svgFrame = page.locator(".html-preview-dialog iframe");
  await expect(svgFrame).toHaveAttribute("title", "SVG 预览内容");
  await expect(svgFrame).toHaveAttribute("srcdoc", /script-src 'none'/);
  await page.locator(".html-preview-dialog .html-preview-close").click();
  await expect(page.locator(".html-preview-dialog")).toHaveCount(0);

  await expect(entry.locator(".assistant-flow")).toContainText("文件已经创建，可以直接预览", { timeout: 2500 });
  const flowKinds = await entry.locator(".assistant-flow > *").evaluateAll((nodes) => nodes.map((node) => node.classList.contains("assistant-flow-tools") ? "events" : "text"));
  expect(flowKinds).toEqual(["text", "events", "text"]);
});

test("消息原位编辑：用户消息取消/重发分支、助手消息仍可保存", async ({ page }) => {
  const state = {
    ...SEED_STATE,
    conversations: [seededConversation("conv-edit", "编辑对话")],
    activeConversationId: "conv-edit"
  };
  await seedAndLoad(page, { state });
  await page.goto("/");
  await page.hover(".message-entry.user");
  await page.click('.message-entry.user [data-message-action="edit"]');
  // 原位展开：编辑器替换该消息，文本框明显更大且带原文
  await expect(page.locator(".message-entry.editing .message-editor")).toBeVisible();
  const textarea = page.locator(".editor-textarea");
  await expect(textarea).toHaveValue("你好");
  expect((await textarea.boundingBox()).height).toBeGreaterThanOrEqual(120);
  // 用户编辑器隐藏原位保存，只保留附件、取消与保存并重新发送
  for (const mode of ["attach", "cancel", "resend"]) {
    const button = page.locator(`[data-editor="${mode}"]`);
    await expect(button).toBeVisible();
    await expect(button.locator("svg")).toHaveCount(1);
  }
  await expect(page.locator('[data-editor="save"]')).toHaveCount(0);
  // 取消：修改不写回
  await textarea.fill("改一下");
  await page.keyboard.press("Escape");
  await expect(page.locator(".message-entry.user .markdown-body")).toHaveText("你好");
  // 再编辑：上传附件 → 重发创建会话内分支，正文与附件卡都在新路径上
  await page.click('.message-entry.user [data-message-action="edit"]');
  const notesFile = path.join(os.tmpdir(), `clawbox-note-${Date.now()}.md`);
  writeFileSync(notesFile, "编辑期间新增的附件");
  try {
    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.click('[data-editor="attach"]')
    ]);
    await fileChooser.setFiles(notesFile);
    await expect(page.locator(".editor-chips .attachment-chip")).toContainText("clawbox-note");
    await textarea.fill("你好，附上笔记");
    await page.click('[data-editor="resend"]');
    await expect(page.locator(".message-entry.user .markdown-body")).toContainText("附上笔记");
    await expect(page.locator(".message-entry.user .file-card .file-name")).toContainText("clawbox-note");
    await expect(page.locator(".message-branch-switcher .branch-count")).toHaveText("2 / 2");
  } finally {
    rmSync(notesFile, { force: true });
  }
});

test("消息编辑：保存并重新发送创建会话内分支", async ({ page }) => {
  const state = {
    ...SEED_STATE,
    conversations: [seededConversation("conv-resend", "重发对话")],
    activeConversationId: "conv-resend"
  };
  await seedAndLoad(page, { state });
  await page.goto("/");
  await page.hover(".message-entry.user");
  await page.click('.message-entry.user [data-message-action="edit"]');
  await page.fill(".editor-textarea", "换个问法");
  await page.click('[data-editor="resend"]');
  // 新路径显示修改后的问题与新回复，旧路径保留在同一会话内
  await expect(page.locator(".message-entry.user .markdown-body").first()).toContainText("换个问法");
  await expect(page.locator(".message-entry.assistant .message-body .markdown-body").last()).toContainText("ai-chatbox", { timeout: 8000 });
  await expect(page.locator(".message-entry")).toHaveCount(2);
  await expect(page.locator(".message-branch-switcher .branch-count")).toHaveText("2 / 2");
  await page.click('.message-branch-switcher [data-message-branch="previous"]');
  await expect(page.locator(".message-entry.user .markdown-body")).toContainText("你好");
  await expect(page.locator(".message-entry.assistant .message-body .markdown-body")).toContainText("你好，很高兴见到你。");
  await page.click('.message-branch-switcher [data-message-branch="next"]');
  await expect(page.locator(".message-entry.user .markdown-body")).toContainText("换个问法");
});

test("响应进行时可以查看其他消息分支，原流继续接收并可切回", async ({ page }) => {
  await page.addInitScript(() => {
    window.__branchAnimationStarts = [];
    document.addEventListener("animationstart", (event) => {
      const target = event.target;
      if (!(target instanceof Element) || !target.matches(".message-entry")) return;
      window.__branchAnimationStarts.push({
        id: target.dataset.messageId || "",
        name: event.animationName
      });
    }, true);
    const originalFetch = window.fetch;
    window.fetch = async (input, init) => {
      const url = String(input instanceof Request ? input.url : input);
      if (!url.includes("/api/chat")) return originalFetch(input, init);
      const frames = [
        'event: chat.stream.started\ndata: {"version":1,"providerId":"p-demo","reasoningKind":"thinking"}\n\n',
        'event: chat.content.delta\ndata: {"delta":"响应中的新回答。"}\n\n',
        'event: chat.stream.completed\ndata: {"finishReason":"stop"}\n\n'
      ];
      const encoder = new TextEncoder();
      let index = 0;
      return new Response(new ReadableStream({
        start(controller) {
          const push = () => {
            if (index >= frames.length) {
              controller.close();
              return;
            }
            controller.enqueue(encoder.encode(frames[index++]));
            setTimeout(push, 350);
          };
          push();
        },
        cancel() {}
      }), { status: 200, headers: { "content-type": "text/event-stream; charset=utf-8" } });
    };
  });
  const state = {
    ...SEED_STATE,
    conversations: [{
      ...seededConversation("conv-live-branches", "流式分支"),
      messages: [
        { id: "live-u1", role: "user", content: "第一问", parentId: null, createdAt: Date.now() - 5000 },
        { id: "live-a1", role: "assistant", content: "第一答", parentId: "live-u1", createdAt: Date.now() - 4500 },
        { id: "live-u2", role: "user", content: "当前分支问题", parentId: "live-a1", createdAt: Date.now() - 4000 },
        { id: "live-a2", role: "assistant", content: "当前分支回答", parentId: "live-u2", createdAt: Date.now() - 3500 },
        { id: "live-u2b", role: "user", content: "之前的分支问题", parentId: "live-a1", createdAt: Date.now() - 3000 },
        { id: "live-a2b", role: "assistant", content: "之前的分支回答", parentId: "live-u2b", createdAt: Date.now() - 2500 }
      ],
      activeRootMessageId: "live-u1",
      activeChildByMessageId: { "live-u1": "live-a1", "live-a1": "live-u2", "live-u2": "live-a2" }
    }],
    activeConversationId: "conv-live-branches"
  };
  await seedAndLoad(page, { state });
  await page.goto("/");
  await page.fill("#composerInput", "继续回答");
  await page.click("#sendBtn");
  const branch = page.locator(".message-branch-switcher");
  await expect(branch.locator('[data-message-branch="next"]')).toBeEnabled();
  await page.evaluate(() => { window.__branchAnimationStarts.length = 0; });
  await branch.locator('[data-message-branch="next"]').click();
  // Cover the complete 280ms default message entrance window. Branch changes
  // must stay instant and must not emit either branch or message-in animation.
  await page.waitForTimeout(500);
  const branchAnimationEvents = await page.evaluate(() => {
    const visibleIds = new Set(Array.from(document.querySelectorAll(".message-entry"))
      .map((entry) => entry.dataset.messageId || ""));
    return window.__branchAnimationStarts
      .map((event) => ({ id: event.id, name: event.name }))
      .filter((event) => visibleIds.has(event.id))
      .sort((a, b) => a.id.localeCompare(b.id) || a.name.localeCompare(b.name));
  });
  expect(branchAnimationEvents).toEqual([]);
  await expect(page.locator(".message-entry.user .markdown-body").filter({ hasText: "之前的分支问题" })).toHaveText("之前的分支问题");
  await expect(page.locator(".message-entry.assistant .markdown-body").filter({ hasText: "之前的分支回答" })).toHaveText("之前的分支回答");

  // 流在不可见分支上继续，完成后切回仍能看到完整的新回答。
  await expect(page.locator(".conv-live")).toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(900);
  await page.evaluate(() => { window.__branchAnimationStarts.length = 0; });
  await branch.locator('[data-message-branch="previous"]').click();
  await page.waitForTimeout(500);
  const previousBranchAnimationEvents = await page.evaluate(() => {
    const visibleIds = new Set(Array.from(document.querySelectorAll(".message-entry"))
      .map((entry) => entry.dataset.messageId || ""));
    return window.__branchAnimationStarts
      .map((event) => ({ id: event.id, name: event.name }))
      .filter((event) => visibleIds.has(event.id))
      .sort((a, b) => a.id.localeCompare(b.id) || a.name.localeCompare(b.name));
  });
  expect(previousBranchAnimationEvents).toEqual([]);
  await expect(page.locator(".message-entry.assistant .markdown-body").filter({ hasText: "响应中的新回答。" })).toHaveText("响应中的新回答。", { timeout: 5000 });
});

test("Chat 浮层统一一次空白点击关闭", async ({ page }) => {
  await seedAndLoad(page);
  await page.goto("/");
  await closePopoverOnFirstOutsideClick(page, "#runtimeBtn", ".runtime-popover");
});

test("运行配置浮层：根目录可进入思考强度面板", async ({ page }) => {
  await seedAndLoad(page);
  await page.goto("/");
  await page.click("#runtimeBtn");
  const root = page.locator(".runtime-popover .runtime-root");
  await expect(root).toBeVisible();
  await expect(root.locator(".runtime-row")).toHaveCount(2);
  await expect(root.locator('[data-runtime-open="model"]')).toContainText("模型");
  await expect(root.locator('[data-runtime-open="effort"]')).toContainText("思考强度");
  // 进入思考强度面板：同一浮层容器内切换
  await page.click('[data-runtime-open="effort"]');
  await expect(page.locator(".effort-popover")).toBeVisible();
  await expect(page.locator(".effort-rail")).toBeFocused();
  await expect(page.locator("[data-effort-current]")).toHaveText("中等");
  // Escape 关闭后焦点回到锚点；重开回到根目录
  await page.keyboard.press("Escape");
  await expect(page.locator(".popover-card")).toHaveCount(0);
  await expect(page.locator("#runtimeBtn")).toBeFocused();
  await page.click("#runtimeBtn");
  await expect(page.locator(".runtime-popover .runtime-root")).toBeVisible();
  await page.keyboard.press("Escape");
});

test("思考强度重新打开时首帧直接显示已保存档位", async ({ page }) => {
  const conversation = { ...seededConversation("effort-initial", "强度初始位置"), reasoningEffort: "max", reasoningEffortOverride: "max" };
  await seedAndLoad(page, { state: { ...SEED_STATE, settingsSchemaVersion: 1, conversations: [conversation], activeConversationId: conversation.id } });
  await page.goto("/");

  for (const index of [4, 0, 1, 2, 3]) {
    await page.click("#runtimeBtn");
    // 同一浏览器任务中打开并读取样式，避免自动等待掩盖首帧跳动。
    const initial = await page.locator('[data-runtime-open="effort"]').evaluate((button) => {
      button.click();
      const rail = document.querySelector(".effort-rail");
      const thumb = rail.querySelector(".effort-rail-thumb");
      const fill = rail.querySelector(".effort-rail-fill");
      const x = new DOMMatrixReadOnly(getComputedStyle(thumb).transform).m41;
      return {
        index: Number(rail.getAttribute("aria-valuenow")),
        x,
        travel: rail.clientWidth - 28,
        transitions: [thumb, fill].flatMap((element) => element.getAnimations()).filter((animation) => animation instanceof CSSTransition).length
      };
    });
    expect(initial.index).toBe(index);
    expect(initial.x).toBeCloseTo(initial.travel * index / 4, 2);
    expect(initial.transitions).toBe(0);
    // 设置下一档后关闭，验证重新打开仍直接恢复该位置。
    await page.keyboard.press(index === 4 ? "Home" : "ArrowRight");
    await page.keyboard.press("Escape");
  }
});

test("思考强度单轨五档交互", async ({ page }) => {
  await seedAndLoad(page);
  await page.goto("/");
  await page.click("#runtimeBtn");
  await page.click('[data-runtime-open="effort"]');
  const rail = page.locator(".effort-rail");
  await expect(rail).toBeVisible();
  await expect(page.locator("[data-effort-current]")).toHaveText("中等");
  const box = await rail.boundingBox();
  const mid = { y: box.height / 2 };
  // 点击容器中点 = 第 2 格（高），键盘再进一档
  await rail.click({ position: { x: box.width / 2, ...mid } });
  await rail.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("[data-effort-current]")).toHaveText("极高");
  await expect(page.locator(".effort-rail-dots i.is-past")).toHaveCount(4);
  // 最左 = low：常驻摘要实时同步双语短标签
  await rail.click({ position: { x: 2, ...mid } });
  await expect(page.locator("[data-effort-current]")).toHaveText("轻量");
  await expect(page.locator("#effortValue")).toHaveText("轻量");
  await expect(page.locator(".effort-rail-dots i.is-past")).toHaveCount(1);
  // 最右 = max：全部点亮，白拇指在最右
  await rail.click({ position: { x: box.width - 2, ...mid } });
  await expect(page.locator("[data-effort-current]")).toHaveText("最大");
  await expect(page.locator(".effort-rail-dots i.is-past")).toHaveCount(5);
});

test("Everforest：主题包令牌与纯色外观完整生效", async ({ page }) => {
  await seedAndLoad(page, { themeId: "everforest" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "everforest");
  await expect(page.locator("html")).not.toHaveClass(/transparency-mode/);
  await expect(page.locator(".app-canvas")).toHaveCSS("background-image", "none");
  const tokens = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return Object.fromEntries([
      "--canvas-mid", "--surface-content", "--label", "--accent", "--send-btn", "--font-body"
    ].map((token) => [token, style.getPropertyValue(token).trim()]));
  });
  // 以当前主题包（resources/themes/everforest-ai-chatbox-theme-v1.json）为权威，
  // 不复制旧 Everforest 色值。
  expect(tokens).toMatchObject({
    "--canvas-mid": "#F7F5EC",
    "--surface-content": "#FCFBF6",
    "--label": "#46534D",
    "--accent": "#93B259",
    "--send-btn": "#617D43"
  });
  expect(tokens["--font-body"]).toContain("New York");
});

test("后台流式：切换会话不打断生成，切回原会话进度不丢", async ({ page }) => {
  const state = {
    ...SEED_STATE,
    conversations: [seededConversation("conv-a", "会话 A"), seededConversation("conv-b", "会话 B")],
    activeConversationId: "conv-a"
  };
  // /api/chat 延迟回包，制造确定性的“生成中”切换窗口
  await page.route("**/api/chat", async (route) => {
    await page.waitForTimeout(1500);
    await route.fulfill({
      status: 200,
      headers: { "content-type": "text/event-stream; charset=utf-8" },
      body: [
        "event: chat.stream.started\ndata: {\"version\":1,\"providerId\":\"p-demo\",\"reasoningKind\":\"thinking\"}\n\n",
        "event: chat.reasoning.delta\ndata: {\"delta\":\"先想一下用户要什么。\",\"kind\":\"thinking\"}\n\n",
        "event: chat.content.delta\ndata: {\"delta\":\"你好，这是正式回复。\"}\n\n",
        "event: chat.stream.completed\ndata: {\"finishReason\":\"stop\"}\n\n"
      ].join("")
    });
  });
  await seedAndLoad(page, { state });
  await page.goto("/");
  await page.fill("#composerInput", "打个招呼");
  await page.click("#sendBtn");
  // A 生成中：侧栏出现后台流标识
  const itemA = page.locator('[data-conversation-id="conv-a"]');
  await expect(itemA.locator(".conv-live")).toBeVisible();
  // 切到会话 B：B 不在生成，发送键是发送态，也没有流式条目
  await page.locator('[data-conversation-id="conv-b"]').click();
  await expect(page.locator("#stageTitle")).toContainText("会话 B");
  await expect(page.locator("#sendBtn")).not.toHaveClass(/stop-mode/);
  await expect(page.locator(".message-entry.assistant.is-thinking")).toHaveCount(0);
  // A 的流仍在后台跑：切回 A 能看到思考态并等到完整回复
  await itemA.click();
  await expect(page.locator(".message-entry.assistant .message-body .markdown-body").last()).toContainText("正式回复", { timeout: 8000 });
  await expect(page.locator(".reasoning-label")).toHaveText("已思考");
  await expect(page.locator(".message-entry.user .markdown-body").last()).toContainText("打个招呼");
  // 完成后侧栏标识消失
  await expect(itemA.locator(".conv-live")).toHaveCount(0);
});

test("响应中切换对话再切回：思维链展开态与阅读位置保留", async ({ page }) => {
  const state = {
    ...SEED_STATE,
    conversations: [seededConversation("conv-a", "会话 A"), seededConversation("conv-b", "会话 B")],
    activeConversationId: "conv-a"
  };
  // 慢速流：先思考、再逐行吐正文（约 8s），保证观察与切换窗口
  await page.addInitScript(() => {
    const originalFetch = window.fetch;
    window.fetch = async (input, init) => {
      const url = String(input instanceof Request ? input.url : input);
      if (!url.includes("/api/chat")) return originalFetch(input, init);
      const frames = [
        'event: chat.stream.started\ndata: {"version":1,"providerId":"p-demo","reasoningKind":"thinking"}\n\n',
        'event: chat.reasoning.delta\ndata: {"delta":"先想一下用户要什么，展开一段思考。","kind":"thinking"}\n\n'
      ];
      for (let i = 0; i < 110; i += 1) {
        frames.push(`event: chat.content.delta\ndata: {"delta":"第 ${i} 行：长回复持续生成，撑开滚动区域。\\n"}\n\n`);
      }
      frames.push('event: chat.stream.completed\ndata: {"finishReason":"stop"}\n\n');
      const encoder = new TextEncoder();
      let index = 0;
      const stream = new ReadableStream({
        start(controller) {
          const push = () => {
            if (index < frames.length) {
              controller.enqueue(encoder.encode(frames[index]));
              index += 1;
              setTimeout(push, 70);
            } else {
              controller.close();
            }
          };
          setTimeout(push, 40);
        }
      });
      return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
    };
  });
  await seedAndLoad(page, { state });
  await page.goto("/");
  await page.fill("#composerInput", "写长文");
  await page.click("#sendBtn");
  // 正文开始后思维链自动收起 → 用户手动重新展开
  const entry = page.locator(".message-entry.assistant").last();
  await expect(entry.locator(".message-body .markdown-body")).toContainText("第 1 行", { timeout: 8000 });
  await entry.locator(".reasoning-toggle").click();
  await expect(entry.locator(".reasoning-sheet")).toHaveAttribute("data-open", "true");
  // 上滑离开底部（阅读历史位置）：真实滚轮手势解除跟随（程序设置 scrollTop 不算用户意图）
  await page.waitForFunction(() => {
    const el = document.querySelector("#messageScroll");
    return el && el.scrollHeight > el.clientHeight + 200;
  });
  const scrollBox = await page.locator("#messageScroll").boundingBox();
  await page.mouse.move(scrollBox.x + scrollBox.width / 2, scrollBox.y + scrollBox.height / 2);
  await page.mouse.wheel(0, -260);
  // 脱离跟随后「有新回复」按钮出现
  await expect(page.locator("#newRepliesBtn")).toBeVisible({ timeout: 3000 });
  // 切到会话 B 再切回 A
  await page.locator('[data-conversation-id="conv-b"]').click();
  await expect(page.locator("#stageTitle")).toContainText("会话 B");
  await page.locator('[data-conversation-id="conv-a"]').click();
  // 思维链仍为展开、阅读位置未被强制回底
  await expect(entry.locator(".reasoning-sheet")).toHaveAttribute("data-open", "true");
  const awayFromBottom = await page.locator("#messageScroll").evaluate((el) =>
    el.scrollHeight - el.scrollTop - el.clientHeight > 100
  );
  expect(awayFromBottom).toBe(true);
});

test("额度提示原位更新（tooltip 活更新，不重建）", async ({ page }) => {
  await page.route("**/api/chat", async (route) => {
    await page.waitForTimeout(500);
    await route.fulfill({
      status: 200,
      headers: { "content-type": "text/event-stream; charset=utf-8" },
      body: [
        'event: chat.stream.started\ndata: {"version":1,"providerId":"p-demo","reasoningKind":"thinking"}\n\n',
        'event: chat.content.delta\ndata: {"delta":"延迟回复，用于验证额度提示原位更新。"}\n\n',
        'event: chat.usage\ndata: {"inputTokens":24,"outputTokens":12,"totalTokens":36,"estimated":false}\n\n',
        'event: chat.stream.completed\ndata: {"finishReason":"stop"}\n\n'
      ].join("")
    });
  });
  await seedAndLoad(page);
  await page.goto("/");
  await page.fill("#composerInput", "占位");
  await page.click("#sendBtn");
  // hover 触发 tooltip（聚焦亦可），校验活更新
  await page.focus("#usageBtn");
  const tooltip = page.locator("#contextTooltip");
  await expect(tooltip).toHaveClass(/is-open/);
  const before = await tooltip.locator("[data-tooltip-usage]").textContent();
  await expect.poll(() => tooltip.locator("[data-tooltip-usage]").textContent(), { timeout: 8000 }).not.toBe(before);
  await expect(tooltip).toHaveClass(/is-open/);
});

test("额度提示：真实 token 与消息脚注一致，悬停只显示精简信息", async ({ page }) => {
  const conversation = seededConversation("conv-a", "对话甲");
  conversation.messages[1].usage = { inputTokens: 603, outputTokens: 3104, totalTokens: 3707, estimated: false };
  const state = {
    ...SEED_STATE,
    conversations: [conversation],
    activeConversationId: "conv-a"
  };
  await seedAndLoad(page, { state });
  await page.goto("/");
  await page.locator("#usageBtn").hover();
  const tooltip = page.locator("#contextTooltip");
  await expect(tooltip).toHaveClass(/is-open/);
  await expect(tooltip.locator("[data-tooltip-title]")).toHaveText("上下文用量");
  await expect(tooltip.locator("[data-tooltip-usage]")).toContainText("3707");
  await expect(page.locator('.message-entry.assistant .message-meta')).toContainText("3707 tokens");
  await expect(tooltip.locator(".context-tooltip-line").filter({ hasText: "历史与摘要" })).toHaveCount(0);
  await expect(tooltip.locator("[data-tooltip-hint]")).toHaveText("点击压缩历史");
  const info = await tooltip.locator("[data-tooltip-usage]").evaluate((el) => ({
    whiteSpace: getComputedStyle(el).whiteSpace,
    height: Math.round(el.getBoundingClientRect().height)
  }));
  expect(info.whiteSpace).toBe("nowrap");
  expect(info.height).toBeLessThan(24);

  for (const scheme of ["light", "dark"]) for (const width of [1280, 1024, 390]) {
    await page.setViewportSize({ width, height: 800 });
    await page.evaluate((appearanceMode) => localStorage.setItem("tribblebook-ui-preferences-v1", JSON.stringify({ themeId: "everforest", appearanceMode })), scheme);
    await page.reload();
    await page.locator("#usageBtn").hover();
    const layout = await page.locator("#contextTooltip").evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { pageFits: document.documentElement.scrollWidth <= innerWidth, left: rect.left, right: rect.right, viewport: innerWidth };
    });
    expect(layout.pageFits).toBe(true);
    expect(layout.left).toBeGreaterThanOrEqual(0);
    expect(layout.right).toBeLessThanOrEqual(layout.viewport);
  }
});

test("压缩上下文：点击直接压缩，按会话锁定发送，进度提示可回看", async ({ page }) => {
  await page.route("**/api/chat/compress", async (route) => {
    await page.waitForTimeout(900);
    await route.fulfill({
      status: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ summary: "这是压缩后的隐藏摘要。" })
    });
  });
  const state = {
    ...SEED_STATE,
    settingsSchemaVersion: 1,
    chatConfig: {},
    conversations: [{ ...seededConversation("conv-c", "压缩对话"), messages: [...seededConversation("conv-c", "压缩对话").messages, { id: "recent-user", role: "user", content: "另一轮历史" }, { id: "recent-assistant", role: "assistant", content: "最近回复" }] }],
    activeConversationId: "conv-c"
  };
  await seedAndLoad(page, { state });
  await page.goto("/");
  // 点击圆环直接压缩：无二级弹层与确认弹窗，按钮进入忙态
  await page.click("#usageBtn");
  await expect(page.locator("#usageBtn")).toHaveAttribute("aria-busy", "true");
  // 压缩提示 = 假模型响应出现在对话中，本对话发送被锁定
  await expect(page.locator(".compress-notice")).toHaveText(/正在压缩上下文/);
  await page.fill("#composerInput", "压缩期间尝试发送");
  await expect(page.locator("#sendBtn")).toBeDisabled();
  // 完成后：提示更新为完毕态，发送恢复，忙态解除
  await expect(page.locator(".compress-notice")).toHaveText(/上下文已压缩/, { timeout: 8000 });
  await expect(page.locator("#sendBtn")).toBeEnabled();
  await expect(page.locator("#usageBtn")).toHaveAttribute("aria-busy", "false");
  // 通知系统关闭后，点击提示卡不会再生成全局 Toast。
  await page.click(".compress-notice");
  await expect(page.locator(".toast-note")).toHaveCount(0);
});

test("主题明暗切换自动换色", async ({ page }) => {
  await seedAndLoad(page, { hash: "#/settings/appearance" });
  await page.goto("/");
  const pear = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--pear").trim());
  expect(pear).toBe("#93B259");
  const light = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim());
  expect(light).toBe("#93B259");
  // 默认主题为双态，明暗由 appearanceMode 切换。
  await page.locator(".appearance-mode-option").filter({ hasText: "深色" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-scheme", "dark");
  const dark = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim());
  expect(dark).toBe("#A7C080");
  const pearDark = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--pear").trim());
  expect(pearDark).toBe("#A7C080");
  // 代码框令牌也随明暗切换（独立暖调家族色）
  const codeBg = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--code-bg").trim());
  expect(codeBg).toBe("#202629");
});

test("设置：外观主题卡与自定义导入入口", async ({ page }) => {
  await seedAndLoad(page, { hash: "#/settings/appearance" });
  await page.goto("/");
  await expect(page.locator(".settings-pane-title")).toContainText("外观");
  // 首启种子只包含 Everforest。
  await expect(page.locator(".theme-card")).toHaveCount(1);
  await expect(page.locator(".theme-card").nth(0)).toHaveAttribute("data-theme-id", "everforest");
  // 稳定语义内容与选中状态（不依赖已删除的装饰性内部标签）
  const everforestCard = page.locator('[data-theme-id="everforest"]');
  await expect(everforestCard).toHaveAttribute("aria-pressed", "true");
  await expect(everforestCard).toHaveClass(/is-active/);
  await expect(everforestCard.locator(".theme-strip-name")).toHaveText("Everforest");
  await expect(everforestCard.locator(".theme-strip-status")).toContainText("当前主题");
  await expect(everforestCard).toHaveAttribute("aria-label", "Everforest，当前主题");
  await expect(page.locator("#themePackageImportBtn")).toHaveText(/导入主题/);
  await expect(page.locator("#themePackageExportBtn")).toHaveText(/导出/);
  // 明暗模式切换不改变当前主题 ID。
  await page.locator(".appearance-mode-option").filter({ hasText: "深色" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "everforest");
  await expect(page.locator("html")).toHaveAttribute("data-scheme", "dark");

  // 唯一默认主题保持自己的深色令牌，背景不再创建主题动效层。
  await expect(page.locator("html")).toHaveAttribute("data-theme", "everforest");
  await expect(page.locator("html")).toHaveAttribute("data-scheme", "dark");
  await expect(page.locator(".motion-layer")).toHaveCount(0);
  const everforestCanvas = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--canvas-mid").trim());
  expect(everforestCanvas).toBe("#232A2E");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "everforest");
});

test("主题背景动效已停用", async ({ page }) => {
  await seedAndLoad(page, { themeId: "everforest" });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "everforest");
  await expect(page.locator(".motion-layer")).toHaveCount(0);
  await expect(page.locator(".ambient-grain, .ambient-light")).toHaveCount(0);
  await expect(page.locator(".app-canvas")).toHaveCSS("background-image", "none");
});

test("Everforest 在减少动态模式下完全不创建动效层", async ({ page }) => {
  await seedAndLoad(page, { themeId: "everforest" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "everforest");
  await expect(page.locator(".motion-layer")).toHaveCount(0);
});

test("Everforest 窄屏安全回退：无横向溢出或素材遮挡", async ({ page }) => {
  await seedAndLoad(page, { themeId: "everforest" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "everforest");
  await expect(page.locator(".empty-card")).toBeVisible();
  await expect(page.locator(".composer-paper")).toBeVisible();
  const layout = await page.evaluate(() => {
    const card = document.querySelector(".empty-card").getBoundingClientRect();
    const composer = document.querySelector(".composer-paper").getBoundingClientRect();
    return {
      documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      viewportWidth: document.documentElement.clientWidth,
      card: { left: card.left, right: card.right, bottom: card.bottom },
      composerTop: composer.top
    };
  });
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.card.left).toBeGreaterThanOrEqual(0);
  expect(layout.card.right).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.card.bottom).toBeLessThanOrEqual(layout.composerTop);
});

test("JSON 主题文件：导出当前主题并重新导入应用", async ({ page }) => {
  await seedAndLoad(page, { hash: "#/settings/appearance" });
  await page.goto("/");
  await page.locator('[data-theme-id="everforest"]').click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "everforest");
  await expect(page.locator(".motion-layer")).toHaveCount(0);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#themePackageExportBtn").click()
  ]);
  expect(download.suggestedFilename()).toMatch(/\.json$/);
  const packagePath = await download.path();
  expect(packagePath).toBeTruthy();

  // 实际往返默认源码主题：同 ID 更新，不改变顺序。
  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.locator("#themePackageImportBtn").click()
  ]);
  await fileChooser.setFiles(packagePath);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "everforest");
  await expect(page.locator(".theme-card")).toHaveCount(1);
  await expect(page.locator(".theme-card").nth(0)).toHaveAttribute("data-theme-id", "everforest");
  await expect(page.locator(".motion-layer")).toHaveCount(0);
  // 同 ID 主题重新导入 = 更新（替换既有主题），且不会生成全局通知。
  await expect(page.locator(".toast-note")).toHaveCount(0);
});

test("主题 JSON：更新默认主题、重启恢复并删除自定义变体", async ({ page }) => {
  await seedAndLoad(page, { hash: "#/settings/appearance" });
  await page.goto("/");
  await expect(page.locator("#themePackageImportBtn")).toBeVisible();
  await expect(page.locator(".theme-card")).toHaveCount(1);

  const examplePath = path.resolve(__dirname, "../src/resources/themes/everforest-ai-chatbox-theme-v1.json");
  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.locator("#themePackageImportBtn").click()
  ]);
  await fileChooser.setFiles(examplePath);

  // Everforest 已是种子主题：同 ID 重新导入 = 更新（替换），卡数不变。
  await expect(page.locator(".theme-card")).toHaveCount(1);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "everforest");
  const accent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim());
  expect(accent).toBe("#93B259");
  const separator = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--separator").trim());
  expect(separator).toBe("rgba(92,106,114,0.18)");
  const effectTokens = await page.evaluate(() => ({
    overlay: getComputedStyle(document.documentElement).getPropertyValue("--overlay-scrim").trim(),
    group: getComputedStyle(document.documentElement).getPropertyValue("--group-color-5").trim()
  }));
  expect(effectTokens.overlay).toBe("#000000");
  expect(effectTokens.group).toBe("#000000");

  // buttons 模块：三类按钮令牌生效，主题包主操作底色跟随主题
  const buttonTokens = await page.evaluate(() => ({
    send: getComputedStyle(document.documentElement).getPropertyValue("--send-btn").trim(),
    primary: getComputedStyle(document.documentElement).getPropertyValue("--btn-primary").trim(),
    logo: getComputedStyle(document.documentElement).getPropertyValue("--brand-logo").trim(),
    icon: getComputedStyle(document.documentElement).getPropertyValue("--icon-btn-ink").trim()
  }));
  // 主题包 JSON 明确为按钮定义更深的绿色（#617D43 系列）保证白字对比度；
  // 主色 #93B259 只用于品牌标识与强调色。次要按钮背景跟随 surface-elevated。
  expect(buttonTokens.send).toBe("#617D43");
  expect(buttonTokens.primary).toBe("#617D43");
  expect(buttonTokens.logo).toBe("#93B259");
  expect(buttonTokens.icon).toBe("#73848A");
  await page.mouse.move(0, 0);
  await expect(page.locator("#themePackageImportBtn")).toHaveCSS("background-color", "rgb(240, 240, 232)");

  // 重启后从本机存储恢复
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "everforest");
  await expect(page.locator(".theme-card")).toHaveCount(1);

  // 不同 ID 的主题文件会新建主题（同一 ID 才是更新）
  const variantPath = path.join(os.tmpdir(), `everforest-variant-${Date.now()}.json`);
  const variant = JSON.parse(readFileSync(examplePath, "utf8"));
  variant.theme.id = "everforest-variant";
  variant.theme.label = "Everforest · 变体";
  writeFileSync(variantPath, JSON.stringify(variant));
  const [variantChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.locator("#themePackageImportBtn").click()
  ]);
  await variantChooser.setFiles(variantPath);
  await expect(page.locator(".theme-card")).toHaveCount(2);

  // 删除变体主题：回落到 Everforest 默认主题。
  await page.locator('[data-theme-remove="everforest-variant"]').click();
  await expect(page.locator(".dialog-backdrop")).toBeVisible();
  await page.locator(".dialog-backdrop [data-role='confirm']").click();
  await expect(page.locator(".theme-card")).toHaveCount(1);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "everforest");
});

test("主题界面字体：导入 typefaces 主题后字体令牌生效，删除后恢复默认", async ({ page }) => {
  await seedAndLoad(page, { hash: "#/settings/appearance" });
  await page.goto("/");
  const fontThemePath = path.join(os.tmpdir(), `ai-chatbox-font-theme-${Date.now()}.json`);
  const fontTheme = {
    format: "clawbox-theme",
    version: 2,
    id: "fonttrial",
    name: "圆体测试",
    typefaces: { body: "rounded", display: "songti", mono: "mono" },
    colors: {
      light: { canvas: { middle: "#f4f8f9" } },
      dark: { canvas: { middle: "#0f1b26" } }
    }
  };
  writeFileSync(fontThemePath, JSON.stringify(fontTheme));
  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.locator("#themePackageImportBtn").click()
  ]);
  await fileChooser.setFiles(fontThemePath);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "fonttrial");
  const fontTokens = await page.evaluate(() => ({
    body: getComputedStyle(document.documentElement).getPropertyValue("--font-body").trim(),
    display: getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim(),
    mono: getComputedStyle(document.documentElement).getPropertyValue("--font-code").trim()
  }));
  expect(fontTokens.body).toContain("Yuanti SC");
  expect(fontTokens.display).toContain("Songti SC");
  expect(fontTokens.mono).toContain("SF Mono");
  // 删除主题回落 Everforest，字体回到默认衬线体系。
  await page.locator('[data-theme-remove="fonttrial"]').click();
  await page.locator(".dialog-backdrop [data-role='confirm']").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "everforest");
  const restored = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--font-body").trim());
  expect(restored).toContain("New York");
});

test("外观：纯色背景、对比度与透景模式", async ({ page }) => {
  await seedAndLoad(page, { hash: "#/settings/appearance" });
  await page.goto("/");

  await expect(page.locator("#bgUploadBtn")).toHaveCount(0);
  await expect(page.locator(".user-bg-layer")).toHaveCount(0);
  await expect(page.locator(".motion-layer")).toHaveCount(0);
  await expect(page.locator("#appearanceContrastRange")).toHaveValue("60");
  await expect(page.locator("#appearanceTransparentToggle")).toHaveAttribute("aria-checked", "false");
  await expect(page.locator(".app-canvas")).toHaveCSS("background-image", "none");

  const before = await page.evaluate(() =>
    document.documentElement.style.getPropertyValue("--appearance-panel-bg"));
  await page.locator("#appearanceContrastRange").evaluate((element) => {
    element.value = "30";
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await expect(page.locator("#appearanceContrastValue")).toHaveText("30");
  const after = await page.evaluate(() =>
    document.documentElement.style.getPropertyValue("--appearance-panel-bg"));
  expect(after).not.toBe(before);

  await page.locator("#appearanceTransparentToggle").click();
  await expect(page.locator("html")).toHaveClass(/transparency-mode/);
  await expect(page.locator("#appearanceTransparentToggle")).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".paper-panel").first()).toHaveCSS("backdrop-filter", "blur(12.8px) saturate(1.22)");
  await page.reload();
  await expect(page.locator("#appearanceContrastRange")).toHaveValue("30");
  await expect(page.locator("html")).toHaveClass(/transparency-mode/);

  await page.locator("#appearanceTransparentToggle").click();
  await expect(page.locator("html")).not.toHaveClass(/transparency-mode/);
  await expect(page.locator(".paper-panel").first()).toHaveCSS("backdrop-filter", "none");
});

test("设置：供应商表单与 Key 加密提示", async ({ page }) => {
  await seedAndLoad(page, { hash: "#/settings/providers" });
  await page.goto("/");
  await expect(page.locator(".provider-item")).toHaveCount(1);
  await page.click("#newProviderBtn");
  await expect(page.getByRole("dialog", { name: "添加供应商" })).toBeVisible();
  await expect(page.locator('[data-preset="preset-test-responses"]')).toHaveCount(0);
  await page.locator('[data-preset="blank-responses"]').click();
  await expect(page.locator("#pf-url")).toHaveValue("");
  await expect(page.locator("#pf-key")).toBeVisible();
});

test("设置：仅保存模型额度，模型改名迁移默认项", async ({ page }) => {
  let submittedBody = null;
  await page.route("**/api/providers", async (route) => {
    if (route.request().method() !== "PUT") {
      return route.fulfill({ contentType: "application/json", body: JSON.stringify({ providers: [] }) });
    }
    submittedBody = route.request().postDataJSON();
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, provider: { ...submittedBody, id: "p-demo", hasKeyConfigured: false } })
    });
  });
  const state = {
    ...SEED_STATE,
    providers: [{ ...SEED_STATE.providers[0], hasKeyConfigured: false }]
  };
  await seedAndLoad(page, { state, hash: "#/settings/providers" });
  await page.goto("/");

  await expect(page.getByRole("button", { name: /供应商高级设置/ })).toHaveCount(0);
  const editModelButton = page.locator('[data-model-row="demo-model"] [aria-label="编辑模型"]');
  await editModelButton.click();
  const dialog = page.getByRole("dialog", { name: "编辑模型配置" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("#model-id")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(editModelButton).toBeFocused();
  await editModelButton.click();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("#model-id")).toHaveValue("demo-model");
  await expect(dialog.locator("#model-maxTokens")).toBeDisabled();
  await expect(dialog.locator("#model-temperature")).toHaveCount(0);
  await expect(dialog.locator("#pf-system")).toHaveCount(0);

  await expect(dialog.locator("#model-temperature")).toHaveCount(0);
  await expect(dialog.locator("#model-imageOutput")).toHaveCount(0);
  await dialog.locator("#model-id").fill("demo-renamed");
  const outputField = dialog.locator(".provider-model-field").filter({ hasText: "最大输出 Token" });
  await outputField.locator("input[type='checkbox']").uncheck();
  await outputField.locator("input[type='number']").fill("4096");
  await dialog.getByRole("button", { name: "保存更改" }).click();

  await expect(page.locator('[data-model-row="demo-renamed"] .provider-model-summary')).toHaveAttribute("title", /最大输出 4.1K.*默认模型/);

  await expect(page.locator("#pf-system")).toHaveCount(0);
  await expect(page.locator("#pf-user")).toHaveCount(0);
  await expect(page.locator("#model-temperature")).toHaveCount(0);
  await expect(page.locator("#pf-save")).toHaveCount(0);

  await expect.poll(() => submittedBody?.defaultModel).toBe("demo-renamed");
  expect(submittedBody.models).toEqual(["demo-renamed", "demo-pro"]);
  expect(submittedBody.modelOverrides).toEqual({ "demo-renamed": { maxTokens: 4096 } });
  expect(submittedBody.modelCapabilities["demo-renamed"]).toBeUndefined();
  expect(submittedBody.modelCapabilities["demo-model"]).toBeUndefined();
  expect(submittedBody.systemPrompt).toBe("");
  expect(submittedBody.settingsSchemaVersion).toBe(1);
  await expect(page.locator(".provider-auto-state")).toContainText("已保存");
});

test("聊天模型选择器隐藏禁用供应商，但设置中仍显示其状态", async ({ page }) => {
  const disabled = {
    ...SEED_STATE.providers[0],
    id: "p-disabled",
    displayName: "已禁用供应商",
    enabled: false,
    defaultModel: "disabled-model",
    models: ["disabled-model"]
  };
  const state = { ...SEED_STATE, providers: [SEED_STATE.providers[0], disabled] };
  await seedAndLoad(page, { state });
  await page.goto("/");
  await page.locator("#runtimeBtn").click();
  await page.click('[data-runtime-open="model"]');
  await expect(page.locator(".runtime-popover .popover-scroll")).toContainText("示例供应商");
  await expect(page.locator(".runtime-popover .popover-scroll")).not.toContainText("已禁用供应商");
  await page.keyboard.press("Escape");

  await page.locator('.sidebar-settings').click();
  await page.locator('[data-section="providers"]').click();
  await expect(page.locator('[data-edit-provider="p-disabled"]')).toContainText("已禁用");
});

test("历史会话绑定的供应商已删除时保持只读，重新选择模型后才能发送", async ({ page }) => {
  const conversation = {
    ...seededConversation("deleted-provider-conversation", "已删除供应商"),
    providerId: "p-deleted",
    providerSnapshot: {
      displayName: "已删除供应商",
      baseUrl: "https://deleted.example/v1",
      responseFormat: "responses",
      defaultModel: "deleted-model",
      contextWindow: 131072,
      maxTokens: 8192
    },
    model: "deleted-model"
  };
  const state = {
    ...SEED_STATE,
    activeConversationId: conversation.id,
    conversations: [conversation]
  };
  await seedAndLoad(page, { state });
  await page.goto("/");

  await page.locator("#composerInput").fill("继续发送");
  await expect(page.locator("#sendBtn")).toBeDisabled();
  await page.locator("#runtimeBtn").click();
  await page.click('[data-runtime-open="model"]');
  await page.locator('[data-provider-id="p-demo"][data-model="demo-model"]').click();
  await expect(page.locator("#sendBtn")).toBeEnabled();
});

test("设置：新 Key 继续按原请求同步后端，并只留下前端密文", async ({ page }) => {
  const originalKey = "sk-new-provider-secret";
  let submittedKey = null;
  await page.route("**/api/providers/key", async route => {
    if (route.request().method() === "PUT") submittedKey = route.request().postDataJSON().apiKey;
    await route.fulfill({ json: { ok: true, apiKey: submittedKey || "", hasKeyConfigured: Boolean(submittedKey) } });
  });
  let submittedBody = null;
  await page.route("**/api/providers/test", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ ok: true, models: ["demo-model"] })
  }));
  await page.route("**/api/providers", async (route) => {
    if (route.request().method() !== "PUT") {
      return route.fulfill({ contentType: "application/json", body: JSON.stringify({ providers: [] }) });
    }
    submittedBody = route.request().postDataJSON();
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        provider: {
          ...submittedBody,
          id: "encrypted-new-provider",
          hasKeyConfigured: true
        }
      })
    });
  });
  await seedAndLoad(page, { hash: "#/settings/providers" });
  await page.goto("/");
  await page.locator("#newProviderBtn").click();
  await page.locator('[data-preset="blank-responses"]').click();
  await page.locator("#pf-name").fill("加密测试供应商");
  await page.locator("#pf-url").fill("https://api.example.com/v1");
  await page.locator("#pf-models-fetch").click();
  await expect(page.locator('[data-model-row="demo-model"]')).toBeVisible();
  await page.locator("#pf-key").fill(originalKey);
  await expect(page.locator("#pf-save")).toHaveCount(0);

  await expect(page.locator(".provider-item").filter({ hasText: "加密测试供应商" })).toBeVisible();
  await expect.poll(() => submittedKey || submittedBody?.apiKey).toBe(originalKey);
  await expect.poll(() => readProviderVaultJson(page)).toContain("ciphertext");
  const vaultJson = await readProviderVaultJson(page);
  expect(vaultJson).not.toContain(originalKey);
  const persistedStorage = await page.evaluate(() => JSON.stringify(Object.fromEntries(
    Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
      .filter(Boolean)
      .map((key) => [key, localStorage.getItem(key)])
  )));
  expect(persistedStorage).not.toContain(originalKey);
});

test("设置：Key 在防抖窗口内离开页面仍会先完成自动同步", async ({ page }) => {
  const immediateKey = "sk-sync-before-navigation";
  let putBody = null;
  await page.route("**/api/providers/key*", async (route) => {
    if (route.request().method() === "PUT") {
      putBody = route.request().postDataJSON();
      return route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, hasKeyConfigured: true }) });
    }
    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "not configured" }) });
  });
  const state = { ...SEED_STATE, providers: [{ ...SEED_STATE.providers[0], hasKeyConfigured: false }] };
  await seedAndLoad(page, { state, hash: "#/settings/providers" });
  await page.goto("/");

  await page.locator("#pf-key").fill(immediateKey);
  await page.locator('[data-section="tools"]').click();
  await expect(page.locator("[data-extension-card='tool']")).toBeVisible();
  await expect.poll(() => putBody?.apiKey).toBe(immediateKey);
  expect(putBody.id).toBe("p-demo");
});

test("设置：Key 强制同步失败时保留当前页面与未同步输入", async ({ page }) => {
  const pendingKey = "sk-must-not-be-lost";
  await page.route("**/api/providers/key*", async (route) => {
    if (route.request().method() === "PUT") {
      return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "temporary unavailable" }) });
    }
    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "not configured" }) });
  });
  const state = { ...SEED_STATE, providers: [{ ...SEED_STATE.providers[0], hasKeyConfigured: false }] };
  await seedAndLoad(page, { state, hash: "#/settings/providers" });
  await page.goto("/");

  await page.locator("#pf-key").fill(pendingKey);
  await page.locator('[data-section="tools"]').click();

  await expect(page.locator("#pf-key")).toHaveValue(pendingKey);
  await expect(page).toHaveURL(/#\/settings\/providers\/p-demo$/);
  await expect(page.locator("#toast")).toHaveCount(0);
});

test("设置：已保存 Key 进入即显示等长密文，变更自动同步且不再提供清除按钮", async ({ page }) => {
  const originalKey = "sk-original-visible-key";
  const changedKey = "sk-changed-automatically";
  let backendRevealCount = 0;
  let putBody = null;
  let deleteBody = null;
  await page.route("**/api/providers/key*", (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      backendRevealCount += 1;
      return route.fulfill({
        status: 200,
        headers: { "cache-control": "no-store" },
        contentType: "application/json",
        body: JSON.stringify({ ok: true, apiKey: originalKey })
      });
    }
    if (request.method() === "PUT") {
      putBody = request.postDataJSON();
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, hasKeyConfigured: true })
      });
    }
    deleteBody = request.postDataJSON();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, removed: true })
    });
  });
  await seedAndLoad(page, { hash: "#/settings/providers" });
  await page.goto("/");
  await page.locator(".provider-item").first().click();

  const input = page.locator("#pf-key");
  const visibility = page.locator("#pf-key-visibility");
  await expect(input).toHaveAttribute("type", "password");
  await expect(input).toHaveValue(originalKey);
  await expect(page.locator("#pf-key-clear")).toHaveCount(0);
  expect(backendRevealCount).toBe(1);

  // 初始状态已是等长密文，点击显示只切换当前输入框的显示模式，不再请求后端。
  await visibility.click();
  await expect(input).toHaveAttribute("type", "text");
  await expect(input).toHaveValue(originalKey);
  expect(backendRevealCount).toBe(1);

  await input.fill(changedKey);
  await expect.poll(() => putBody?.apiKey, { timeout: 5000 }).toBe(changedKey);
  expect(putBody.id).toBe("p-demo");
  await expect(input).toHaveAttribute("aria-busy", "false");
  const changedVaultJson = await readProviderVaultJson(page);
  expect(changedVaultJson).toContain("ciphertext");
  expect(changedVaultJson).not.toContain(changedKey);

  // 清空输入也属于 Key 变更：沿用后端删除接口，不需要单独的清除按钮。
  await input.fill("");
  await expect.poll(() => deleteBody?.id, { timeout: 5000 }).toBe("p-demo");
  await expect(page.locator("#pf-key-clear")).toHaveCount(0);

  const vaultJson = await readProviderVaultJson(page);
  expect(vaultJson).not.toContain(originalKey);
  expect(vaultJson).not.toContain(changedKey);

  await visibility.click();
  await expect(input).toHaveAttribute("type", "password");
  await page.locator('[data-section="tools"]').click();
  await page.locator('[data-section="providers"]').click();
  await expect(page.locator("#pf-key")).toHaveValue("");
  expect(backendRevealCount).toBe(1);
});

test("设置内部编辑页：离开设置后重新打开供应商时不恢复过期编辑层", async ({ page }) => {
  await seedAndLoad(page, { hash: "#/settings/providers" });
  await page.goto("/");

  await page.locator(".provider-item").first().click();
  await expect(page.locator("#pf-name")).toBeVisible();

  await page.locator('.stage-header [data-nav="chat"]').click();
  await expect(page.locator("#page-chat")).toHaveClass(/page-active/);
  await page.locator('.sidebar-settings').click();
  await page.locator('[data-section="providers"]').click();

  await expect(page.locator(".provider-item")).toHaveCount(1);
  await expect(page.locator("#pf-name")).toBeVisible();
  await expect(page.locator(".provider-model-dialog")).toHaveCount(0);
  await expect(page.locator(".provider-auto-state")).toContainText("已保存");

  await page.locator('[data-section="tools"]').click();
  await page.locator('[data-extension-new="tool"]').click();
  await expect(page.locator("#extensionSaveBtn")).toBeVisible();
  await page.locator('.stage-header [data-nav="chat"]').click();
  await page.locator('.sidebar-settings').click();
  await page.locator('[data-section="tools"]').click();
  await expect(page.locator("#extensionSaveBtn")).toHaveCount(0);
  await expect(page.locator("[data-extension-card='tool']")).toBeVisible();
});

test("设置内切换边栏条目：清理旧的二级编辑状态", async ({ page }) => {
  await seedAndLoad(page, { hash: "#/settings/providers" });
  await page.goto("/");

  await page.locator(".provider-item").first().click();
  await expect(page.locator("#pf-name")).toBeVisible();

  await page.locator('[data-section="tools"]').click();
  await expect(page.locator("#extensionSaveBtn")).toHaveCount(0);
  await expect(page.locator("[data-extension-card='tool']")).toBeVisible();
  await expect(page.locator("#pf-name")).toHaveCount(0);

  await page.locator('[data-section="providers"]').click();
  await expect(page.locator(".provider-item")).toBeVisible();
  await expect(page.locator("#pf-name")).toBeVisible();
  await expect(page.locator(".provider-model-dialog")).toHaveCount(0);
});

test("移动端供应商导航：返回设置后停留在供应商一级列表", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedAndLoad(page, { hash: "#/settings/providers" });
  await page.goto("/");

  await expect(page.locator(".provider-item")).toHaveCount(1);
  await expect(page.locator("#pf-name")).toHaveCount(0);
  await page.locator(".provider-item").first().click();
  await expect(page.locator("#pf-name")).toBeVisible();
  await page.locator("[data-settings-back]").click();
  await expect(page).toHaveURL(/#\/settings\/providers$/);
  await expect(page.locator("#pf-name")).toHaveCount(0);
  await expect(page.locator(".provider-item")).toHaveCount(1);
});

test("浏览器旧状态：清除历史 demo 供应商并保留会话快照", async ({ page }) => {
  const testProvider = {
    ...SEED_STATE.providers[0],
    id: "test-responses",
    displayName: "测试供应商 · Responses API",
    baseUrl: "https://api.test-chatbox.florasunshina.io/v1",
    responseFormat: "responses",
    defaultModel: "test-1",
    models: ["test-1", "test-2"]
  };
  const demoProviders = [
    ["demo-openai-compatible", "示例 · OpenAI Chat Completions", "https://api.example.com/v1"],
    ["demo-responses", "示例 · OpenAI Responses", "https://api.openai.com/v1"],
    ["demo-anthropic", "示例 · Anthropic Messages", "https://api.anthropic.com/v1"],
    ["demo-google", "示例 · Google Gemini", "https://generativelanguage.googleapis.com/v1beta"]
  ].map(([id, displayName, baseUrl]) => ({ ...SEED_STATE.providers[0], id, displayName, baseUrl }));
  const conversation = {
    ...seededConversation("legacy-demo", "历史示例会话"),
    providerId: "demo-openai-compatible",
    providerSnapshot: {
      displayName: "示例 · OpenAI Chat Completions",
      baseUrl: "https://api.example.com/v1",
      responseFormat: "openai-compatible"
    }
  };
  await seedAndLoad(page, {
    hash: "#/settings/providers",
    state: {
      ...SEED_STATE,
      providers: [...demoProviders, testProvider],
      activeProviderId: "demo-openai-compatible",
      conversations: [conversation],
      activeConversationId: conversation.id
    }
  });
  await page.goto("/");

  await expect(page.locator(".provider-item")).toHaveCount(0);
  await expect(page.locator(".conversation-item")).toContainText("历史示例会话");
  await expect.poll(() => page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("tribblebook-v6-state") || "{}");
    return {
      providerIds: (state.providers || []).map((provider) => provider.id),
      activeProviderId: state.activeProviderId
    };
  })).toEqual({ providerIds: [], activeProviderId: "" });
});

test("数据迁移：浏览器环境显示明确的不可用状态", async ({ page }) => {
  await seedAndLoad(page, { hash: "#/settings/data" });
  await page.goto("/");
  // 版本与运行环境信息归“关于与更新”页：数据页只验证迁移、导入与兼容行为
  await expect(page.locator(".migration-card")).toBeVisible();
  await expect(page.locator(".migration-status-badge")).toHaveText("不可用");
  await expect(page.locator(".migration-card")).toContainText("迁移仅适用于打包后的 ai-chatbox macOS 桌面版");
  await expect(page.locator("#migrationCreateBtn")).toBeDisabled();
});

test("数据迁移：桌面普通版创建前警告敏感数据并允许取消保存", async ({ page }) => {
  await page.addInitScript(() => {
    window.__migrationCalls = [];
    window.clawbox = {
      backendBase: "",
      apiToken: "",
      migration: {
        getStatus: async () => ({
          available: true,
          reason: "",
          dataLocation: "/Users/test/Library/Application Support/.clawbox/UserData",
          encryption: "AES-128-GCM",
          keyBits: 128,
          lastResult: null
        }),
        createPackage: async () => {
          window.__migrationCalls.push("create");
          return { cancelled: true, restarting: false };
        },
        revealLastResult: async () => true
      }
    };
  });
  await seedAndLoad(page, { hash: "#/settings/data" });
  await page.goto("/");
  await expect(page.locator(".migration-status-badge")).toHaveText("可以迁移");
  await expect(page.locator(".migration-location")).toContainText("Application Support/.clawbox/UserData");
  await expect(page.locator(".migration-card")).toContainText("key.md");
  await expect(page.locator(".migration-route-node").first()).toHaveClass(/is-active/);
  await page.locator("#migrationCreateBtn").click();
  await expect(page.locator(".dialog-card")).toContainText("AES-128-GCM");
  await expect(page.locator(".dialog-card")).toContainText("key.md");
  await expect(page.locator(".dialog-card [data-role='confirm']")).toHaveText("导出并重启");
  await page.locator(".dialog-card [data-role='confirm']").click();
  await expect.poll(() => page.evaluate(() => window.__migrationCalls)).toEqual(["create"]);
  await expect(page.locator("#migrationCreateBtn")).toBeEnabled();
});

test("更新日志时间线", async ({ page }) => {
  await seedAndLoad(page, { hash: "#/settings/changelog" });
  await page.goto("/");
  // 侧栏已无版本号；changelog 路由归一到“关于与更新”，版本信息在该页呈现
  await expect(page.locator(".sidebar-version")).toHaveCount(0);
  await expect(page.locator(".settings-pane-title").filter({ hasText: "关于与更新" })).toBeVisible();
  await expect(page.locator(".usage-stat").filter({ hasText: "版本" })).toContainText(`v${APP_VERSION}`);
  await expect(page.locator(".usage-stat").filter({ hasText: "版本" })).toContainText("补丁包");
  await expect(page.locator(".usage-stat").filter({ hasText: "运行环境" })).toContainText("浏览器");
  await page.locator(".ui-disclosure > summary").click();
  // 发布记录时间线：展开后当前版本卡片在前，历史版本随后
  const cards = page.locator(".release-card");
  await expect(cards.first()).toContainText("当前版本");
  await expect(cards.first()).toContainText(`v${CURRENT_RELEASE.displayVersion}`);
  await expect(cards.first()).toContainText("补丁包");
  await expect(cards.first()).toContainText(CURRENT_RELEASE.title);
  // 发布条目以 changelog 数据源为权威，不在测试里复制过期文案
  for (const change of CURRENT_RELEASE.changes) {
    await expect(cards.first()).toContainText(change.text);
  }
  await expect(cards.first().locator(".release-list li")).toHaveCount(CURRENT_RELEASE.changes.length);
  // 历史版本卡片按数据源新到旧排列
  for (const [index, note] of RELEASE_NOTES.entries()) {
    await expect(cards.nth(index + 1)).toContainText(note.title);
  }
  await expect(cards).toHaveCount(1 + RELEASE_NOTES.length);
});

test("快捷键：⌘K 聚焦搜索、⌘N 新建、Esc 关闭浮层", async ({ page }) => {
  await seedAndLoad(page);
  await page.goto("/");
  await page.keyboard.press("Meta+k");
  await expect(page.locator("#searchInput")).toBeFocused();
  await page.keyboard.press("Meta+n");
  await expect(page.locator(".empty-stage")).toBeVisible();
  await page.click("#runtimeBtn");
  await page.click('[data-runtime-open="model"]');
  const modelPopover = page.locator(".runtime-popover");
  await expect(modelPopover).toBeVisible();
  await expect(modelPopover.locator(".option-item")).toHaveCount(2);
  await expect(modelPopover.locator(".popover-scroll")).not.toContainText(",");
  await page.keyboard.press("Escape");
  await expect(page.locator(".popover-card")).toHaveCount(0);
});

test("移动端 720px：底部导航与触控热区", async ({ page }) => {
  await seedAndLoad(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".mobile-nav")).toBeVisible();
  await expect(page.locator(".mode-rail")).toBeHidden();
  const box = await page.locator("#sendBtn").boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
  await page.click('.mobile-nav-item[data-nav="settings"]');
  await expect(page.locator("#page-settings")).toHaveClass(/page-active/);
});

test("移动端设置：离开二级页面后重新进入显示设置目录", async ({ page }) => {
  await seedAndLoad(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const settingsNav = page.locator('.mobile-nav-item[data-nav="settings"]');
  const settingsDetail = page.locator("#app");

  await settingsNav.click();
  await expect(page.locator("#page-settings")).toHaveClass(/page-active/);
  await expect(settingsDetail).not.toHaveAttribute("data-settings-detail", "open");
  // 设置分类索引：外观等分类全部可见（不假设外观隐藏或供应商默认激活）
  await expect(page.locator("#settingsIndex")).toBeVisible();
  await expect(page.locator("[data-section='appearance']")).toBeVisible();
  await expect(page.locator("[data-section='providers']")).toBeVisible();
  expect(await page.evaluate(() => location.hash)).toBe("#/settings");

  // 分类进入 → 详情视图
  await page.click("[data-section='appearance']");
  await expect(settingsDetail).toHaveAttribute("data-settings-detail", "open");
  await expect(page.locator(".settings-pane-title")).toHaveText("外观");
  expect(await page.evaluate(() => location.hash)).toBe("#/settings/appearance");

  // 二级页面的返回按钮应回到一级目录，而不是只依赖主导航切换。
  await page.click("[data-settings-back]");
  await expect(settingsDetail).not.toHaveAttribute("data-settings-detail", "open");
  await expect(page.locator("#settingsIndex")).toBeVisible();

  await page.click("[data-section='providers']");
  await expect(settingsDetail).toHaveAttribute("data-settings-detail", "open");
  await expect(page.locator(".settings-pane-title")).toHaveText("模型与供应商");
  // 详情是推入式全屏（自带返回按钮）：回到索引后底部导航才重新可达
  await page.click("[data-settings-back]");
  await expect(settingsDetail).not.toHaveAttribute("data-settings-detail", "open");
  await page.locator('.mobile-nav-item[data-nav="chat"]').click();
  await expect(page.locator("#page-chat")).toHaveClass(/page-active/);

  await settingsNav.click();
  await expect(page.locator("#page-settings")).toHaveClass(/page-active/);
  await expect(settingsDetail).not.toHaveAttribute("data-settings-detail", "open");
  await expect(page.locator("#settingsIndex")).toBeVisible();
});

test("滚动所有权：上滑后出现「有新回复」", async ({ page }) => {
  // route.fulfill 会一次性送达全部字节；这里在页面内替换 fetch，
  // 用 ReadableStream 逐帧推送 SSE，模拟真实增量流。
  await page.addInitScript(() => {
    const originalFetch = window.fetch;
    window.fetch = async (input, init) => {
      const url = String(input instanceof Request ? input.url : input);
      if (!url.includes("/api/chat")) return originalFetch(input, init);
      const frames = [
        'event: chat.stream.started\ndata: {"version":1,"providerId":"test","reasoningKind":"thinking"}\n\n'
      ];
      for (let i = 0; i < 70; i += 1) {
        frames.push(
          `event: chat.content.delta\ndata: {"delta":"第 ${i} 行：长回复正在持续生成，用来撑开滚动区域。\\n"}\n\n`
        );
      }
      frames.push('event: chat.stream.completed\ndata: {"finishReason":"stop"}\n\n');
      const encoder = new TextEncoder();
      let index = 0;
      const stream = new ReadableStream({
        start(controller) {
          const push = () => {
            if (index < frames.length) {
              controller.enqueue(encoder.encode(frames[index]));
              index += 1;
              setTimeout(push, 20);
            } else {
              controller.close();
            }
          };
          setTimeout(push, 40);
        }
      });
      return new Response(stream, {
        status: 200,
        headers: { "content-type": "text/event-stream; charset=utf-8" }
      });
    };
  });

  await seedAndLoad(page);
  await page.goto("/");
  await page.fill("#composerInput", "写长文");
  await page.click("#sendBtn");
  // 等消息区真正溢出再上滑（过早上滑滚不动，不会离开底部）
  await page.waitForFunction(() => {
    const el = document.querySelector("#messageScroll");
    return el && el.scrollHeight > el.clientHeight + 120;
  });
  const scrollBox = await page.locator("#messageScroll").boundingBox();
  await page.mouse.move(scrollBox.x + scrollBox.width / 2, scrollBox.y + scrollBox.height / 2);
  await page.mouse.wheel(0, -1600);
  await expect(page.locator("#newRepliesBtn")).toBeVisible({ timeout: 8000 });
  await page.click("#newRepliesBtn");
  await expect(page.locator("#newRepliesBtn")).toBeHidden();
});

test("折叠断点 1040：抽屉转为覆盖层，开关可用", async ({ page }) => {
  await seedAndLoad(page);
  await page.setViewportSize({ width: 900, height: 700 });
  await page.goto("/");
  await expect(page.locator("#appShell")).toHaveAttribute("data-archives", "rail");
  await expect(page.locator("#railExpandBtn")).toBeVisible();
  await page.click("#railExpandBtn");
  await expect(page.locator("#archiveDrawer")).toHaveClass(/drawer-open/);
  await page.click("#drawerScrim");
  await expect(page.locator("#archiveDrawer")).not.toHaveClass(/drawer-open/);
});

test("旧主题偏好迁移：cream-night → 深色", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("tribblebook-ui-preferences-v1", JSON.stringify({
      themeFamily: "cream-night",
      appearanceMode: "system"
    }));
  });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "everforest");
  await expect(page.locator("html")).toHaveAttribute("data-scheme", "dark");
});

const SEED_WITH_HISTORY = {
  ...SEED_STATE,
  conversations: [
    {
      id: "conv-hist",
      title: "历史对话",
      createdAt: Date.now() - 3600_000,
      updatedAt: Date.now() - 3600_000,
      pinned: false,
      providerId: "p-demo",
      providerSnapshot: { displayName: "示例供应商", baseUrl: "https://api.example.com/v1", responseFormat: "openai-compatible", defaultModel: "demo-model", contextWindow: 131072, maxTokens: 8192 },
      model: "demo-model",
      reasoningEffort: "medium",
      contextCompression: null,
      messages: [{ id: "m1", role: "user", content: "历史消息", createdAt: Date.now() - 3600_000 }],
      draft: ""
    }
  ],
  activeConversationId: "conv-hist"
};

test("会话 ⋮ 菜单：重命名对话框可交互（二级界面修复）", async ({ page }) => {
  await seedAndLoad(page, { state: SEED_WITH_HISTORY });
  await page.goto("/");
  await page.hover(".conversation-item");
  await page.click('[data-conv-action="menu"]');
  await expect(page.getByRole("menuitem", { name: "重命名", exact: true })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "移至项目", exact: true })).toBeVisible();
  await page.click('[data-menu-action="rename"]');
  await expect(page.locator(".dialog-backdrop")).toBeVisible();
  // 对话框内可点击、可输入、可确认（pointer-events 修复的直接验证）
  await page.fill(".dialog-input", "新名字");
  await page.click('[data-role="confirm"]');
  await expect(page.locator(".dialog-backdrop")).toHaveCount(0);
  await expect(page.locator(".conversation-item .conv-title")).toHaveText("新名字");
  // 二级界面关闭后主界面仍可用
  await expect(page.locator("#composerInput")).toBeVisible();
});

test("会话 ⋮ 菜单：置顶与删除入口存在", async ({ page }) => {
  await seedAndLoad(page, { state: SEED_WITH_HISTORY });
  await page.goto("/");
  await page.hover(".conversation-item");
  await page.click('[data-conv-action="menu"]');
  await expect(page.locator('[data-menu-action="pin"]')).toContainText("置顶");
  await expect(page.locator('[data-menu-action="export"]')).toContainText("导出");
  await expect(page.locator('[data-menu-action="delete"]')).toContainText("删除");
});

test("新建待发送对话：发言前不加入历史且重复点击不堆积", async ({ page }) => {
  await seedAndLoad(page);
  await page.goto("/");
  await expect(page.locator(".conversation-item")).toHaveCount(0);
  await page.click("#newConversationBtn");
  await page.click("#newConversationBtn");
  await expect(page.locator(".conversation-item")).toHaveCount(0);
  // 从已有历史打开临时会话，已有记录保留
  await seedAndLoad(page, { state: SEED_WITH_HISTORY });
  await page.goto("/");
  await expect(page.locator(".conversation-item")).toHaveCount(1);
  await page.click("#newConversationBtn");
  await expect(page.locator(".conversation-item")).toHaveCount(1);
});

test("归档栏收回/展开（桌面）", async ({ page }) => {
  await seedAndLoad(page);
  await page.goto("/");
  await expect(page.locator("#archiveDrawer")).toBeVisible();
  await page.click("#archivesCollapseBtn");
  await expect(page.locator("#appShell")).toHaveAttribute("data-archives", "collapsed");
  await expect(page.locator("#archiveDrawer")).toBeHidden();
  // 收回后工具条出现展开开关
  await page.click("#railExpandBtn");
  await expect(page.locator("#appShell")).toHaveAttribute("data-archives", "full");
  await expect(page.locator("#archiveDrawer")).toBeVisible();
});

test("设置页隐藏「目录」归档边栏", async ({ page }) => {
  await seedAndLoad(page);
  await page.goto("/");
  await expect(page.locator("#archiveDrawer")).toBeVisible();
  await page.click('[data-nav="settings"]');
  await expect(page.locator("#page-settings")).toHaveClass(/page-active/);
  await expect(page.locator("#archiveDrawer")).toBeHidden();
  await page.click('[data-nav="chat"]');
  await expect(page.locator("#archiveDrawer")).toBeVisible();
});

test("设置：工具与 Skill 独立入口，启用后全局持续生效", async ({ page }) => {
  await seedAndLoad(page, { hash: "#/settings/extensions" });
  await page.goto("/");
  await expect(page).toHaveURL(/#\/settings\/tools$/);
  await expect(page.locator("[data-section='tools']")).toHaveClass(/is-active/);
  await expect(page.locator("[data-extension-card]")).toHaveCount(1);
  // 扩展页统一使用当前中文名称
  await expect(page.locator("[data-extension-card='tool']")).toContainText("自定义工具");
  await expect(page.locator("[data-extension-capability]")).toContainText("当前仅可管理配置");
  await expect(page.locator("[data-extension-capability]")).toContainText("执行尚未开放");
  await expect(page.locator("[data-extension-capability]")).toContainText("相关请求会被拒绝");
  await expect(page.locator("[data-extension-card='tool']")).toContainText("运行时沙箱（macOS）");
  await page.click("[data-sandbox-toggle]");
  await expect(page.locator("[data-sandbox-toggle]")).toHaveAttribute("aria-checked", "true");
  await page.click("[data-code-interpreter-toggle]");
  await expect(page.locator("[data-code-interpreter-toggle]")).toHaveAttribute("aria-checked", "true");

  await page.click("[data-section='skills']");
  await expect(page.locator("[data-extension-card]")).toHaveCount(1);
  await expect(page.locator("[data-extension-card='skill']")).toContainText("技能");
  await expect(page.locator("[data-extension-capability]")).toContainText("执行尚未开放");
  await expect(page.locator("[data-extension-card='skill']")).toHaveAttribute("data-extension-config", "skills");

  await expect(page.locator("#skillMarkdownImportBtn")).toContainText("上传 .md");
  await expect(page.locator("#skillZipImportBtn")).toContainText("上传压缩包");
  await expect(page.locator("[data-extension-edit='skill']")).toHaveCount(0);
  await page.locator("#skillMarkdownInput").setInputFiles({
    name: "code-review.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# 代码审查\n\n审查代码改动。\n\n先找可复现的问题，再给出最小修复。", "utf8")
  });
  await expect(page.locator("[data-extension-card='skill'] .extension-settings-item")).toContainText("代码审查");

  const chatRequest = page.waitForRequest((request) => request.url().includes("/api/chat") && request.method() === "POST");
  // 当前外壳没有 mode-rail：设置页通过“返回对话”回到聊天
  await page.getByRole("button", { name: "返回对话", exact: true }).click();
  await expect(page.locator("#extensionsBtn")).toHaveCount(0);
  await page.fill("#composerInput", "检查全局扩展");
  await page.click("#sendBtn");
  const request = await chatRequest;
  const extensions = request.postDataJSON().extensions;
  expect(extensions.skills.map((item) => item.name)).toContain("代码审查");
  expect(extensions.sandbox).toBe(true);
  expect(extensions.codeInterpreter).toBe(true);
});

test("模型返回裸 base64 图片时会渲染为可预览图片", async ({ page }) => {
  await page.route("**/api/chat", (route) => route.fulfill({
    status: 200,
    headers: { "content-type": "text/event-stream; charset=utf-8" },
    body: [
      'event: chat.stream.started\ndata: {"version":1,"providerId":"openai","reasoningKind":"summary"}\n\n',
      `event: chat.output\ndata: {"images":[{"source":"data:image/png;base64,${SAMPLE_PNG_BASE64}","mimeType":"image/png","alt":"一个圆形图标"}]}\n\n`,
      'event: chat.stream.completed\ndata: {"finishReason":"stop"}\n\n'
    ].join("")
  }));
  await seedAndLoad(page);
  await page.goto("/");
  await page.fill("#composerInput", "画一个圆形图标");
  await page.click("#sendBtn");
  await expect(page.locator(".message-entry.assistant .message-image img")).toHaveAttribute(
    "src",
    /^data:image\/png;base64,/
  );
});

test("图像模型立即显示 1:1 等待槽，并在流完成前原位展示无边框图片", async ({ page }) => {
  const state = structuredClone(SEED_STATE);
  state.settingsSchemaVersion = 1;
  state.modelCompatibility = { "p-demo": { "demo-model": { imageOutput: true } } };
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript((pngBase64) => {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (!url.includes("/api/chat")) return nativeFetch(input, init);
      const encoder = new TextEncoder();
      let imageTimer = 0;
      let completedTimer = 0;
      const body = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('event: chat.stream.started\ndata: {"version":1,"providerId":"p-demo","reasoningKind":"summary"}\n\n'));
          imageTimer = window.setTimeout(() => {
            controller.enqueue(encoder.encode(`event: chat.output\ndata: {"images":[{"source":"data:image/png;base64,${pngBase64}","mimeType":"image/png","alt":"方形测试图片"}]}\n\n`));
          }, 500);
          completedTimer = window.setTimeout(() => {
            controller.enqueue(encoder.encode('event: chat.stream.completed\ndata: {"finishReason":"stop"}\n\n'));
            controller.close();
          }, 1800);
        },
        cancel() {
          clearTimeout(imageTimer);
          clearTimeout(completedTimer);
        }
      });
      return Promise.resolve(new Response(body, {
        status: 200,
        headers: { "content-type": "text/event-stream; charset=utf-8" }
      }));
    };
  }, SAMPLE_PNG_BASE64);
  await seedAndLoad(page, { state });
  await page.goto("/");
  await page.fill("#composerInput", "生成一张方形测试图片");
  await page.click("#sendBtn");

  const slot = page.locator(".stream-image-slot");
  await expect(slot).toBeVisible();
  await expect(slot).toHaveAttribute("aria-label", "图片生成中");
  const pendingBox = await slot.boundingBox();
  expect(pendingBox).not.toBeNull();
  expect(Math.abs(pendingBox.width - pendingBox.height)).toBeLessThanOrEqual(1);
  await expect(slot.locator(".image-generation-glow")).toHaveCSS("animation-name", "none");

  const streamedImage = slot.locator("img");
  await expect(streamedImage).toBeVisible({ timeout: 2000 });
  await expect(slot).toHaveAttribute("aria-label", "放大图片");
  await expect(page.locator("#sendBtn")).toHaveClass(/stop-mode/);
  await expect(slot).toHaveCSS("border-top-width", "0px");
  await expect(slot).toHaveCSS("box-shadow", "none");

  await expect(page.locator("#sendBtn")).not.toHaveClass(/stop-mode/, { timeout: 2000 });
  await expect(page.locator(".image-generation-placeholder")).toHaveCount(0);
  const finalImage = page.locator(".message-entry.assistant .message-image");
  await expect(finalImage).toBeVisible();
  await expect(finalImage).toHaveCSS("border-top-width", "0px");
  await expect(finalImage).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");

  const assistantBody = page.locator(".message-entry.assistant .message-body");
  await expect(assistantBody).toHaveCSS("border-top-width", "0px");
  await expect(assistantBody).toHaveCSS("padding-top", "0px");
  await expect(assistantBody).toHaveCSS("box-shadow", "none");
});

test("统一运行时事件展示 Skill、沙箱结构化结果和结果图片", async ({ page }) => {
  await page.route("**/api/chat", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      content: "运行时处理完成。",
      reasoning: "",
      reasoningKind: "thinking",
      images: [],
      extensionEvents: [
        { type: "skill_applied", name: "代码审查" },
        {
          type: "tool_result",
          source: "sandbox",
          status: "succeeded",
          name: "render_preview",
          content: [
            { type: "json", json: { ok: true } },
            { type: "image", data: SAMPLE_PNG_BASE64, mime_type: "image/png", alt: "沙箱预览" }
          ]
        }
      ]
    })
  }));
  await seedAndLoad(page);
  await page.goto("/");
  await page.fill("#composerInput", "运行沙箱");
  await page.click("#sendBtn");

  const results = page.locator(".message-entry.assistant .tool-result");
  await expect(results).toHaveCount(2);
  await expect(results.nth(0)).toContainText("代码审查");
  await expect(results.nth(0)).toContainText("已应用");
  await expect(results.nth(1)).toContainText("沙箱");
  await expect(results.nth(1)).toContainText("已完成");
  await expect(results.nth(1)).not.toHaveAttribute("open", "");
  await results.nth(1).locator(":scope > summary").click();
  await expect(results.nth(1).locator(".tool-result-block")).toBeVisible();
  await expect(results.nth(1)).toContainText('"ok": true');
  await expect(page.locator(".message-entry.assistant .message-image img")).toHaveAttribute(
    "src",
    /^data:image\/png;base64,/
  );
});

test("未知旧路由安全回退 Chat", async ({ page }) => {
  await seedAndLoad(page, { hash: "#/removed-feature" });
  await page.goto("/");
  await expect(page).toHaveURL(/#\/chat$/);
  await expect(page.locator("#page-chat")).toHaveClass(/page-active/);
  await page.goto("/#/removed-feature");
  await expect(page).toHaveURL(/#\/chat$/);
  await expect(page.locator("#page-chat")).toHaveClass(/page-active/);
});
