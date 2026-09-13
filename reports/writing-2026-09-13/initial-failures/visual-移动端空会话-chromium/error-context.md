# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: visual.spec.js >> 移动端空会话
- Location: e2e/visual.spec.js:425:1

# Error details

```
Error: expect(page).toHaveScreenshot(expected) failed

  10208 pixels (ratio 0.04 of all image pixels) are different.

  Snapshot: empty-chat-mobile.png

Call log:
  - Expect "toHaveScreenshot(empty-chat-mobile.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - 10208 pixels (ratio 0.04 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - captured a stable screenshot
  - 10208 pixels (ratio 0.04 of all image pixels) are different.

```

# Page snapshot

```yaml
- generic [ref=e4]:
  - main [ref=e5]:
    - generic [ref=e6]:
      - generic [ref=e7]:
        - button "展开侧栏" [ref=e8] [cursor=pointer]
        - generic [ref=e12]:
          - generic [ref=e13]: Chat · 对话
          - generic [ref=e14]: 新对话
      - generic "本地服务正常" [ref=e17]
    - region "对话" [ref=e21]:
      - heading "欢迎回来，随时开始吧" [level=2] [ref=e31]
      - generic [ref=e33]:
        - button "当前项目：无项目" [ref=e35] [cursor=pointer]:
          - generic [ref=e39]: 无项目
        - generic [ref=e43]:
          - textbox "输入消息，/ 打开指令" [ref=e45]
          - generic [ref=e46]:
            - button "添加附件" [ref=e47] [cursor=pointer]
            - generic [ref=e50]:
              - button "demo-model 中等" [ref=e51] [cursor=pointer]:
                - generic [ref=e52]: demo-model
                - generic [ref=e53]: 中等
              - button "压缩上下文（已用约 0%）" [ref=e57] [cursor=pointer]
              - button "发送" [disabled] [ref=e62]
        - generic [ref=e65]: Enter 发送 · Shift + Enter 换行
  - navigation "主导航" [ref=e66]:
    - button "对话" [ref=e67] [cursor=pointer]
    - button "设置" [ref=e71] [cursor=pointer]
```

# Test source

```ts
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
> 431 |   await expect(page).toHaveScreenshot("empty-chat-mobile.png", { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
      |                      ^ Error: expect(page).toHaveScreenshot(expected) failed
  432 | });
  433 | 
  434 | test("移动端思考轨迹", async ({ page }) => {
  435 |   await seed(page, { state: reasoningState() });
  436 |   await page.setViewportSize({ width: 390, height: 844 });
  437 |   await page.goto("/");
  438 |   const sheet = page.locator(".reasoning-sheet");
  439 |   await sheet.locator(".reasoning-toggle").click();
  440 |   await expect(sheet).toHaveAttribute("data-open", "true");
  441 |   await expect(sheet.locator(".reasoning-toggle")).toHaveCSS("min-height", "44px");
  442 |   await freezePage(page);
  443 |   await expect(page).toHaveScreenshot("reasoning-trail-mobile.png", { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
  444 | });
  445 | 
  446 | test("工具轻量时间线深色", async ({ page }) => {
  447 |   await seed(page, { scheme: "dark", state: toolTimelineState() });
  448 |   await page.setViewportSize({ width: 1280, height: 800 });
  449 |   await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  450 |   await page.goto("/");
  451 |   await expect(page.locator(".tool-result")).toHaveCount(3);
  452 |   await expect(page.locator(".tool-result-block")).toHaveCount(2);
  453 |   await freezePage(page);
  454 |   await expect(page).toHaveScreenshot("tool-timeline-dark.png", { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
  455 | });
  456 | 
  457 | test("工具轻量时间线移动端", async ({ page }) => {
  458 |   await seed(page, { state: toolTimelineState() });
  459 |   await page.setViewportSize({ width: 390, height: 844 });
  460 |   await page.goto("/");
  461 |   await expect(page.locator(".tool-result")).toHaveCount(3);
  462 |   await expect(page.locator(".tool-result-content").first()).toHaveCSS("padding-left", "16px");
  463 |   await freezePage(page);
  464 |   await expect(page).toHaveScreenshot("tool-timeline-mobile.png", { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
  465 | });
  466 | 
  467 | test("HTML 与 SVG 产物工具栏深色", async ({ page }) => {
  468 |   await seed(page, { scheme: "dark", state: artifactPreviewState() });
  469 |   await page.setViewportSize({ width: 1280, height: 800 });
  470 |   await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  471 |   await page.goto("/");
  472 |   await expect(page.locator(".artifact-file")).toHaveCount(2);
  473 |   await expect(page.locator(".code-block .code-actions button")).toHaveCount(3);
  474 |   await freezePage(page);
  475 |   await expect(page).toHaveScreenshot("artifact-preview-toolbar-dark.png", { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
  476 | });
  477 | 
  478 | test("HTML 与 SVG 产物工具栏移动端", async ({ page }) => {
  479 |   await seed(page, { state: artifactPreviewState() });
  480 |   await page.setViewportSize({ width: 390, height: 844 });
  481 |   await page.emulateMedia({ reducedMotion: "reduce" });
  482 |   await page.goto("/");
  483 |   await expect(page.locator(".artifact-file")).toHaveCount(2);
  484 |   await freezePage(page);
  485 |   await expect(page).toHaveScreenshot("artifact-preview-toolbar-mobile.png", { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
  486 | });
  487 | 
  488 | test("图像生成等待态深色", async ({ page }) => {
  489 |   await installPendingImageStream(page);
  490 |   await seed(page, { scheme: "dark", state: imageOutputState() });
  491 |   await page.setViewportSize({ width: 1280, height: 800 });
  492 |   await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  493 |   await page.goto("/");
  494 |   await page.fill("#composerInput", "生成一张测试图片");
  495 |   await page.click("#sendBtn");
  496 |   await expect(page.locator(".stream-image-slot")).toBeVisible();
  497 |   await freezePage(page);
  498 |   await expect(page).toHaveScreenshot("image-generation-pending-dark.png", { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
  499 | });
  500 | 
  501 | test("图像生成等待态移动端", async ({ page }) => {
  502 |   await installPendingImageStream(page);
  503 |   await seed(page, { state: imageOutputState() });
  504 |   await page.setViewportSize({ width: 390, height: 844 });
  505 |   await page.emulateMedia({ reducedMotion: "reduce" });
  506 |   await page.goto("/");
  507 |   await page.fill("#composerInput", "生成一张测试图片");
  508 |   await page.click("#sendBtn");
  509 |   await expect(page.locator(".stream-image-slot")).toBeVisible();
  510 |   await freezePage(page);
  511 |   await expect(page).toHaveScreenshot("image-generation-pending-mobile.png", { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
  512 | });
  513 | 
  514 | test("主题变更不产生多余通知", async ({ page }) => {
  515 |   await seed(page, { scheme: "dark" });
  516 |   await page.setViewportSize({ width: 1280, height: 800 });
  517 |   await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  518 |   await page.goto("/");
  519 |   await page.evaluate(() => window.ClawboxThemeAPI.setAppearance("light"));
  520 |   await expect(page.locator(".toast-note")).toHaveCount(0);
  521 | });
  522 | 
```