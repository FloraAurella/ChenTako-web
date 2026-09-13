"use strict";

import { test, expect } from "@playwright/test";

const SEED_STATE = {
  version: "2.5.1",
  conversations: [],
  providers: [{
    id: "p-demo", displayName: "性能供应商", baseUrl: "https://api.example.com/v1",
    responseFormat: "openai-compatible", defaultModel: "demo-model", models: ["demo-model"],
    modelCapabilities: { "demo-model": { visionInput: "auto", imageOutput: "auto" } },
    maxTokens: 131072, contextWindow: 262144, temperature: 0.7, topP: 1,
    streaming: true, saveChats: true, systemPrompt: "", userId: "", hasKeyConfigured: true
  }],
  activeConversationId: "", activeProviderId: "p-demo", preferredReasoningEffort: "medium"
};

async function installReplay(page, content) {
  await page.route("**/api/chat/title", r => r.fulfill({ json: { title: "性能测试" } }));
  await page.addInitScript(([state, output]) => {
    localStorage.setItem("tribblebook-v6-state", JSON.stringify(state));
    location.hash = "#/chat";
    window.__AI_CHATBOX_STREAM_METRICS__ = {
      networkEvents: 0, storePublishes: 0, markdownRenders: 0,
      domCommits: 0, reactCommits: 0, persistenceWrites: 0,
      longTasks: 0, longestLongTask: 0
    };
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__AI_CHATBOX_STREAM_METRICS__.longTasks += 1;
          window.__AI_CHATBOX_STREAM_METRICS__.longestLongTask = Math.max(
            window.__AI_CHATBOX_STREAM_METRICS__.longestLongTask,
            entry.duration
          );
        }
      });
      observer.observe({ type: "longtask", buffered: true });
    } catch { /* Long Task Observer 不可用时保留零值。 */ }

    const originalFetch = window.fetch;
    window.fetch = async (input, init) => {
      const url = String(input instanceof Request ? input.url : input);
      if (new URL(url, location.href).pathname !== "/api/chat") return originalFetch(input, init);
      const chunks = [];
      for (let index = 0; index < output.length; index += 96) chunks.push(output.slice(index, index + 96));
      const frames = [
        `event: chat.stream.started\ndata: ${JSON.stringify({ version: 1, providerId: "p-demo", reasoningKind: "thinking" })}\n\n`,
        ...chunks.map((delta) => `event: chat.content.delta\ndata: ${JSON.stringify({ delta })}\n\n`),
        `event: chat.usage\ndata: ${JSON.stringify({ inputTokens: 10, outputTokens: output.length / 4, totalTokens: output.length / 4 + 10, estimated: true })}\n\n`,
        `event: chat.stream.completed\ndata: ${JSON.stringify({ finishReason: "stop" })}\n\n`
      ];
      const encoder = new TextEncoder();
      let index = 0;
      return new Response(new ReadableStream({
        pull(controller) {
          if (index < frames.length) controller.enqueue(encoder.encode(frames[index++]));
          else controller.close();
        }
      }), { status: 200, headers: { "content-type": "text/event-stream; charset=utf-8" } });
    };
  }, [SEED_STATE, content]);
}

async function installTimedScrollReplay(page, frameCount = 800) {
  await page.route("**/api/chat/title", r => r.fulfill({ json: { title: "性能测试" } }));
  await page.addInitScript(([state, totalFrames]) => {
    localStorage.setItem("tribblebook-v6-state", JSON.stringify(state));
    location.hash = "#/chat";
    window.__AI_CHATBOX_STREAM_METRICS__ = {
      networkEvents: 0, storePublishes: 0, markdownRenders: 0,
      domCommits: 0, reactCommits: 0, persistenceWrites: 0,
      longTasks: 0, longestLongTask: 0, scrollDeferredPaints: 0
    };
    const originalFetch = window.fetch;
    window.fetch = async (input, init) => {
      const url = String(input instanceof Request ? input.url : input);
      if (new URL(url, location.href).pathname !== "/api/chat") return originalFetch(input, init);
      const encoder = new TextEncoder();
      let timer = 0;
      let index = 0;
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(
            `event: chat.stream.started\ndata: ${JSON.stringify({ version: 1, providerId: "p-demo", reasoningKind: "thinking" })}\n\n`
          ));
          timer = window.setInterval(() => {
            if (index < totalFrames) {
              const delta = `### 流式段落 ${index}\n\n${"持续生成的中文正文与 emoji 🚀，用于验证滚动输入期间不会争抢主线程。".repeat(4)}\n\n`;
              controller.enqueue(encoder.encode(
                `event: chat.content.delta\ndata: ${JSON.stringify({ delta })}\n\n`
              ));
              index += 1;
              return;
            }
            window.clearInterval(timer);
            controller.enqueue(encoder.encode(
              `event: chat.stream.completed\ndata: ${JSON.stringify({ finishReason: "stop" })}\n\n`
            ));
            controller.close();
          }, 16);
        },
        cancel() {
          window.clearInterval(timer);
        }
      }), { status: 200, headers: { "content-type": "text/event-stream; charset=utf-8" } });
    };
  }, [SEED_STATE, frameCount]);
}

test.beforeEach(async ({ page }) => {
  await page.route("**/api/health", (route) => route.fulfill({ contentType: "application/json", body: '{"ok":true}' }));
  await page.route("**/api/providers", (route) => route.fulfill({ contentType: "application/json", body: '{"providers":[]}' }));
});

