"use strict";

/** 消息布局几何核验：mock SSE 走一轮对话，检查气泡对齐、助手标记、
 * Markdown Sans 默认与暖调代码框，并截图存档。 */

import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

await page.addInitScript(() => {
  const state = {
    version: "2.6.0",
    conversations: [],
    providers: [{
      id: "p-demo", displayName: "示例供应商", baseUrl: "https://api.example.com/v1",
      responseFormat: "anthropic", defaultModel: "demo-model", models: ["demo-model"],
      modelCapabilities: { "demo-model": { visionInput: "auto", imageOutput: "auto" } },
      maxTokens: 8192, contextWindow: 131072, temperature: 0.7, topP: 1,
      streaming: true, saveChats: true, systemPrompt: "", userId: "", hasKeyConfigured: true
    }],
    activeConversationId: "", activeProviderId: "p-demo", preferredReasoningEffort: "medium"
  };
  localStorage.setItem("clawbox-v6-state", JSON.stringify(state));
});

await page.addInitScript(() => {
  const originalFetch = window.fetch;
  window.fetch = async (input, init) => {
    const url = String(input instanceof Request ? input.url : input);
    if (!url.includes("/api/chat")) return originalFetch(input, init);
    const codeFence = String.fromCharCode(96).repeat(3);
    const markdown = [
      "好的，一段示例回复：",
      "",
      "# 一级标题",
      "",
      "> 引文像夜色里的一句题词。",
      "",
      codeFence + "js",
      "const identityColor = (theme); // 注释",
      codeFence
    ].join("\n");
    const frames = [
      "event: chat.stream.started\ndata: " + JSON.stringify({ version: 1, providerId: "p-demo", reasoningKind: "thinking" }) + "\n\n",
      "event: chat.reasoning.delta\ndata: " + JSON.stringify({ delta: "用户想要一个示例回复。", kind: "thinking" }) + "\n\n",
      "event: chat.content.delta\ndata: " + JSON.stringify({ delta: markdown }) + "\n\n",
      "event: chat.usage\ndata: " + JSON.stringify({ inputTokens: 12, outputTokens: 42, totalTokens: 54, estimated: false }) + "\n\n",
      "event: chat.stream.completed\ndata: " + JSON.stringify({ finishReason: "end_turn" }) + "\n\n"
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
          } else controller.close();
        };
        setTimeout(push, 40);
      }
    });
    return new Response(stream, {
      status: 200,
      headers: { "content-type": "text/event-stream" }
    });
  };
});

await page.goto("http://127.0.0.1:5173/");
await page.waitForLoadState("domcontentloaded");
await page.waitForTimeout(1200);
await page.fill("#composerInput", "给我一段示例回复");
await page.click("#sendBtn");
await page.waitForTimeout(2200);

const assistantText = await page.locator(".message-entry.assistant .message-body").textContent();
console.log("ASSISTANT CONTENT:", JSON.stringify(assistantText));

const report = await page.evaluate(() => {
  const list = document.querySelector("#messageList");
  const user = document.querySelector(".message-entry.user .message-paper");
  const assistant = document.querySelector(".message-entry.assistant");
  const codeBlock = document.querySelector(".code-block code");
  const quote = document.querySelector(".markdown-body blockquote");
  const heading = document.querySelector(".markdown-body h1");
  const reasoning = document.querySelector(".reasoning-sheet");
  const meta = document.querySelector(".message-entry.assistant .message-meta");
  const glyph = document.querySelector(".assistant-glyph");
  const assistantBody = document.querySelector(".message-entry.assistant .message-body");
  const firstFont = (el) => (el ? getComputedStyle(el).fontFamily.split(",")[0].replace(/"/g, "") : null);
  const listRect = list.getBoundingClientRect();
  const userRect = user.getBoundingClientRect();
  return {
    userRightAligned: Math.abs((listRect.right - userRect.right)) < listRect.width * 0.2,
    userBubbleBackground: getComputedStyle(user).backgroundColor,
    userBubbleRadius: getComputedStyle(user).borderRadius,
    assistantGlyphPresent: Boolean(glyph),
    assistantGlyphColor: glyph ? getComputedStyle(glyph).backgroundColor : null,
    assistantOpenBody: assistantBody ? getComputedStyle(assistantBody).backgroundColor === "rgba(0, 0, 0, 0)" : null,
    assistantPresent: Boolean(assistant),
    codeFont: codeBlock ? getComputedStyle(codeBlock).fontFamily.split(",")[0] : null,
    codeBg: document.querySelector(".code-block") ? getComputedStyle(document.querySelector(".code-block")).backgroundColor : null,
    headingFont: firstFont(heading),
    headingWeight: heading ? getComputedStyle(heading).fontWeight : null,
    quoteItalic: quote ? getComputedStyle(quote).fontStyle : null,
    quoteFont: firstFont(quote),
    quoteBorderColor: quote ? getComputedStyle(quote).borderLeftColor : null,
    reasoningPresent: Boolean(reasoning),
    reasoningCollapsed: reasoning ? reasoning.dataset.open === "false" : null,
    metaText: meta ? meta.textContent : null
  };
});
await page.screenshot({ path: "/tmp/clawbox-chat.png" });

await page.click("#appearanceModeBtn");
await page.waitForTimeout(500);
const darkReport = await page.evaluate(() => {
  const user = document.querySelector(".message-entry.user .message-paper");
  const code = document.querySelector(".code-block");
  return {
    userBubbleBackground: user ? getComputedStyle(user).backgroundColor : null,
    codeBg: code ? getComputedStyle(code).backgroundColor : null,
    canvas: getComputedStyle(document.documentElement).getPropertyValue("--canvas-mid").trim()
  };
});
await page.screenshot({ path: "/tmp/clawbox-chat-dark.png" });
await browser.close();
console.log(JSON.stringify({ ...report, dark: darkReport }, null, 2));
