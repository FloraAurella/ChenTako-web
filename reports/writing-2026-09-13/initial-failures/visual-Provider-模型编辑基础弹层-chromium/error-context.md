# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: visual.spec.js >> Provider 模型编辑基础弹层
- Location: e2e/visual.spec.js:370:1

# Error details

```
Error: expect(page).toHaveScreenshot(expected) failed

  26773 pixels (ratio 0.03 of all image pixels) are different.

  Snapshot: provider-model-dialog-basic.png

Call log:
  - Expect "toHaveScreenshot(provider-model-dialog-basic.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - 26773 pixels (ratio 0.03 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - captured a stable screenshot
  - 26773 pixels (ratio 0.03 of all image pixels) are different.

```

# Page snapshot

```yaml
- generic [ref=e2]:
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
            - button [ref=e47] [cursor=pointer]:
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
          - generic [ref=e82]:
            - heading "模型与供应商" [level=2] [ref=e84]
            - button "添加供应商" [ref=e85] [cursor=pointer]
          - generic [ref=e86]:
            - complementary "已配置供应商" [ref=e87]:
              - generic [ref=e88]:
                - generic [ref=e89]: 已配置供应商
                - generic [ref=e90]: "1"
              - region "供应商列表" [ref=e91]:
                - button "OAI 示例供应商 已启用" [ref=e92] [cursor=pointer]:
                  - generic [ref=e93]: OAI
                  - generic [ref=e94]:
                    - generic [ref=e95]: 示例供应商
                    - generic [ref=e96]: 已启用
            - main "供应商详情" [ref=e98]:
              - generic [ref=e99]:
                - generic [ref=e101]:
                  - heading "示例供应商" [level=3] [ref=e102]
                  - generic [ref=e103]: 已启用
                  - switch "允许用于聊天" [checked] [ref=e104] [cursor=pointer]
                  - status [ref=e105]: 已保存
                - button "删除供应商" [ref=e106] [cursor=pointer]
              - region "连接配置" [ref=e110]:
                - generic [ref=e111]:
                  - generic [ref=e112]:
                    - generic [ref=e113]: 显示名称
                    - textbox "显示名称" [ref=e114]: 示例供应商
                  - generic [ref=e115]:
                    - generic [ref=e116]: API 格式
                    - combobox "API 格式" [ref=e117]:
                      - option "OpenAI Responses"
                      - option "Anthropic Messages"
                      - option "OpenAI Chat Completions" [selected]
                      - option "Google Gemini"
                  - generic [ref=e118]:
                    - generic [ref=e119]: API Base URL
                    - textbox "API Base URL" [ref=e120]:
                      - /placeholder: https://api.example.com/v1
                      - text: https://api.example.com/v1
                  - generic [ref=e121]:
                    - generic "修改自动保存" [ref=e122]:
                      - generic [ref=e123]: API Key
                      - generic [ref=e124]: Key 未配置
                    - generic [ref=e125]:
                      - textbox "API Key" [ref=e126]:
                        - /placeholder: 尚未保存
                      - button "显示 Key" [ref=e127] [cursor=pointer]
              - region [ref=e132]:
                - generic [ref=e133]:
                  - heading "模型配置" [level=3] [ref=e135]
                  - generic [ref=e136]:
                    - button "模型默认值" [ref=e137] [cursor=pointer]
                    - button [ref=e138] [cursor=pointer]
                - generic [ref=e142]:
                  - generic [ref=e143]:
                    - generic "demo-model · 最大输出 8.2K · 默认模型" [ref=e144]:
                      - generic [ref=e145]: demo-model
                      - generic "上下文 131.1K" [ref=e147]: 131.1K
                    - button "测试模型" [ref=e148] [cursor=pointer]
                    - button "编辑模型" [ref=e155] [cursor=pointer]
                  - generic [ref=e160]:
                    - generic "demo-pro · 最大输出 8.2K" [ref=e161]:
                      - generic [ref=e162]: demo-pro
                      - generic "上下文 131.1K" [ref=e164]: 131.1K
                    - button "测试模型" [ref=e165] [cursor=pointer]
                    - button "编辑模型" [ref=e172] [cursor=pointer]
                - button [ref=e177] [cursor=pointer]
  - dialog [ref=e182]:
    - generic [ref=e183]:
      - generic [ref=e184]:
        - heading "编辑模型配置" [level=3] [ref=e185]
        - paragraph [ref=e186]: 设置上下文与输出限额。
      - button "关闭" [ref=e187] [cursor=pointer]
    - group [ref=e191]:
      - generic [ref=e192]:
        - generic [ref=e193]: 模型 ID
        - textbox "模型 ID" [active] [ref=e194]: demo-model
      - generic [ref=e195]:
        - generic [ref=e196]:
          - generic [ref=e197]: 上下文窗口
          - generic [ref=e198] [cursor=pointer]:
            - checkbox "使用模型默认值" [checked] [ref=e199]
            - text: 使用模型默认值
        - spinbutton "上下文窗口" [disabled] [ref=e200]: "131072"
      - generic [ref=e201]:
        - generic [ref=e202]:
          - generic [ref=e203]: 最大输出 Token
          - generic [ref=e204] [cursor=pointer]:
            - checkbox "使用模型默认值" [checked] [ref=e205]
            - text: 使用模型默认值
        - spinbutton "最大输出 Token" [disabled] [ref=e206]: "8192"
      - generic [ref=e207]:
        - checkbox "用作默认模型" [checked] [disabled] [ref=e208]
        - text: 用作默认模型
    - generic [ref=e209]:
      - button "删除模型" [ref=e210] [cursor=pointer]
      - button "取消" [ref=e211] [cursor=pointer]
      - button "保存更改" [ref=e212] [cursor=pointer]
```

# Test source

```ts
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
> 378 |   await expect(page).toHaveScreenshot("provider-model-dialog-basic.png", { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
      |                      ^ Error: expect(page).toHaveScreenshot(expected) failed
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
  475 |   await expect(page).toHaveScreenshot("artifact-preview-toolbar-dark.png", { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
  476 | });
  477 | 
  478 | test("HTML 与 SVG 产物工具栏移动端", async ({ page }) => {
```