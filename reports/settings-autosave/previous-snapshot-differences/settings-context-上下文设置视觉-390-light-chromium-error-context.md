# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: settings-context.spec.js >> 上下文设置视觉 390 light
- Location: e2e/settings-context.spec.js:143:3

# Error details

```
Error: expect(page).toHaveScreenshot(expected) failed

  14673 pixels (ratio 0.05 of all image pixels) are different.

  Snapshot: context-390-light.png

Call log:
  - Expect "toHaveScreenshot(context-390-light.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - 14673 pixels (ratio 0.05 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - captured a stable screenshot
  - 14673 pixels (ratio 0.05 of all image pixels) are different.

```

# Page snapshot

```yaml
- generic [ref=e4]:
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
        - generic [ref=e80]:
          - button "返回" [ref=e81] [cursor=pointer]
          - generic [ref=e85]:
            - heading "上下文与提示词" [level=2] [ref=e86]
            - generic [ref=e87]: 已自动保存
            - region "配置作用范围" [ref=e89]:
              - generic [ref=e90]:
                - generic [ref=e91]: 当前作用范围
                - generic [ref=e92]: 选择配置范围
                - combobox "选择配置范围" [ref=e93]:
                  - option "聊天默认配置"
                  - option "写作项目" [selected]
              - generic [ref=e94]:
                - strong [ref=e95]: 1 项自定义
                - generic [ref=e96]: 其余设置继承默认值
              - button "全部恢复继承" [ref=e97] [cursor=pointer]
            - region [ref=e98]:
              - heading "常用配置" [level=3] [ref=e100]
              - region [ref=e101]:
                - generic [ref=e102]:
                  - heading "系统提示词" [level=3] [ref=e103]
                  - paragraph [ref=e104]: 覆盖默认提示词；留空则不使用。
                - generic [ref=e105]:
                  - generic [ref=e106]:
                    - generic [ref=e107]: 提示词内容
                    - button "自定义 · 恢复继承" [ref=e108] [cursor=pointer]
                  - textbox "提示词内容" [ref=e109]:
                    - /placeholder: 助手角色、回答方式与要求…
                    - text: 专注于项目写作，先说明结论，再给出必要依据。
                  - generic [ref=e110]:
                    - generic [ref=e111]: 22 / 102,400 字符
                    - button "展开编辑器" [ref=e112] [cursor=pointer]
                    - button "清空提示词" [ref=e113] [cursor=pointer]
              - region [ref=e114]:
                - heading "上下文策略" [level=3] [ref=e116]
                - generic [ref=e117]:
                  - generic [ref=e118]:
                    - generic [ref=e119]:
                      - generic [ref=e120]: 输入预算（Tokens）
                      - button "继承聊天 · 自定义" [ref=e121] [cursor=pointer]
                    - spinbutton "输入预算（Tokens）" [disabled] [ref=e122]
                    - paragraph [ref=e123]: 留空 = 模型窗口 − 最大输出 − 5% 安全余量。
                  - generic [ref=e124]:
                    - generic [ref=e125]:
                      - generic [ref=e126]: 自动压缩历史
                      - button "继承聊天 · 自定义" [ref=e127] [cursor=pointer]
                    - switch "自动压缩历史" [disabled] [ref=e128]
                    - paragraph [ref=e129]: 达阈值后额外请求模型压缩历史，保留聊天记录。
                  - generic [ref=e130]:
                    - generic [ref=e131]:
                      - generic [ref=e132]: 压缩触发阈值（%）
                      - button "继承聊天 · 自定义" [ref=e133] [cursor=pointer]
                    - spinbutton "压缩触发阈值（%）" [disabled] [ref=e134]: "80"
                    - paragraph [ref=e135]: 达到输入预算的此比例时压缩。
                - paragraph [ref=e136]: model-a 的可用输入预算：116,326 Tokens（估算）。 按当前模型发送，用量为估算。
            - region [ref=e137]:
              - heading "高级配置" [level=3] [ref=e139]
              - region [ref=e140]:
                - generic [ref=e141]:
                  - heading "生成参数" [level=3] [ref=e142]
                  - paragraph [ref=e143]: 以模型和 API 支持为准。
                - generic [ref=e144]:
                  - generic [ref=e145]:
                    - generic [ref=e146]:
                      - generic [ref=e147]: 默认思考强度
                      - button "继承聊天 · 自定义" [ref=e148] [cursor=pointer]
                    - combobox "默认思考强度" [disabled] [ref=e149]:
                      - option "轻量"
                      - option "中等" [selected]
                      - option "高"
                      - option "极高"
                      - option "最大"
                    - paragraph [ref=e150]: 可在聊天中临时调整。
                  - generic [ref=e151]:
                    - generic [ref=e152]:
                      - generic [ref=e153]: Temperature
                      - button "继承聊天 · 自定义" [ref=e154] [cursor=pointer]
                    - spinbutton "Temperature" [disabled] [ref=e155]: "0.7"
                    - paragraph [ref=e156]: 随机性；部分推理模型不支持。
                  - generic [ref=e157]:
                    - generic [ref=e158]:
                      - generic [ref=e159]: Top P
                      - button "继承聊天 · 自定义" [ref=e160] [cursor=pointer]
                    - spinbutton "Top P" [disabled] [ref=e161]: "1"
                    - paragraph [ref=e162]: 采样范围；Gemini 思考模式不使用。
              - region [ref=e163]:
                - heading "输出与会话" [level=3] [ref=e165]
                - generic [ref=e166]:
                  - generic [ref=e167]:
                    - generic [ref=e168]:
                      - generic [ref=e169]: 流式输出
                      - button "继承聊天 · 自定义" [ref=e170] [cursor=pointer]
                    - switch "流式输出" [disabled] [ref=e171]
                    - paragraph [ref=e172]: 边生成边显示。
                  - generic [ref=e173]:
                    - generic [ref=e174]:
                      - generic [ref=e175]: 本地保存对话
                      - button "继承聊天 · 自定义" [ref=e176] [cursor=pointer]
                    - switch "本地保存对话" [checked] [disabled] [ref=e177]
                    - paragraph [ref=e178]: 仅影响新会话。
                  - generic [ref=e179]:
                    - generic [ref=e180]:
                      - generic [ref=e181]: User ID
                      - button "继承聊天 · 自定义" [ref=e182] [cursor=pointer]
                    - textbox "User ID" [disabled] [ref=e183]:
                      - /placeholder: 可选
                    - paragraph [ref=e184]: 可选；Gemini 不使用。
              - region [ref=e185]:
                - generic [ref=e186]:
                  - heading "模型兼容性" [level=3] [ref=e187]
                  - paragraph [ref=e188]: 手动修正图片能力，对所有项目生效。
                - generic [ref=e189]: 选择模型
                - combobox "选择模型" [ref=e190]:
                  - option "示例供应商 / model-a" [selected]
                  - option "示例供应商 / model-b"
                - generic [ref=e191]:
                  - generic [ref=e192]:
                    - generic [ref=e193]: 图片输入能力
                    - combobox "图片输入能力" [ref=e194]:
                      - option "自动识别" [selected]
                      - option "支持"
                      - option "关闭"
                  - generic [ref=e195]:
                    - generic [ref=e196]: 图片输出能力
                    - combobox "图片输出能力" [ref=e197]:
                      - option "自动识别" [selected]
                      - option "支持"
                      - option "关闭"
  - navigation "主导航" [ref=e198]:
    - button "对话" [ref=e199] [cursor=pointer]
    - button "设置" [ref=e203] [cursor=pointer]
```

