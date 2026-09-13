# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: visual.spec.js >> 图像生成等待态深色
- Location: e2e/visual.spec.js:488:1

# Error details

```
Error: expect(page).toHaveScreenshot(expected) failed

  14519 pixels (ratio 0.02 of all image pixels) are different.

  Snapshot: image-generation-pending-dark.png

Call log:
  - Expect "toHaveScreenshot(image-generation-pending-dark.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - 14519 pixels (ratio 0.02 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - captured a stable screenshot
  - 14519 pixels (ratio 0.02 of all image pixels) are different.

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
        - button "生成一张测试图片 今天" [ref=e54] [cursor=pointer]:
          - generic [ref=e55]:
            - generic [ref=e56]: 生成一张测试图片
            - generic "正在生成回复" [ref=e57]
          - generic [ref=e60]: 今天
    - navigation "应用导航" [ref=e62]:
      - button "设置" [ref=e63] [cursor=pointer]
  - main [ref=e68]:
    - generic [ref=e69]:
      - generic [ref=e71]:
        - generic [ref=e72]: Chat · 对话
        - generic [ref=e73]: 生成一张测试图片
      - generic "本地服务正常" [ref=e76]
    - region "对话" [ref=e80]:
      - generic [ref=e82]:
        - generic [ref=e83]:
          - paragraph [ref=e86]: 生成一张测试图片
          - generic [ref=e87]: 10:00
          - generic [ref=e88]:
            - button "复制" [ref=e89] [cursor=pointer]
            - button "编辑" [disabled] [ref=e93]
            - button "复制到新对话" [disabled] [ref=e97]
            - button "删除消息" [disabled] [ref=e103]
        - generic [ref=e106]:
          - generic [ref=e107]:
            - generic [ref=e112]: 示例供应商
            - generic [ref=e113]: demo-model
          - button "图片生成中" [disabled] [ref=e116]:
            - status [ref=e117]:
              - generic [ref=e119]: 正在生成图片
          - generic [ref=e120]: 正在生成图片
          - generic [ref=e123]:
            - button "复制" [ref=e124] [cursor=pointer]
            - button "编辑" [disabled] [ref=e128]
            - button "复制到新对话" [disabled] [ref=e132]
            - button "重新生成" [disabled] [ref=e138]
            - button "删除消息" [disabled] [ref=e141]
      - generic [ref=e145]:
        - generic [ref=e146]:
          - textbox "输入消息，/ 打开指令" [ref=e148]
          - generic [ref=e149]:
            - button "添加附件" [ref=e150] [cursor=pointer]
            - generic [ref=e153]:
              - button "demo-model 中等" [disabled] [ref=e154]:
                - generic [ref=e155]: demo-model
                - generic [ref=e156]: 中等
              - button "压缩上下文（已用约 0%）" [ref=e160] [cursor=pointer]
              - button "停止生成" [active] [ref=e165] [cursor=pointer]
        - generic [ref=e168]: Enter 发送 · Shift + Enter 换行
```

# Test source

```ts
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
> 498 |   await expect(page).toHaveScreenshot("image-generation-pending-dark.png", { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
      |                      ^ Error: expect(page).toHaveScreenshot(expected) failed
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