# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: visual.spec.js >> Everforest 真实消息 dark
- Location: e2e/visual.spec.js:282:3

# Error details

```
Error: expect(page).toHaveScreenshot(expected) failed

  12181 pixels (ratio 0.02 of all image pixels) are different.

  Snapshot: everforest-messages-dark.png

Call log:
  - Expect "toHaveScreenshot(everforest-messages-dark.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - 12181 pixels (ratio 0.02 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - captured a stable screenshot
  - 12181 pixels (ratio 0.02 of all image pixels) are different.

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
        - button "思考面板视觉检查 今天" [ref=e54] [cursor=pointer]:
          - generic [ref=e55]: 思考面板视觉检查
          - generic [ref=e57]: 今天
    - navigation "应用导航" [ref=e59]:
      - button "设置" [ref=e60] [cursor=pointer]
  - main [ref=e65]:
    - generic [ref=e66]:
      - generic [ref=e68]:
        - generic [ref=e69]: Chat · 对话
        - generic [ref=e70]: 思考面板视觉检查
      - generic "本地服务正常" [ref=e73]
    - region "对话" [ref=e77]:
      - generic [ref=e79]:
        - generic [ref=e80]:
          - paragraph [ref=e83]: 请说明你会如何组织这段回答。
          - generic [ref=e84]: 09:59
          - generic [ref=e85]:
            - button "复制" [ref=e86] [cursor=pointer]
            - button "编辑" [ref=e90] [cursor=pointer]
            - button "复制到新对话" [ref=e94] [cursor=pointer]
            - button "删除消息" [ref=e100] [cursor=pointer]
        - generic [ref=e103]:
          - generic [ref=e104]:
            - generic [ref=e109]: 示例供应商
            - generic [ref=e110]: demo-model
          - generic [ref=e111]:
            - button "已思考 （用时 2s）" [ref=e112] [cursor=pointer]:
              - generic [ref=e117]: 已思考
              - generic [ref=e118]: （用时 2s）
            - generic [ref=e122]:
              - paragraph [ref=e123]: 先确认用户真正需要的是回答结构，而不是直接扩展正文；接着核对已有上下文、限制条件和期望语气，避免遗漏会影响结论的细节，并把可以验证的事实与尚待确认的判断明确区分。
              - paragraph [ref=e124]: 再按结论、依据和下一步三个层次组织内容，让长段思考充分使用与正式回答相同的消息列宽，同时保持语言简洁、层级清楚，并确保用户能够快速定位真正需要执行的部分。
          - paragraph [ref=e128]: 我会先给出结论，再说明判断依据，最后整理成可以直接执行的下一步。
          - generic [ref=e129]: 09:59 · 3s
          - generic [ref=e130]:
            - button "复制" [ref=e131] [cursor=pointer]
            - button "编辑" [ref=e135] [cursor=pointer]
            - button "复制到新对话" [ref=e139] [cursor=pointer]
            - button "重新生成" [ref=e145] [cursor=pointer]
            - button "删除消息" [ref=e148] [cursor=pointer]
      - generic [ref=e152]:
        - generic [ref=e153]:
          - textbox "输入消息，/ 打开指令" [ref=e155]
          - generic [ref=e156]:
            - button "添加附件" [ref=e157] [cursor=pointer]
            - generic [ref=e160]:
              - button "demo-model 中等" [ref=e161] [cursor=pointer]:
                - generic [ref=e162]: demo-model
                - generic [ref=e163]: 中等
              - button "压缩上下文（已用约 0%）" [ref=e167] [cursor=pointer]
              - button "发送" [disabled] [ref=e172]
        - generic [ref=e175]: Enter 发送 · Shift + Enter 换行
```

# Test source

```ts
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
  267 |     await expect(page).toHaveScreenshot(`empty-chat-${scheme}.png`, { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
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
> 291 |     await expect(page).toHaveScreenshot(`everforest-messages-${scheme}.png`, { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
      |                        ^ Error: expect(page).toHaveScreenshot(expected) failed
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
  368 | });
  369 | 
  370 | test("Provider 模型编辑基础弹层", async ({ page }) => {
  371 |   await seed(page, { hash: "#/settings/providers" });
  372 |   await page.emulateMedia({ reducedMotion: "reduce" });
  373 |   await page.goto("/");
  374 |   await page.locator('[data-model-row="demo-model"] [aria-label="编辑模型"]').click();
  375 |   await expect(page.getByRole("dialog", { name: "编辑模型配置" })).toBeVisible();
  376 |   await page.mouse.move(0, 0);
  377 |   await freezePage(page);
  378 |   await expect(page).toHaveScreenshot("provider-model-dialog-basic.png", { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
  379 | });
  380 | 
  381 | test("Provider 模型额度弹层深色", async ({ page }) => {
  382 |   await seed(page, { scheme: "dark", hash: "#/settings/providers" });
  383 |   await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  384 |   await page.goto("/");
  385 |   await page.locator('[data-model-row="demo-model"] [aria-label="编辑模型"]').click();
  386 |   const dialog = page.getByRole("dialog", { name: "编辑模型配置" });
  387 |   await expect(dialog.locator("#model-contextWindow")).toBeVisible();
  388 |   await expect(dialog.locator("#model-temperature")).toHaveCount(0);
  389 |   await freezePage(page);
  390 |   await expect(page).toHaveScreenshot("provider-model-dialog-advanced-dark.png", { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
  391 | });
```