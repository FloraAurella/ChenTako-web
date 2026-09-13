# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: visual.spec.js >> Everforest 思考强度控件
- Location: e2e/visual.spec.js:319:1

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('.effort-popover')
  3749 pixels (ratio 0.09 of all image pixels) are different.

  Snapshot: everforest-effort-popover.png

Call log:
  - Expect "toHaveScreenshot(everforest-effort-popover.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('.effort-popover')
    - locator resolved to <div data-effort="max" class="popover-card runtime-popover effort-popover">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 3749 pixels (ratio 0.09 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - waiting for locator('.effort-popover')
    - locator resolved to <div data-effort="max" class="popover-card runtime-popover effort-popover">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - captured a stable screenshot
  - 3749 pixels (ratio 0.09 of all image pixels) are different.

```

# Page snapshot

```yaml
- generic [ref=e2]:
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
                - button "demo-model 最大" [expanded] [ref=e103] [cursor=pointer]:
                  - generic [ref=e104]: demo-model
                  - generic [ref=e105]: 最大
                - button "压缩上下文（已用约 0%）" [ref=e109] [cursor=pointer]
                - button "发送" [disabled] [ref=e114]
          - generic [ref=e117]: Enter 发送 · Shift + Enter 换行
  - generic [ref=e118]:
    - generic [ref=e119]:
      - generic [ref=e120]:
        - generic [ref=e121]: 最大
        - generic "demo-model" [ref=e122]
      - button "恢复跟随配置" [ref=e123] [cursor=pointer]
    - slider "思考强度" [active] [ref=e126] [cursor=pointer]
    - generic [ref=e130]: 当前会话自定义
```

# Test source

```ts
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
> 334 |   await expect(popover).toHaveScreenshot("everforest-effort-popover.png", { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
      |                         ^ Error: expect(locator).toHaveScreenshot(expected) failed
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
  392 | 
  393 | test("上下文与提示词集中配置", async ({ page }) => {
  394 |   await seed(page, { hash: "#/settings/providers" });
  395 |   await page.goto("/");
  396 |   await page.locator('[data-section="context"]').click();
  397 |   await expect(page.locator("#cc-systemPrompt")).toBeVisible();
  398 |   await freezePage(page);
  399 |   await expect(page).toHaveScreenshot("provider-advanced-open.png", { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
  400 | });
  401 | 
  402 | test("Provider 中等宽度顶部切换器", async ({ page }) => {
  403 |   await seed(page, { hash: "#/settings/providers" });
  404 |   await page.setViewportSize({ width: 900, height: 700 });
  405 |   await page.goto("/");
  406 |   await expect(page.locator("#pf-name")).toBeVisible();
  407 |   await freezePage(page);
  408 |   await expect(page).toHaveScreenshot("provider-medium-workbench.png", { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
  409 | });
  410 | 
  411 | test("Provider 移动端列表与详情", async ({ page }) => {
  412 |   await seed(page, { hash: "#/settings/providers" });
  413 |   await page.setViewportSize({ width: 390, height: 844 });
  414 |   await page.goto("/");
  415 |   await expect(page.locator("#pf-name")).toHaveCount(0);
  416 |   await freezePage(page);
  417 |   await expect(page).toHaveScreenshot("provider-mobile-list.png", { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
  418 | 
  419 |   await page.locator(".provider-item").first().click();
  420 |   await expect(page.locator("#pf-name")).toBeVisible();
  421 |   await freezePage(page);
  422 |   await expect(page).toHaveScreenshot("provider-mobile-detail.png", { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
  423 | });
  424 | 
  425 | test("移动端空会话", async ({ page }) => {
  426 |   await seed(page);
  427 |   await page.setViewportSize({ width: 390, height: 844 });
  428 |   await page.goto("/");
  429 |   await expect(page.locator(".mobile-nav")).toBeVisible();
  430 |   await freezePage(page);
  431 |   await expect(page).toHaveScreenshot("empty-chat-mobile.png", { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
  432 | });
  433 | 
  434 | test("移动端思考轨迹", async ({ page }) => {
```