for (const fixture of [
  { name: "50KB Markdown", content: `${"## 流式标题\n\n- 中文段落与 **强调**。\n\n".repeat(1200)}\nPERF_50K_END` },
  { name: "100KB 代码", content: `\`\`\`js\n${"const answer = '中文与 emoji 🚀'; // stream\n".repeat(2400)}\`\`\`\nPERF_100K_END` }
]) {
  test(`${fixture.name} 合帧与持久化预算`, async ({ page }) => {
    await installReplay(page, fixture.content);
    await page.goto("/");
    await page.fill("#composerInput", `运行 ${fixture.name} 回放`);
    const startedAt = await page.evaluate(() => performance.now());
    await page.click("#sendBtn");
    await expect(page.locator(".message-entry.assistant .message-actions")).toBeVisible({ timeout: 20000 });
    await expect(page.locator(".message-entry.assistant .markdown-body")).toContainText(
      fixture.name.startsWith("50") ? "PERF_50K_END" : "PERF_100K_END",
      { timeout: 20000 }
    );
    await page.waitForTimeout(400);
    const report = await page.evaluate((start) => ({
      ...window.__AI_CHATBOX_STREAM_METRICS__,
      elapsedMs: performance.now() - start
    }), startedAt);

    console.log(JSON.stringify({ fixture: fixture.name, report }));
    expect(report.networkEvents).toBe(Math.ceil(fixture.content.length / 96) + 3);
    expect(report.storePublishes).toBeLessThan(report.networkEvents / 5);
    expect(report.markdownRenders).toBeLessThan(report.networkEvents / 10);
    expect(report.domCommits).toBe(report.markdownRenders);
    expect(report.reactCommits).toBeLessThan(8);
    expect(report.persistenceWrites).toBeLessThanOrEqual(2);
    expect(report.elapsedMs).toBeLessThan(20000);
  });
}

test("持续流式输出时优先处理用户上滚，停止手势后补绘最新内容", async ({ page }) => {
  await installTimedScrollReplay(page);
  await page.goto("/");
  await page.fill("#composerInput", "生成一篇持续输出的长文");
  await page.click("#sendBtn");
  await page.waitForFunction(() => {
    const scroller = document.querySelector("#messageScroll");
    return scroller && scroller.scrollHeight > scroller.clientHeight + 240;
  });

  const scrollBox = await page.locator("#messageScroll").boundingBox();
  await page.mouse.move(scrollBox.x + scrollBox.width / 2, scrollBox.y + scrollBox.height / 2);
  await page.mouse.wheel(0, -500);
  await expect(page.locator("#newRepliesBtn")).toBeVisible();
  await page.waitForTimeout(20);
  const before = await page.evaluate(() => ({ ...window.__AI_CHATBOX_STREAM_METRICS__ }));

  // 在页面事件循环内模拟触控板的连续 wheel 脉冲，避免测试驱动与浏览器之间
  // 的协议往返被误算成用户已经停手。
  await page.evaluate(() => new Promise((resolve) => {
    const scroller = document.querySelector("#messageScroll");
    let index = 0;
    const timer = window.setInterval(() => {
      scroller.dispatchEvent(new WheelEvent("wheel", { deltaY: -140, bubbles: true }));
      scroller.scrollTop = Math.max(0, scroller.scrollTop - 140);
      index += 1;
      if (index < 8) return;
      window.clearInterval(timer);
      resolve();
    }, 35);
  }));
  const during = await page.evaluate(() => ({ ...window.__AI_CHATBOX_STREAM_METRICS__ }));

  expect(during.networkEvents).toBeGreaterThan(before.networkEvents + 8);
  expect(during.storePublishes).toBe(before.storePublishes);
  expect(during.domCommits).toBe(before.domCommits);
  expect(during.scrollDeferredPaints).toBeGreaterThan(before.scrollDeferredPaints);

  await page.waitForFunction((publishes) => (
    window.__AI_CHATBOX_STREAM_METRICS__.storePublishes > publishes
  ), during.storePublishes);
  await expect(page.locator("#newRepliesBtn")).toBeVisible();
});

test("滚动手势覆盖流结束时，终态完整提交且保持阅读位置", async ({ page }) => {
  await installTimedScrollReplay(page, 45);
  await page.goto("/");
  await page.fill("#composerInput", "生成会在滚动期间结束的长文");
  await page.click("#sendBtn");
  await page.waitForFunction(() => {
    const scroller = document.querySelector("#messageScroll");
    return scroller && scroller.scrollHeight > scroller.clientHeight + 240;
  });

  const scrollBox = await page.locator("#messageScroll").boundingBox();
  await page.mouse.move(scrollBox.x + scrollBox.width / 2, scrollBox.y + scrollBox.height / 2);
  await page.mouse.wheel(0, -500);
  await page.evaluate(() => new Promise((resolve) => {
    const scroller = document.querySelector("#messageScroll");
    let index = 0;
    const timer = window.setInterval(() => {
      scroller.dispatchEvent(new WheelEvent("wheel", { deltaY: -80, bubbles: true }));
      scroller.scrollTop = Math.max(0, scroller.scrollTop - 80);
      index += 1;
      if (index < 18) return;
      window.clearInterval(timer);
      resolve();
    }, 35);
  }));

  await expect(page.locator(".message-entry.assistant .message-actions")).toBeVisible({ timeout: 3000 });
  await expect(page.locator(".message-entry.assistant .markdown-body")).toContainText("流式段落 44");
  await expect(page.locator("#newRepliesBtn")).toBeVisible();
});
