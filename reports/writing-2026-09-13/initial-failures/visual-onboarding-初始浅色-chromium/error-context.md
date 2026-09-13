# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: visual.spec.js >> onboarding 初始浅色
- Location: e2e/visual.spec.js:243:1

# Error details

```
Error: expect(page).toHaveScreenshot(expected) failed

  20369 pixels (ratio 0.04 of all image pixels) are different.

  Snapshot: onboarding-initial-light.png

Call log:
  - Expect "toHaveScreenshot(onboarding-initial-light.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - 20369 pixels (ratio 0.04 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - captured a stable screenshot
  - 20369 pixels (ratio 0.04 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e3]:
  - region [ref=e4]:
    - generic [ref=e5]:
      - generic [ref=e11]: ChenTako
      - generic [ref=e12]: LOCAL FIRST
    - generic [ref=e13]:
      - generic [ref=e14]:
        - paragraph [ref=e15]: 首次使用
        - heading "欢迎使用 ChenTako" [level=1] [ref=e16]
        - paragraph [ref=e17]: 全新开始，或导入已有数据。数据保存在本机。
        - generic [ref=e18]:
          - button "启动全新 ChenTako 创建本机数据。" [disabled] [ref=e19]:
            - generic [ref=e24]:
              - strong [ref=e25]: 启动全新 ChenTako
              - generic [ref=e26]: 创建本机数据。
          - button "从迁移包导入 恢复对话、主题与设置。" [disabled] [ref=e30]:
            - generic [ref=e35]:
              - strong [ref=e36]: 从迁移包导入
              - generic [ref=e37]: 恢复对话、主题与设置。
        - status [ref=e41]: 仅在桌面应用首次启动时可用。
      - complementary "迁移包由加密数据和密钥两个文件组成" [ref=e42]:
        - generic [ref=e43]:
          - generic [ref=e44]: 迁移封套
          - generic [ref=e45]: AES · 128 BIT
        - generic [ref=e46]:
          - generic [ref=e47]:
            - generic [ref=e52]: ENCRYPTED DATA
            - strong [ref=e53]: ChenTako-Data
            - generic [ref=e54]: 对话 · 附件 · 主题 · 设置
          - generic [ref=e55]:
            - generic [ref=e60]: KEY.MD
            - strong [ref=e61]: 128 位密钥
            - generic [ref=e62]: 随迁移 ZIP 一起保存
          - generic [ref=e63]: VERIFIED
        - paragraph [ref=e68]: 导入前校验文件，失败不写入数据。
    - generic [ref=e69]:
      - generic [ref=e70]: 数据只写入这台 Mac
      - code [ref=e75]: 本机应用数据目录
```

# Test source

```ts
  148 | function artifactPreviewState() {
  149 |   const conversationId = "visual-artifacts";
  150 |   const intro = "我已经生成了一个可运行的 HTML 页面和一个 SVG 图形。\n\n";
  151 |   const ending = [
  152 |     "产物会留在创建位置；下面同时保留 HTML 源码。",
  153 |     "",
  154 |     "```html",
  155 |     '<main class="preview-card"><h1>ChenTako</h1><p>一个受限沙箱中的页面预览。</p></main>',
  156 |     "```"
  157 |   ].join("\n");
  158 |   return {
  159 |     ...SEED_STATE,
  160 |     activeConversationId: conversationId,
  161 |     conversations: [{
  162 |       id: conversationId,
  163 |       title: "代码与产物视觉检查",
  164 |       createdAt: FIXED_NOW - 60_000,
  165 |       updatedAt: FIXED_NOW,
  166 |       pinned: false,
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
> 248 |   await expect(page).toHaveScreenshot("onboarding-initial-light.png", { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
      |                      ^ Error: expect(page).toHaveScreenshot(expected) failed
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
```