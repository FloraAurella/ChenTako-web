# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: visual.spec.js >> Everforest 外观主题卡
- Location: e2e/visual.spec.js:308:1

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  locator('.theme-card')
Expected: 1
Received: 0
Timeout:  5000ms

Call log:
  - Expect "toHaveCount" with timeout 5000ms
  - waiting for locator('.theme-card')
    14 × locator resolved to 0 elements
       - unexpected value "0"

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
        - heading "外观" [level=2] [ref=e82]
        - region [ref=e83]:
          - heading "常用配置" [level=3] [ref=e85]
          - region [ref=e86]:
            - heading "明暗模式" [level=3] [ref=e88]
            - generic [ref=e89]:
              - generic [ref=e90] [cursor=pointer]:
                - radio "跟随系统"
                - generic [ref=e91]: 跟随系统
              - generic [ref=e96] [cursor=pointer]:
                - radio "浅色"
                - generic [ref=e97]: 浅色
              - generic [ref=e102] [cursor=pointer]:
                - radio "深色" [checked]
                - generic [ref=e103]: 深色
          - region [ref=e107]:
            - generic [ref=e108]:
              - heading "界面层次" [level=3] [ref=e109]
              - paragraph [ref=e110]: 深色 · 即时生效
            - generic [ref=e111]:
              - generic [ref=e112]:
                - generic [ref=e113]:
                  - generic [ref=e114]: 对比度
                  - status [ref=e115]: "60"
                - paragraph [ref=e116]: 背景与卡片的明暗差异。
                - slider "对比度" [ref=e117] [cursor=pointer]: "60"
                - generic [ref=e118]:
                  - generic [ref=e119]: 柔和
                  - generic [ref=e120]: 鲜明
              - generic [ref=e122]:
                - generic [ref=e123]:
                  - generic [ref=e124]: 透景模式
                  - generic [ref=e125]: 卡片与弹窗使用毛玻璃。
                - switch "开启透景模式" [ref=e126] [cursor=pointer]
```

# Test source

```ts
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
> 313 |   await expect(page.locator(".theme-card")).toHaveCount(1);
      |                                             ^ Error: expect(locator).toHaveCount(expected) failed
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
```