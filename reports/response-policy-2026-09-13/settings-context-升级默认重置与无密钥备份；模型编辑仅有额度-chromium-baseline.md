# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: settings-context.spec.js >> 升级默认重置与无密钥备份；模型编辑仅有额度
- Location: e2e/settings-context.spec.js:96:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('[data-model-row="model-a"] .provider-model-main')

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
        - generic [ref=e82]:
          - heading "模型与供应商" [level=2] [ref=e84]
          - button "添加供应商" [ref=e85] [cursor=pointer]
        - generic [ref=e86]:
          - complementary "已配置供应商" [ref=e87]:
            - generic [ref=e88]:
              - generic [ref=e89]: 已配置供应商
              - generic [ref=e90]: "1"
            - region "供应商列表" [ref=e91]:
              - button "OAI 示例供应商 已启用" [active] [ref=e92] [cursor=pointer]:
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
                    - text: https://example.com/v1
                - generic [ref=e121]:
                  - generic "修改自动保存" [ref=e122]:
                    - generic [ref=e123]: API Key
                    - generic [ref=e124]: Key 已配置
                  - generic [ref=e125]:
                    - textbox "API Key" [ref=e126]:
                      - /placeholder: 已保存 Key
                      - text: fixture
                    - button "显示 Key" [ref=e127] [cursor=pointer]
            - region [ref=e132]:
              - generic [ref=e133]:
                - heading "模型配置" [level=3] [ref=e135]
                - generic [ref=e136]:
                  - button "模型默认值" [ref=e137] [cursor=pointer]
                  - button [ref=e138] [cursor=pointer]
              - generic [ref=e142]:
                - generic [ref=e143]:
                  - generic "model-a · 最大输出 8.2K · 默认模型" [ref=e144]:
                    - generic [ref=e145]: model-a
                    - generic "上下文 131.1K" [ref=e147]: 131.1K
                  - button "测试模型" [ref=e148] [cursor=pointer]
                  - button "编辑模型" [ref=e155] [cursor=pointer]
                - generic [ref=e160]:
                  - generic "model-b · 最大输出 8.2K" [ref=e161]:
                    - generic [ref=e162]: model-b
                    - generic "上下文 131.1K" [ref=e164]: 131.1K
                  - button "测试模型" [ref=e165] [cursor=pointer]
                  - button "编辑模型" [ref=e172] [cursor=pointer]
              - button [ref=e177] [cursor=pointer]
```

# Test source

```ts
  5   | async function load(page, { hash = "#/settings/context", config = {}, project = {}, conversation = {}, legacy = false, scheme = "light", providerConfig = {} } = {}) {
  6   |   const seed = { settingsSchemaVersion: legacy ? undefined : 1, chatConfig: { ...defaults, ...config }, modelCompatibility: {}, providers: [{ ...provider, ...providerConfig }], projects: [{ id: "p", name: "写作项目", createdAt: 1, configOverrides: project }], activeProviderId: provider.id, activeConversationId: "c", conversations: [{ id: "c", providerId: provider.id, model: "model-a", messages: [], saveChats: true, ...conversation }] };
  7   |   await page.addInitScript(({ seed, scheme }) => {
  8   |     if (!localStorage.getItem("settings-test-seeded")) {
  9   |       localStorage.setItem("settings-test-seeded", "1");
  10  |       localStorage.setItem("tribblebook-v6-state", JSON.stringify(seed));
  11  |       localStorage.setItem("tribblebook-ui-preferences-v1", JSON.stringify({ themeId: "everforest", appearanceMode: scheme }));
  12  |     }
  13  |   }, { seed, scheme });
  14  |   await page.route("**/api/chat/title", r => r.fulfill({ json: { ok: true, title: "首次输入标题" } }));
  15  |   await page.route("**/api/health", (r) => r.fulfill({ json: { ok: true } }));
  16  |   await page.route("**/api/providers", (r) => r.fulfill({ json: { providers: [] } }));
  17  |   await page.route("**/api/providers/key*", (r) => r.fulfill({ json: { apiKey: "fixture" } }));
  18  |   await page.goto(`/${hash}`);
  19  |   await expect(page.locator("#appShell")).toBeVisible();
  20  | }
  21  | const save = async (page) => { await expect(page.locator(".context-auto-state")).toContainText("已自动保存"); };
  22  | 
  23  | test("聊天配置保存、项目空提示词覆盖与继承、重启", async ({ page }) => {
  24  |   await load(page, { config: { keepRecentTurns: 6 }, project: { keepRecentTurns: 2 } });
  25  |   await expect(page.getByRole("region", { name: "常用配置", exact: true }).getByLabel("提示词内容", { exact: true })).toBeVisible();
  26  |   await expect(page.getByRole("region", { name: "高级配置", exact: true }).getByLabel("Temperature", { exact: true })).toBeVisible();
  27  |   await expect(page.getByText("保留最近轮数", { exact: true })).toHaveCount(0);
  28  |   await page.getByLabel("提示词内容", { exact: true }).fill("统一的新提示词");
  29  |   await page.getByLabel("Temperature", { exact: true }).fill("0");
  30  |   await save(page);
  31  |   await page.getByLabel("选择配置范围").selectOption("p");
  32  |   await expect(page.locator("#cc-systemPrompt")).toBeDisabled();
  33  |   await page.locator("#context-prompt").getByRole("button", { name: "继承聊天 · 自定义" }).click();
  34  |   await page.locator("#cc-systemPrompt").fill("");
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
  74  |   await page.route("**/api/chat", async (r) => { sent++; await r.fulfill({ json: { choices: [{ message: { role: "assistant", content: "继续".repeat(600) } }] } }); });
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
> 105 |   await page.locator('[data-model-row="model-a"] .provider-model-main').click();
      |                                                                         ^ Error: locator.click: Test timeout of 30000ms exceeded.
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
  135 |         await expect(page.getByRole("region", { name: "高级配置", exact: true })).toBeVisible();
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
```