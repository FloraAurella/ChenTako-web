# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: visual.spec.js >> 空会话 light
- Location: e2e/visual.spec.js:260:3

# Error details

```
Error: expect(page).toHaveScreenshot(expected) failed

  14468 pixels (ratio 0.02 of all image pixels) are different.

  Snapshot: empty-chat-light.png

Call log:
  - Expect "toHaveScreenshot(empty-chat-light.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - 14468 pixels (ratio 0.02 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - captured a stable screenshot
  - 14468 pixels (ratio 0.02 of all image pixels) are different.

```

# Page snapshot

```yaml
- generic [ref=e4]:
  - complementary "对话" [ref=e5]:
    - generic [ref=e6]:
      - heading "ChenTako" [level=2] [ref=e13]
      - button "收起侧栏" [expanded] [ref=e15] [cursor=pointer]
    - button "新建对话" [ref=e19] [cursor=pointer]
    - generic [ref=e23]:
      - generic [ref=e24]: 查找聊天
      - button "搜索对话" [ref=e25] [cursor=pointer]
      - button "导入对话" [ref=e29] [cursor=pointer]
    - searchbox "搜索对话 ⌘K" [ref=e33]
    - generic [ref=e34]:
      - region "项目" [ref=e35]:
        - generic [ref=e36]:
          - button "项目" [expanded] [ref=e37] [cursor=pointer]
          - button "新建项目" [ref=e41] [cursor=pointer]
        - generic [ref=e45]: 创建项目，整理相关聊天
      - region "聊天" [ref=e47]:
        - button "聊天" [expanded] [ref=e49] [cursor=pointer]
        - generic [ref=e53]: 暂无无项目聊天
    - navigation "应用导航" [ref=e55]:
      - button "设置" [ref=e56] [cursor=pointer]
  - main [ref=e61]:
    - generic [ref=e62]:
      - generic [ref=e64]:
        - generic [ref=e65]: Chat · 对话
        - generic [ref=e66]: 新对话
      - generic "本地服务正常" [ref=e69]
    - region "对话" [ref=e73]:
      - heading "欢迎回来，随时开始吧" [level=2] [ref=e83]
      - generic [ref=e85]:
        - button "当前项目：无项目" [ref=e87] [cursor=pointer]:
          - generic [ref=e91]: 无项目
        - generic [ref=e95]:
          - textbox "输入消息，/ 打开指令" [ref=e97]
          - generic [ref=e98]:
            - button "添加附件" [ref=e99] [cursor=pointer]
            - generic [ref=e102]:
              - button "demo-model 中等" [ref=e103] [cursor=pointer]:
                - generic [ref=e104]: demo-model
                - generic [ref=e105]: 中等
              - button "压缩上下文（已用约 0%）" [ref=e109] [cursor=pointer]
              - button "发送" [disabled] [ref=e114]
        - generic [ref=e117]: Enter 发送 · Shift + Enter 换行
```

# Test source

