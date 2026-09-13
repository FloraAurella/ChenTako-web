# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: visual.spec.js >> 上下文与提示词集中配置
- Location: e2e/visual.spec.js:393:1

# Error details

```
Error: expect(page).toHaveScreenshot(expected) failed

  22185 pixels (ratio 0.03 of all image pixels) are different.

  Snapshot: provider-advanced-open.png

Call log:
  - Expect "toHaveScreenshot(provider-advanced-open.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - 22185 pixels (ratio 0.03 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - captured a stable screenshot
  - 22185 pixels (ratio 0.03 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e5]:
  - generic [ref=e6]:
    - generic [ref=e7]:
      - button "返回对话" [ref=e8] [cursor=pointer]
      - generic [ref=e11]:
        - generic [ref=e12]: Settings · 设置
        - generic [ref=e13]: 设置
    - generic "本地服务正常" [ref=e16]
  - region "设置" [ref=e20]:
    - generic [ref=e21]:
      - complementary "设置目录" [ref=e22]:
        - heading "偏好设置" [level=2] [ref=e23]
        - searchbox "搜索设置" [ref=e29]
        - navigation "设置分类" [ref=e30]:
          - button [ref=e31] [cursor=pointer]:
            - strong [ref=e39]: 外观
          - button [ref=e40] [cursor=pointer]:
            - strong [ref=e46]: 模型与供应商
          - button [active] [ref=e47] [cursor=pointer]:
            - strong [ref=e52]: 上下文与提示词
          - button [ref=e53] [cursor=pointer]:
            - strong [ref=e58]: 工具
          - button [ref=e59] [cursor=pointer]:
            - strong [ref=e65]: 技能
          - button [ref=e66] [cursor=pointer]:
            - strong [ref=e72]: 数据管理
          - button [ref=e73] [cursor=pointer]:
            - strong [ref=e79]: 关于与更新
      - generic [ref=e81]:
        - heading "上下文与提示词" [level=2] [ref=e82]
        - generic [ref=e83]: 已自动保存
        - region "配置作用范围" [ref=e85]:
          - generic [ref=e86]:
            - generic [ref=e87]: 当前作用范围
            - generic [ref=e88]: 选择配置范围
            - combobox "选择配置范围" [ref=e89]:
              - option "聊天默认配置" [selected]
          - generic [ref=e90]:
            - strong [ref=e91]: 所有普通聊天
            - generic [ref=e92]: 项目未自定义时跟随更新
          - button "恢复应用默认" [ref=e93] [cursor=pointer]
        - region [ref=e94]:
          - heading "常用配置" [level=3] [ref=e96]
          - region [ref=e97]:
            - generic [ref=e98]:
              - heading "系统提示词" [level=3] [ref=e99]
              - paragraph [ref=e100]: 下次发送生效，切换模型时保留。
            - generic [ref=e101]:
              - generic [ref=e102]: 提示词内容
              - textbox "提示词内容" [ref=e104]:
                - /placeholder: 助手角色、回答方式与要求…
              - generic [ref=e105]:
                - generic [ref=e106]: 0 / 102,400 字符
                - button "展开编辑器" [ref=e107] [cursor=pointer]
                - button "清空提示词" [ref=e108] [cursor=pointer]
          - region [ref=e109]:
            - heading "上下文策略" [level=3] [ref=e111]
            - generic [ref=e112]:
              - generic [ref=e113]:
                - generic [ref=e114]: 压缩触发阈值（%）
                - spinbutton "压缩触发阈值（%）" [ref=e116]: "80"
                - paragraph [ref=e117]: 响应正常结束时达到此比例，自动压缩已完成历史。
              - generic [ref=e118]:
                - generic [ref=e119]: 压缩模型
                - combobox "压缩模型" [ref=e121]:
                  - option "与当前对话模型相同" [selected]
                  - option "示例供应商 / demo-model"
                  - option "示例供应商 / demo-pro"
                - paragraph [ref=e122]: 用于自动与手动压缩，项目资料不会进入摘要请求。
              - generic [ref=e123]:
                - generic [ref=e124]: 标题模型
                - combobox "标题模型" [ref=e126]:
                  - option "与当前对话模型相同" [selected]
                  - option "示例供应商 / demo-model"
                  - option "示例供应商 / demo-pro"
                - paragraph [ref=e127]: 首次发送时根据输入生成标题，每个对话仅尝试一次。
            - paragraph [ref=e128]: demo-model 的可用输入预算：116,326 Tokens（估算）。 预算自动扣除最大输出与 5% 安全余量，用量为估算。
        - region [ref=e129]:
          - heading "高级配置" [level=3] [ref=e131]
          - region [ref=e132]:
            - generic [ref=e133]:
              - heading "生成参数" [level=3] [ref=e134]
              - paragraph [ref=e135]: 以模型和 API 支持为准。
            - generic [ref=e136]:
              - generic [ref=e137]:
                - generic [ref=e138]: 默认思考强度
                - combobox "默认思考强度" [ref=e140]:
                  - option "轻量"
                  - option "中等" [selected]
                  - option "高"
                  - option "极高"
                  - option "最大"
                - paragraph [ref=e141]: 可在聊天中临时调整。
              - generic [ref=e142]:
                - generic [ref=e143]: Temperature
                - spinbutton "Temperature" [ref=e145]: "0.7"
                - paragraph [ref=e146]: 随机性；部分推理模型不支持。
              - generic [ref=e147]:
                - generic [ref=e148]: Top P
                - spinbutton "Top P" [ref=e150]: "1"
                - paragraph [ref=e151]: 采样范围；Gemini 思考模式不使用。
          - region [ref=e152]:
            - heading "输出与会话" [level=3] [ref=e154]
            - generic [ref=e155]:
              - generic [ref=e156]:
                - generic [ref=e157]: 流式输出
                - switch "流式输出" [checked] [ref=e159] [cursor=pointer]
                - paragraph [ref=e160]: 边生成边显示。
              - generic [ref=e161]:
                - generic [ref=e162]: 本地保存对话
                - switch "本地保存对话" [checked] [ref=e164] [cursor=pointer]
                - paragraph [ref=e165]: 仅影响新会话。
              - generic [ref=e166]:
                - generic [ref=e167]: User ID
                - textbox "User ID" [ref=e169]:
                  - /placeholder: 可选
                - paragraph [ref=e170]: 可选；Gemini 不使用。
          - region [ref=e171]:
            - generic [ref=e172]:
              - heading "模型兼容性" [level=3] [ref=e173]
              - paragraph [ref=e174]: 手动修正图片能力，对所有项目生效。
            - generic [ref=e175]: 选择模型
            - combobox "选择模型" [ref=e176]:
              - option "示例供应商 / demo-model" [selected]
              - option "示例供应商 / demo-pro"
            - generic [ref=e177]:
              - generic [ref=e178]:
                - generic [ref=e179]: 图片输入能力
                - combobox "图片输入能力" [ref=e180]:
                  - option "自动识别" [selected]
                  - option "支持"
                  - option "关闭"
              - generic [ref=e181]:
                - generic [ref=e182]: 图片输出能力
                - combobox "图片输出能力" [ref=e183]:
                  - option "自动识别" [selected]
                  - option "支持"
                  - option "关闭"
```

# Test source

```ts
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
  392 | 
  393 | test("上下文与提示词集中配置", async ({ page }) => {
  394 |   await seed(page, { hash: "#/settings/providers" });
  395 |   await page.goto("/");
  396 |   await page.locator('[data-section="context"]').click();
  397 |   await expect(page.locator("#cc-systemPrompt")).toBeVisible();
  398 |   await freezePage(page);
> 399 |   await expect(page).toHaveScreenshot("provider-advanced-open.png", { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
      |                      ^ Error: expect(page).toHaveScreenshot(expected) failed
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
  498 |   await expect(page).toHaveScreenshot("image-generation-pending-dark.png", { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
  499 | });
```