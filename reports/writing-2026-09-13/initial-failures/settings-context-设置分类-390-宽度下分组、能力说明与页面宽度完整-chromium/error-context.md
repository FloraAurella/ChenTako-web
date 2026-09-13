# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: settings-context.spec.js >> 设置分类 390 宽度下分组、能力说明与页面宽度完整
- Location: e2e/settings-context.spec.js:126:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('region', { name: '高级配置', exact: true })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('region', { name: '高级配置', exact: true })

```

```yaml
- main:
  - button "返回对话"
  - text: Settings · 设置 设置 本地服务正常
  - region "设置":
    - complementary "设置目录":
      - heading "偏好设置" [level=2]
      - searchbox "搜索设置"
      - navigation "设置分类":
        - button "外观":
          - strong: 外观
        - button "模型与供应商":
          - strong: 模型与供应商
        - button "上下文与提示词":
          - strong: 上下文与提示词
        - button "工具":
          - strong: 工具
        - button "技能":
          - strong: 技能
        - button "数据管理":
          - strong: 数据管理
        - button "关于与更新":
          - strong: 关于与更新
    - button "返回"
    - heading "外观" [level=2]
    - region "常用配置":
      - heading "常用配置" [level=3]
      - region "明暗模式":
        - heading "明暗模式" [level=3]
        - radio "跟随系统"
        - text: 跟随系统
        - radio "浅色" [checked]
        - text: 浅色
        - radio "深色"
        - text: 深色
      - region "界面层次":
        - heading "界面层次" [level=3]
        - paragraph: 浅色 · 即时生效
        - text: 对比度
        - status: "60"
        - paragraph: 背景与卡片的明暗差异。
        - slider "对比度": "60"
        - text: 柔和 鲜明 透景模式 卡片与弹窗使用毛玻璃。
        - switch "开启透景模式"
- navigation "主导航":
  - button "对话"
  - button "设置"
