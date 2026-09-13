# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: visual.spec.js >> HTML 与 SVG 产物工具栏深色
- Location: e2e/visual.spec.js:467:1

# Error details

```
Error: expect(page).toHaveScreenshot(expected) failed

  30481 pixels (ratio 0.03 of all image pixels) are different.

  Snapshot: artifact-preview-toolbar-dark.png

Call log:
  - Expect "toHaveScreenshot(artifact-preview-toolbar-dark.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - 30481 pixels (ratio 0.03 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - captured a stable screenshot
  - 30481 pixels (ratio 0.03 of all image pixels) are different.

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
        - button "代码与产物视觉检查 今天" [ref=e54] [cursor=pointer]:
          - generic [ref=e55]: 代码与产物视觉检查
          - generic [ref=e57]: 今天
    - navigation "应用导航" [ref=e59]:
      - button "设置" [ref=e60] [cursor=pointer]
  - main [ref=e65]:
    - generic [ref=e66]:
      - generic [ref=e68]:
        - generic [ref=e69]: Chat · 对话
        - generic [ref=e70]: 代码与产物视觉检查
      - generic "本地服务正常" [ref=e73]
    - region "对话" [ref=e77]:
      - generic [ref=e79]:
        - generic [ref=e80]:
          - paragraph [ref=e83]: 创建一个 HTML 页面和 SVG 图标。
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
          - generic [ref=e112]:
            - paragraph [ref=e114]: 我已经生成了一个可运行的 HTML 页面和一个 SVG 图形。
            - generic [ref=e115]:
              - generic "工具运行记录" [ref=e116]:
                - group [ref=e117]:
                  - generic "调用了 代码解释器 clawbox_code_interpreter 已完成 · 1s" [ref=e118] [cursor=pointer]:
                    - generic [ref=e122]:
                      - generic [ref=e123]: 调用了 代码解释器
                      - generic [ref=e124]: clawbox_code_interpreter
                    - generic [ref=e125]: 已完成 · 1s
              - generic [ref=e129]:
                - generic [ref=e131]:
                  - generic "preview.html" [ref=e136]
                  - generic [ref=e137]: 19 B
                  - generic [ref=e138]:
                    - button "查看源码" [ref=e139] [cursor=pointer]
                    - button "运行 HTML" [ref=e142] [cursor=pointer]
                    - button "复制源码" [ref=e145] [cursor=pointer]
                    - button "下载文件" [ref=e149] [cursor=pointer]
                - generic [ref=e153]:
                  - generic "mark.svg" [ref=e158]
                  - generic [ref=e159]: 71 B
                  - generic [ref=e160]:
                    - button "查看源码" [ref=e161] [cursor=pointer]
                    - button "运行 SVG" [ref=e164] [cursor=pointer]
                    - button "复制源码" [ref=e167] [cursor=pointer]
                    - button "下载文件" [ref=e171] [cursor=pointer]
            - generic [ref=e174]:
              - paragraph [ref=e175]: 产物会留在创建位置；下面同时保留 HTML 源码。
              - generic [ref=e176]:
                - generic [ref=e177]:
                  - generic [ref=e178]: html
                  - generic [ref=e179]:
                    - button "收起代码" [expanded] [ref=e180] [cursor=pointer]
                    - button "运行 HTML" [ref=e183] [cursor=pointer]
                    - button "复制代码" [ref=e186] [cursor=pointer]
                - code [ref=e191]: <main class="preview-card"><h1>ChenTako</h1><p>一个受限沙箱中的页面预览。</p></main>
          - generic [ref=e192]: 09:59 · 2s
          - generic [ref=e193]:
            - button "复制" [ref=e194] [cursor=pointer]
            - button "编辑" [ref=e198] [cursor=pointer]
            - button "复制到新对话" [ref=e202] [cursor=pointer]
            - button "重新生成" [ref=e208] [cursor=pointer]
            - button "删除消息" [ref=e211] [cursor=pointer]
      - generic [ref=e215]:
        - generic [ref=e216]:
          - textbox "输入消息，/ 打开指令" [ref=e218]
          - generic [ref=e219]:
            - button "添加附件" [ref=e220] [cursor=pointer]
            - generic [ref=e223]:
              - button "demo-model 中等" [ref=e224] [cursor=pointer]:
                - generic [ref=e225]: demo-model
                - generic [ref=e226]: 中等
              - button "压缩上下文（已用约 7%）" [ref=e230] [cursor=pointer]
              - button "发送" [disabled] [ref=e235]
        - generic [ref=e238]: Enter 发送 · Shift + Enter 换行
```

# Test source

```ts
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
> 475 |   await expect(page).toHaveScreenshot("artifact-preview-toolbar-dark.png", { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
      |                      ^ Error: expect(page).toHaveScreenshot(expected) failed
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