```ts
  167 |       providerId: "p-demo",
  168 |       model: "demo-model",
  169 |       reasoningEffort: "medium",
  170 |       contextCompression: null,
  171 |       draft: "",
  172 |       messages: [{
  173 |         id: "visual-artifact-user",
  174 |         role: "user",
  175 |         content: "创建一个 HTML 页面和 SVG 图标。",
  176 |         createdAt: FIXED_NOW - 8_000
  177 |       }, {
  178 |         id: "visual-artifact-assistant",
  179 |         role: "assistant",
  180 |         content: `${intro}${ending}`,
  181 |         parts: [{
  182 |           type: "tool_result", callId: "call-artifact", name: "clawbox_code_interpreter",
  183 |           source: "sandbox", status: "succeeded", output: "两个文件已创建。", content: [], contentOffset: intro.length, durationMs: 860
  184 |         }, {
  185 |           type: "file", name: "preview.html", mimeType: "text/html",
  186 |           source: "data:text/html;base64,PGgxPlNlYXNpZGU8L2gxPg==", size: 19,
  187 |           contentOffset: intro.length, artifactId: "call-artifact:0", callId: "call-artifact"
  188 |         }, {
  189 |           type: "file", name: "mark.svg", mimeType: "image/svg+xml",
  190 |           source: "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjgiLz48L3N2Zz4=", size: 71,
  191 |           contentOffset: intro.length, artifactId: "call-artifact:1", callId: "call-artifact"
  192 |         }],
  193 |         createdAt: FIXED_NOW - 6_000,
  194 |         durationMs: 2200
  195 |       }]
  196 |     }]
  197 |   };
  198 | }
  199 | 
  200 | function imageOutputState() {
  201 |   const state = structuredClone(SEED_STATE);
  202 |   state.settingsSchemaVersion = 1;
  203 |   state.modelCompatibility = { "p-demo": { "demo-model": { imageOutput: true } } };
  204 |   return state;
  205 | }
  206 | 
  207 | async function installPendingImageStream(page) {
  208 |   await page.addInitScript(() => {
  209 |     const nativeFetch = window.fetch.bind(window);
  210 |     window.fetch = (input, init) => {
  211 |       const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  212 |       if (!url.includes("/api/chat")) return nativeFetch(input, init);
  213 |       const encoder = new TextEncoder();
  214 |       const body = new ReadableStream({
  215 |         start(controller) {
  216 |           controller.enqueue(encoder.encode('event: chat.stream.started\ndata: {"version":1,"providerId":"p-demo","reasoningKind":"summary"}\n\n'));
  217 |         }
  218 |       });
  219 |       return Promise.resolve(new Response(body, {
  220 |         status: 200,
  221 |         headers: { "content-type": "text/event-stream; charset=utf-8" }
  222 |       }));
  223 |     };
  224 |   });
  225 | }
  226 | 
  227 | test.beforeEach(async ({ page }) => {
  228 |   await page.route("**/api/health", (route) => route.fulfill({
  229 |     contentType: "application/json",
  230 |     body: JSON.stringify({ ok: true, service: "clawbox-server" })
  231 |   }));
  232 |   await page.route("**/api/providers", (route) => route.fulfill({
  233 |     contentType: "application/json",
  234 |     body: JSON.stringify({ providers: [] })
  235 |   }));
  236 |   await page.route("**/api/providers/key*", (route) => route.fulfill({
  237 |     status: 404,
  238 |     contentType: "application/json",
  239 |     body: JSON.stringify({ error: "not configured" })
  240 |   }));
  241 | });
  242 | 
  243 | test("onboarding 初始浅色", async ({ page }) => {
  244 |   await page.setViewportSize({ width: 900, height: 700 });
  245 |   await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  246 |   await page.goto("/onboarding.html");
  247 |   await freezePage(page);
  248 |   await expect(page).toHaveScreenshot("onboarding-initial-light.png", { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
  249 | });
  250 | 
  251 | test("onboarding 初始深色", async ({ page }) => {
  252 |   await page.setViewportSize({ width: 900, height: 700 });
  253 |   await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  254 |   await page.goto("/onboarding.html");
  255 |   await freezePage(page);
  256 |   await expect(page).toHaveScreenshot("onboarding-initial-dark.png", { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
  257 | });
  258 | 
  259 | for (const scheme of ["light", "dark"]) {
  260 |   test(`空会话 ${scheme}`, async ({ page }) => {
  261 |     await seed(page, { scheme });
  262 |     await page.setViewportSize({ width: 1280, height: 800 });
  263 |     await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
  264 |     await page.goto("/");
  265 |     await expect(page.locator(".empty-stage")).toBeVisible();
  266 |     await freezePage(page);
> 267 |     await expect(page).toHaveScreenshot(`empty-chat-${scheme}.png`, { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
      |                        ^ Error: expect(page).toHaveScreenshot(expected) failed
  268 |   });
  269 | 
  270 |   test(`Everforest 空会话 ${scheme}`, async ({ page }) => {
  271 |     await seed(page, { scheme, themeId: "everforest" });
  272 |     await page.setViewportSize({ width: 1280, height: 720 });
  273 |     await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
  274 |     await page.goto("/");
  275 |     await expect(page.locator("html")).toHaveAttribute("data-theme", "everforest");
  276 |     await expect(page.locator(".motion-layer")).toHaveCount(0);
  277 |     await expect(page.locator(".empty-stage")).toBeVisible();
  278 |     await freezePage(page);
  279 |     await expect(page).toHaveScreenshot(`everforest-empty-${scheme}.png`, { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
  280 |   });
  281 | 
  282 |   test(`Everforest 真实消息 ${scheme}`, async ({ page }) => {
  283 |     await seed(page, { scheme, themeId: "everforest", state: reasoningState() });
  284 |     await page.setViewportSize({ width: 1280, height: 720 });
  285 |     await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
  286 |     await page.goto("/");
  287 |     await expect(page.locator("html")).toHaveAttribute("data-theme", "everforest");
  288 |     await expect(page.locator(".message-entry")).toHaveCount(2);
  289 |     await expect(page.locator(".empty-card")).toHaveCount(0);
  290 |     await freezePage(page);
  291 |     await expect(page).toHaveScreenshot(`everforest-messages-${scheme}.png`, { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
  292 |   });
  293 | 
  294 |   test(`思考轨迹 ${scheme}`, async ({ page }) => {
  295 |     await seed(page, { scheme, state: reasoningState() });
  296 |     await page.setViewportSize({ width: 1280, height: 800 });
  297 |     await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
  298 |     await page.goto("/");
  299 |     const sheet = page.locator(".reasoning-sheet");
  300 |     await expect(sheet).toBeVisible();
  301 |     await sheet.locator(".reasoning-toggle").click();
  302 |     await expect(sheet).toHaveAttribute("data-open", "true");
  303 |     await freezePage(page);
  304 |     await expect(page).toHaveScreenshot(`reasoning-trail-${scheme}.png`, { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
  305 |   });
  306 | }
  307 | 
  308 | test("Everforest 外观主题卡", async ({ page }) => {
  309 |   await seed(page, { scheme: "dark", themeId: "everforest", hash: "#/settings/appearance" });
  310 |   await page.setViewportSize({ width: 1280, height: 720 });
  311 |   await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  312 |   await page.goto("/");
  313 |   await expect(page.locator(".theme-card")).toHaveCount(1);
  314 |   await expect(page.locator(".theme-card").nth(0)).toHaveAttribute("data-theme-id", "everforest");
  315 |   await freezePage(page);
  316 |   await expect(page).toHaveScreenshot("everforest-appearance.png", { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
  317 | });
  318 | 
  319 | test("Everforest 思考强度控件", async ({ page }) => {
  320 |   await seed(page, { scheme: "light", themeId: "everforest" });
  321 |   await page.setViewportSize({ width: 1280, height: 720 });
  322 |   await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  323 |   await page.goto("/");
  324 |   await page.click("#runtimeBtn");
  325 |   await page.click('[data-runtime-open="effort"]');
  326 |   const popover = page.locator(".effort-popover");
  327 |   await expect(popover).toBeVisible();
  328 |   await expect(popover.locator(".effort-head-spacer")).toBeEmpty();
  329 |   await expect(popover.locator(".effort-head svg")).toHaveCount(1);
  330 |   await popover.locator(".effort-rail").press("End");
  331 |   await expect(popover.locator("[data-effort-current]")).toHaveText("最大");
  332 |   await freezePage(page);
  333 |   // 严格比较浮层，避免小图标残留被像素容差忽略。
  334 |   await expect(popover).toHaveScreenshot("everforest-effort-popover.png", { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
  335 | });
  336 | 
  337 | test("Everforest 运行配置与模型选择器", async ({ page }) => {
  338 |   await seed(page, { scheme: "light", themeId: "everforest" });
  339 |   await page.setViewportSize({ width: 1280, height: 720 });
  340 |   await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  341 |   await page.goto("/");
  342 |   await freezePage(page);
  343 | 
  344 |   await page.click("#runtimeBtn");
  345 |   const rootPopover = page.locator(".runtime-root-popover");
  346 |   await expect(rootPopover).toBeVisible();
  347 |   await expect(rootPopover).toHaveScreenshot("everforest-runtime-root.png", { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
  348 | 
  349 |   await page.click('[data-runtime-open="model"]');
  350 |   const modelPopover = page.locator(".model-popover");
  351 |   await expect(modelPopover).toBeVisible();
  352 |   await expect(modelPopover).toHaveScreenshot("everforest-model-popover.png", { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
  353 | });
  354 | 
  355 | test("未知旧路由回退到 Chat", async ({ page }) => {
  356 |   await seed(page, { hash: "#/removed-route" });
  357 |   await page.goto("/");
  358 |   await expect(page).toHaveURL(/#\/chat$/);
  359 |   await expect(page.locator("#page-chat")).toHaveClass(/page-active/);
  360 | });
  361 | 
  362 | test("Provider 设置页面", async ({ page }) => {
  363 |   await seed(page, { hash: "#/settings/providers" });
  364 |   await page.goto("/");
  365 |   await expect(page.locator(".provider-item")).toHaveCount(1);
  366 |   await freezePage(page);
  367 |   await expect(page).toHaveScreenshot("settings-providers.png", { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
```