# Test source

```ts
  48  |   await expect(page.locator(".dialog-card")).toHaveCount(0);
  49  |   await expect(page.locator("#context-scope")).toHaveValue("p");
  50  |   await expect(page.locator("#cc-systemPrompt")).toHaveValue("即时保存");
  51  |   expect((await saved(page)).chatConfig.systemPrompt).toBe("即时保存");
  52  | });
  53  | 
  54  | test("新请求使用项目配置而非供应商提示词", async ({ page }) => {
  55  |   let body;
  56  |   await load(page, { hash: "#/chat", project: { systemPrompt: "项目专属", temperature: 0.2 }, conversation: { projectId: "p" } });
  57  |   await page.route("**/api/chat", async (r) => { body = r.request().postDataJSON(); await r.fulfill({ json: { choices: [{ message: { role: "assistant", content: "已完成" } }] } }); });
  58  |   await page.locator("#composerInput").fill("你好");
  59  |   await page.locator("#sendBtn").click();
  60  |   await expect.poll(() => body?.chatConfig?.systemPrompt).toBe("项目专属");
  61  |   expect(body.chatConfig.temperature).toBe(0.2);
  62  |   expect(body.chatConfig.version).toBe(1);
  63  |   expect(body.stream).toBe(false);
  64  |   expect(JSON.stringify(body)).not.toContain("obsolete-provider-prompt");
  65  |   await expect(page.locator("#messageList")).toContainText("已完成");
  66  | });
  67  | 
  68  | test("达到预算阈值压缩全部已完成历史，保留待发送消息", async ({ page }) => {
  69  |   let sent = 0; let compressed;
  70  |   const messages = Array.from({ length: 4 }, (_, i) => [{ id: `u${i}`, role: "user", content: "历史内容".repeat(100) }, { id: `a${i}`, role: "assistant", content: "历史回复".repeat(100) }]).flat();
  71  |   await load(page, { hash: "#/chat", config: { inputBudget: 1500, autoCompress: true }, conversation: { messages } });
  72  |   await page.route("**/api/chat/compress", async (r) => { compressed = r.request().postDataJSON(); await r.fulfill({ json: { summary: "此前讨论了项目计划。" } }); });
  73  |   await page.route("**/api/chat", async (r) => { sent++; await r.fulfill({ json: { choices: [{ message: { role: "assistant", content: "继续" } }] } }); });
  74  |   await page.locator("#composerInput").fill("接着讲");
  75  |   await page.locator("#sendBtn").click();
  76  |   await expect.poll(() => sent).toBe(1);
  77  |   expect(compressed.messages).toHaveLength(8);
  78  |   expect(compressed.messages.every((m) => m.content !== "接着讲")).toBe(true);
  79  |   await expect(page.locator("#messageList")).toContainText("继续");
  80  | });
  81  | 
  82  | test("压缩失败保留草稿，不发送、不无限重试", async ({ page }) => {
  83  |   let attempts = 0; let sent = 0;
  84  |   const messages = Array.from({ length: 4 }, (_, i) => [{ id: `u${i}`, role: "user", content: "历史".repeat(500) }, { id: `a${i}`, role: "assistant", content: "回复".repeat(500) }]).flat();
  85  |   await load(page, { hash: "#/chat", config: { inputBudget: 1000, autoCompress: true }, conversation: { messages } });
  86  |   await page.route("**/api/chat/compress", (r) => { attempts++; return r.fulfill({ status: 500, json: { error: "测试压缩失败" } }); });
  87  |   await page.route("**/api/chat", (r) => { sent++; return r.abort(); });
  88  |   await page.locator("#composerInput").fill("保留这条输入");
  89  |   await page.locator("#sendBtn").click();
  90  |   await expect(page.locator("#page-chat")).toContainText("测试压缩失败");
  91  |   await expect(page.locator("#composerInput")).toHaveValue("保留这条输入");
  92  |   expect(attempts).toBe(1); expect(sent).toBe(0);
  93  | });
  94  | 
  95  | test("升级默认重置与无密钥备份；模型编辑仅有额度", async ({ page }) => {
  96  |   await load(page, { legacy: true });
  97  |   await expect(page.locator("#cc-systemPrompt")).toHaveValue("");
  98  |   await page.locator('[data-section="data"]').click();
  99  |   await page.locator(".settings-legacy-details > summary").click();
  100 |   await expect(page.locator(".settings-backup")).toContainText("obsolete-provider-prompt");
  101 |   await expect(page.locator(".settings-backup")).not.toContainText('"apiKey"');
  102 |   await page.locator('[data-section="providers"]').click();
  103 |   await page.locator('[data-edit-provider="settings-provider"]').click();
  104 |   await page.locator('[data-model-row="model-a"] .provider-model-main').click();
  105 |   await expect(page.locator("#model-contextWindow")).toBeVisible();
  106 |   await expect(page.locator("#model-maxTokens")).toBeVisible();
  107 |   await expect(page.locator(".provider-model-advanced-toggle")).toHaveCount(0);
  108 |   await expect(page.locator("#pf-system")).toHaveCount(0);
  109 | });
  110 | 
  111 | test("设置搜索定位与所有分类无横向溢出", async ({ page }) => {
  112 |   await load(page);
  113 |   await page.getByLabel("搜索设置").fill("图片输入");
  114 |   await page.getByRole("button", { name: "模型兼容性 上下文与提示词" }).click();
  115 |   await expect(page.locator("#context-compatibility")).toBeFocused();
  116 |   await page.getByLabel("搜索设置").fill("");
  117 |   for (const key of ["appearance", "providers", "context", "tools", "skills", "data", "about"]) {
  118 |     await page.locator(`[data-section="${key}"]`).click();
  119 |     await expect(page.locator("#settingsContent .settings-pane").first()).toBeVisible();
  120 |     expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  121 |   }
  122 | });
  123 | 
  124 | for (const width of [1024, 390]) {
  125 |   test(`设置分类 ${width} 宽度下分组、能力说明与页面宽度完整`, async ({ page }) => {
  126 |     await page.setViewportSize({ width, height: 900 });
  127 |     await load(page, { hash: "#/settings/appearance" });
  128 |     for (const key of ["appearance", "providers", "context", "tools", "skills", "data", "about"]) {
  129 |       await page.goto(`/#/settings/${key}`);
  130 |       await expect(page.locator("#settingsContent .settings-pane").first()).toBeVisible();
  131 |       expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  132 |       if (key === "appearance" || key === "data") {
  133 |         await expect(page.getByRole("region", { name: "常用配置", exact: true })).toBeVisible();
  134 |         await expect(page.getByRole("region", { name: "高级配置", exact: true })).toBeVisible();
  135 |       }
  136 |       if (key === "tools" || key === "skills") {
  137 |         await expect(page.locator("[data-extension-capability]")).toContainText("执行尚未开放");
  138 |       }
  139 |     }
  140 |   });
  141 | }
  142 | for (const [width, scheme] of [[1280, "light"], [1024, "dark"], [390, "light"]]) {
  143 |   test(`上下文设置视觉 ${width} ${scheme}`, async ({ page }) => {
  144 |     await page.setViewportSize({ width, height: 900 });
  145 |     await load(page, { scheme, hash: "#/settings/context/p", project: { systemPrompt: "专注于项目写作，先说明结论，再给出必要依据。" } });
  146 |     await expect(page.locator("#cc-systemPrompt")).toBeVisible();
  147 |     await page.evaluate(() => document.fonts.ready);
> 148 |     await expect(page).toHaveScreenshot(`context-${width}-${scheme}.png`, { animations: "disabled", caret: "hide" });
      |                        ^ Error: expect(page).toHaveScreenshot(expected) failed
  149 |     expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  150 |     await page.locator("#context-budget").scrollIntoViewIfNeeded();
  151 |     await expect(page.locator("#context-budget")).toHaveScreenshot(`context-budget-${width}-${scheme}.png`, { animations: "disabled", caret: "hide" });
  152 |   });
  153 | }
  154 | 
  155 | test("项目浮窗不导航，独立上下文设置保留能力覆盖", async ({ page }) => {
  156 |   await load(page);
  157 |   await page.locator("#cc-visionInput").selectOption("false");
  158 |   await save(page);
  159 |   await page.evaluate(() => { location.hash = "#/chat"; });
  160 |   await expect(page.locator("#composerInput")).toBeVisible();
  161 |   await page.locator('[data-project-id="p"] .project-row').hover();
  162 |   await page.locator('[data-project-id="p"] [data-project-action="menu"]').click();
  163 |   await expect(page.getByRole("dialog", { name: "项目设置", exact: true })).toBeVisible();
  164 |   await expect(page).toHaveURL(/#\/chat$/);
  165 |   await page.getByRole("button", { name: "关闭项目设置", exact: true }).click();
  166 |   await page.evaluate(() => { location.hash = "#/settings/context/p"; });
  167 |   await expect(page.locator("#context-scope")).toHaveValue("p");
  168 |   await expect(page.locator("#cc-visionInput")).toHaveValue("false");
  169 |   await page.evaluate(() => { location.hash = "#/chat"; });
  170 |   await page.evaluate(() => { location.hash = "#/settings/context/p"; });
  171 |   await expect(page.locator("#cc-systemPrompt")).toBeVisible();
  172 | });
  173 | 
  174 | test("自动压缩关闭时超预算保留输入，工具栏思考强度可恢复继承", async ({ page }) => {
  175 |   let sent = 0;
  176 |   await load(page, { hash: "#/chat", config: { inputBudget: 50, defaultReasoningEffort: "high" } });
  177 |   await page.route("**/api/chat", (r) => { sent++; return r.abort(); });
  178 |   await page.locator("#composerInput").fill("超出预算".repeat(100));
  179 |   await page.locator("#sendBtn").click();
  180 |   await expect(page.locator("#page-chat")).toContainText("超过输入预算");
  181 |   await expect(page.locator("#composerInput")).not.toHaveValue(""); expect(sent).toBe(0);
  182 |   await page.locator("#runtimeBtn").click();
  183 |   await page.locator('[data-runtime-open="effort"]').click();
  184 |   await expect(page.locator("[data-effort-current]")).toHaveText("高");
  185 |   await page.locator(".effort-rail").focus(); await page.keyboard.press("Home");
  186 |   await expect(page.locator("[data-effort-source]")).toHaveText("当前会话自定义");
  187 |   await page.getByRole("button", { name: "恢复跟随配置" }).click();
  188 |   await expect(page.locator("[data-effort-current]")).toHaveText("高");
  189 |   await expect(page.locator("[data-effort-source]")).toHaveText("正在跟随配置");
  190 | });
  191 | 
  192 | test("低于阈值保留全部历史，不因轮数触发压缩", async ({ page }) => {
  193 |   let compressed = 0; let body;
  194 |   const messages = Array.from({ length: 10 }, (_, i) => [
  195 |     { id: `u${i}`, role: "user", content: `问题${i}` },
  196 |     { id: `a${i}`, role: "assistant", content: `回复${i}` }
  197 |   ]).flat();
  198 |   await load(page, { hash: "#/chat", config: { autoCompress: true }, conversation: { messages } });
  199 |   await page.route("**/api/chat/compress", (r) => { compressed++; return r.abort(); });
  200 |   await page.route("**/api/chat", (r) => { body = r.request().postDataJSON(); return r.fulfill({ json: { choices: [{ message: { role: "assistant", content: "完成" } }] } }); });
  201 |   await page.locator("#composerInput").fill("继续");
  202 |   await page.locator("#sendBtn").click();
  203 |   await expect.poll(() => body?.messages?.length).toBe(21);
  204 |   expect(compressed).toBe(0);
  205 | });
  206 | 
```