```

# Test source

```ts
  35  |   await save(page);
  36  |   await expect.poll(async () => (await saved(page)).projects[0].configOverrides).toEqual({ systemPrompt: "" });
  37  |   await page.reload();
  38  |   await expect(page.locator("#cc-systemPrompt")).toHaveValue("");
  39  |   await expect(page.locator("#cc-temperature")).toHaveValue("0");
  40  |   await page.getByRole("button", { name: "全部恢复继承" }).click();
  41  |   await expect(page.locator("#cc-systemPrompt")).toHaveValue("统一的新提示词");
  42  |   await save(page);
  43  | });
  44  | 
  45  | test("一级配置跨项目导航前自动保存，项目继承最新配置", async ({ page }) => {
  46  |   await load(page);
  47  |   await page.locator("#cc-systemPrompt").fill("即时保存");
  48  |   await page.getByLabel("选择配置范围").selectOption("p");
  49  |   await expect(page.locator(".dialog-card")).toHaveCount(0);
  50  |   await expect(page.locator("#context-scope")).toHaveValue("p");
  51  |   await expect(page.locator("#cc-systemPrompt")).toHaveValue("即时保存");
  52  |   expect((await saved(page)).chatConfig.systemPrompt).toBe("即时保存");
  53  | });
  54  | 
  55  | test("新请求使用项目配置而非供应商提示词", async ({ page }) => {
  56  |   let body;
  57  |   await load(page, { hash: "#/chat", project: { systemPrompt: "项目专属", temperature: 0.2 }, conversation: { projectId: "p" } });
  58  |   await page.route("**/api/chat", async (r) => { body = r.request().postDataJSON(); await r.fulfill({ json: { choices: [{ message: { role: "assistant", content: "已完成" } }] } }); });
  59  |   await page.locator("#composerInput").fill("你好");
  60  |   await page.locator("#sendBtn").click();
  61  |   await expect.poll(() => body?.chatConfig?.systemPrompt).toBe("项目专属");
  62  |   expect(body.chatConfig.temperature).toBe(0.2);
  63  |   expect(body.chatConfig.version).toBe(1);
  64  |   expect(body.stream).toBe(false);
  65  |   expect(JSON.stringify(body)).not.toContain("obsolete-provider-prompt");
  66  |   await expect(page.locator("#messageList")).toContainText("已完成");
  67  | });
  68  | 
  69  | test("响应结束达到阈值压缩全部已完成历史，包含最新回答", async ({ page }) => {
  70  |   let sent = 0; let compressed;
  71  |   const messages = Array.from({ length: 4 }, (_, i) => [{ id: `u${i}`, role: "user", content: "历史内容".repeat(100) }, { id: `a${i}`, role: "assistant", content: "历史回复".repeat(100) }]).flat();
  72  |   await load(page, { hash: "#/chat", config: { compressionThreshold: 80 }, providerConfig: { contextWindow: 4000, maxTokens: 1000 }, conversation: { messages } });
  73  |   await page.route("**/api/chat/compress", async (r) => { compressed = r.request().postDataJSON(); await r.fulfill({ json: { summary: "此前讨论了项目计划。" } }); });
  74  |   await page.route("**/api/chat", async (r) => { sent++; await r.fulfill({ json: { choices: [{ message: { role: "assistant", content: "继续".repeat(300) } }], usage: { prompt_tokens: 3000, completion_tokens: 500, total_tokens: 3500 } } }); });
  75  |   await page.locator("#composerInput").fill("接着讲");
  76  |   await page.locator("#sendBtn").click();
  77  |   await expect.poll(() => sent).toBe(1);
  78  |   await expect.poll(() => compressed?.messages?.length).toBe(10);
  79  |   expect(compressed.messages.at(-2).content).toBe("接着讲");
  80  |   await expect(page.locator("#messageList")).toContainText("继续");
  81  | });
  82  | 
  83  | test("响应后压缩失败保留历史，不无限重试", async ({ page }) => {
  84  |   let attempts = 0; let sent = 0;
  85  |   const messages = Array.from({ length: 4 }, (_, i) => [{ id: `u${i}`, role: "user", content: "历史".repeat(500) }, { id: `a${i}`, role: "assistant", content: "回复".repeat(500) }]).flat();
  86  |   await load(page, { hash: "#/chat", config: { compressionThreshold: 80 }, providerConfig: { contextWindow: 6000, maxTokens: 1000 }, conversation: { messages } });
  87  |   await page.route("**/api/chat/compress", (r) => { attempts++; return r.fulfill({ status: 500, json: { error: "测试压缩失败" } }); });
  88  |   await page.route("**/api/chat", (r) => { sent++; return r.fulfill({ json: { choices: [{ message: { content: "完成" } }] } }); });
  89  |   await page.locator("#composerInput").fill("保留这条输入");
  90  |   await page.locator("#sendBtn").click();
  91  |   await expect(page.locator("#page-chat")).toContainText("测试压缩失败");
  92  |   await expect(page.locator("#messageList")).toContainText("保留这条输入");
  93  |   expect(attempts).toBe(1); expect(sent).toBe(1);
  94  | });
  95  | 
  96  | test("升级默认重置与无密钥备份；模型编辑仅有额度", async ({ page }) => {
  97  |   await load(page, { legacy: true });
  98  |   await expect(page.locator("#cc-systemPrompt")).toHaveValue("");
  99  |   await page.locator('[data-section="data"]').click();
  100 |   await page.locator(".settings-legacy-details > summary").click();
  101 |   await expect(page.locator(".settings-backup")).toContainText("obsolete-provider-prompt");
  102 |   await expect(page.locator(".settings-backup")).not.toContainText('"apiKey"');
  103 |   await page.locator('[data-section="providers"]').click();
  104 |   await page.locator('[data-edit-provider="settings-provider"]').click();
  105 |   await page.locator('[data-model-row="model-a"] .provider-model-edit').click();
  106 |   await expect(page.locator("#model-contextWindow")).toBeVisible();
  107 |   await expect(page.locator("#model-maxTokens")).toBeVisible();
  108 |   await expect(page.locator(".provider-model-advanced-toggle")).toHaveCount(0);
  109 |   await expect(page.locator("#pf-system")).toHaveCount(0);
  110 | });
  111 | 
  112 | test("设置搜索定位与所有分类无横向溢出", async ({ page }) => {
  113 |   await load(page);
  114 |   await page.getByLabel("搜索设置").fill("图片输入");
  115 |   await page.getByRole("button", { name: "模型兼容性 上下文与提示词" }).click();
  116 |   await expect(page.locator("#context-compatibility")).toBeFocused();
  117 |   await page.getByLabel("搜索设置").fill("");
  118 |   for (const key of ["appearance", "providers", "context", "tools", "skills", "data", "about"]) {
  119 |     await page.locator(`[data-section="${key}"]`).click();
  120 |     await expect(page.locator("#settingsContent .settings-pane").first()).toBeVisible();
  121 |     expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  122 |   }
  123 | });
  124 | 
  125 | for (const width of [1024, 390]) {
  126 |   test(`设置分类 ${width} 宽度下分组、能力说明与页面宽度完整`, async ({ page }) => {
  127 |     await page.setViewportSize({ width, height: 900 });
  128 |     await load(page, { hash: "#/settings/appearance" });
  129 |     for (const key of ["appearance", "providers", "context", "tools", "skills", "data", "about"]) {
  130 |       await page.goto(`/#/settings/${key}`);
  131 |       await expect(page.locator("#settingsContent .settings-pane").first()).toBeVisible();
  132 |       expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  133 |       if (key === "appearance" || key === "data") {
  134 |         await expect(page.getByRole("region", { name: "常用配置", exact: true })).toBeVisible();
> 135 |         await expect(page.getByRole("region", { name: "高级配置", exact: true })).toBeVisible();
      |                                                                               ^ Error: expect(locator).toBeVisible() failed
  136 |       }
  137 |       if (key === "tools" || key === "skills") {
  138 |         await expect(page.locator("[data-extension-capability]")).toContainText("执行尚未开放");
  139 |       }
  140 |     }
  141 |   });
  142 | }
  143 | for (const [width, scheme] of [[1280, "light"], [1024, "dark"], [390, "light"]]) {
  144 |   test(`上下文设置视觉 ${width} ${scheme}`, async ({ page }) => {
  145 |     await page.setViewportSize({ width, height: 900 });
  146 |     await load(page, { scheme, hash: "#/settings/context/p", project: { systemPrompt: "专注于项目写作，先说明结论，再给出必要依据。" } });
  147 |     await expect(page.locator("#cc-systemPrompt")).toBeVisible();
  148 |     await page.evaluate(() => document.fonts.ready);
  149 |     await expect(page).toHaveScreenshot(`context-${width}-${scheme}.png`, { animations: "disabled", caret: "hide" });
  150 |     expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  151 |     await page.locator("#context-budget").scrollIntoViewIfNeeded();
  152 |     await expect(page.locator("#context-budget")).toHaveScreenshot(`context-budget-${width}-${scheme}.png`, { animations: "disabled", caret: "hide" });
  153 |   });
  154 | }
  155 | 
  156 | test("项目浮窗不导航，独立上下文设置保留能力覆盖", async ({ page }) => {
  157 |   await load(page);
  158 |   await page.locator("#cc-visionInput").selectOption("false");
  159 |   await save(page);
  160 |   await page.evaluate(() => { location.hash = "#/chat"; });
  161 |   await expect(page.locator("#composerInput")).toBeVisible();
  162 |   await page.locator('[data-project-id="p"] .project-row').hover();
  163 |   await page.locator('[data-project-id="p"] [data-project-action="menu"]').click();
  164 |   await expect(page.getByRole("dialog", { name: "项目设置", exact: true })).toBeVisible();
  165 |   await expect(page).toHaveURL(/#\/chat$/);
  166 |   await page.getByRole("button", { name: "关闭项目设置", exact: true }).click();
  167 |   await page.evaluate(() => { location.hash = "#/settings/context/p"; });
  168 |   await expect(page.locator("#context-scope")).toHaveValue("p");
  169 |   await expect(page.locator("#cc-visionInput")).toHaveValue("false");
  170 |   await page.evaluate(() => { location.hash = "#/chat"; });
  171 |   await page.evaluate(() => { location.hash = "#/settings/context/p"; });
  172 |   await expect(page.locator("#cc-systemPrompt")).toBeVisible();
  173 | });
  174 | 
  175 | test("发送前超预算保留输入，工具栏思考强度可恢复继承", async ({ page }) => {
  176 |   let sent = 0;
  177 |   await load(page, { hash: "#/chat", config: { defaultReasoningEffort: "high" }, providerConfig: { contextWindow: 1200, maxTokens: 1000 } });
  178 |   await page.route("**/api/chat", (r) => { sent++; return r.abort(); });
  179 |   await page.locator("#composerInput").fill("超出预算".repeat(100));
  180 |   await page.locator("#sendBtn").click();
  181 |   await expect(page.locator("#page-chat")).toContainText("超过输入预算");
  182 |   await expect(page.locator("#composerInput")).not.toHaveValue(""); expect(sent).toBe(0);
  183 |   await page.locator("#runtimeBtn").click();
  184 |   await page.locator('[data-runtime-open="effort"]').click();
  185 |   await expect(page.locator("[data-effort-current]")).toHaveText("高");
  186 |   await page.locator(".effort-rail").focus(); await page.keyboard.press("Home");
  187 |   await expect(page.locator("[data-effort-source]")).toHaveText("当前会话自定义");
  188 |   await page.getByRole("button", { name: "恢复跟随配置" }).click();
  189 |   await expect(page.locator("[data-effort-current]")).toHaveText("高");
  190 |   await expect(page.locator("[data-effort-source]")).toHaveText("正在跟随配置");
  191 | });
  192 | 
  193 | test("低于阈值保留全部历史，不因轮数触发压缩", async ({ page }) => {
  194 |   let compressed = 0; let body;
  195 |   const messages = Array.from({ length: 10 }, (_, i) => [
  196 |     { id: `u${i}`, role: "user", content: `问题${i}` },
  197 |     { id: `a${i}`, role: "assistant", content: `回复${i}` }
  198 |   ]).flat();
  199 |   await load(page, { hash: "#/chat", config: { autoCompress: true }, conversation: { messages } });
  200 |   await page.route("**/api/chat/compress", (r) => { compressed++; return r.abort(); });
  201 |   await page.route("**/api/chat", (r) => { body = r.request().postDataJSON(); return r.fulfill({ json: { choices: [{ message: { role: "assistant", content: "完成" } }] } }); });
  202 |   await page.locator("#composerInput").fill("继续");
  203 |   await page.locator("#sendBtn").click();
  204 |   await expect.poll(() => body?.messages?.length).toBe(21);
  205 |   expect(compressed).toBe(0);
  206 | });
  207 | 
```