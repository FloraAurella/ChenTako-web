# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: settings-context.spec.js >> 上下文设置视觉 390 light
- Location: e2e/settings-context.spec.js:144:3

# Error details

```
Error: expect(page).toHaveScreenshot(expected) failed

  16 pixels (ratio 0.01 of all image pixels) are different.

  Snapshot: context-390-light.png

Call log:
  - Expect "toHaveScreenshot(context-390-light.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - 16 pixels (ratio 0.01 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - captured a stable screenshot
  - 16 pixels (ratio 0.01 of all image pixels) are different.

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
                      - generic [ref=e120]: 压缩触发阈值（%）
                      - button "继承聊天 · 自定义" [ref=e121] [cursor=pointer]
                    - spinbutton "压缩触发阈值（%）" [disabled] [ref=e122]: "80"
                    - paragraph [ref=e123]: 响应正常结束时达到此比例，自动压缩已完成历史。
                  - generic [ref=e124]:
                    - generic [ref=e125]:
                      - generic [ref=e126]: 压缩模型
                      - button "继承聊天 · 自定义" [ref=e127] [cursor=pointer]
                    - combobox "压缩模型" [disabled] [ref=e128]:
                      - option "与当前对话模型相同" [selected]
                      - option "示例供应商 / model-a"
                      - option "示例供应商 / model-b"
                    - paragraph [ref=e129]: 用于自动与手动压缩，项目资料不会进入摘要请求。
                  - generic [ref=e130]:
                    - generic [ref=e131]:
                      - generic [ref=e132]: 标题模型
                      - button "继承聊天 · 自定义" [ref=e133] [cursor=pointer]
                    - combobox "标题模型" [disabled] [ref=e134]:
                      - option "与当前对话模型相同" [selected]
                      - option "示例供应商 / model-a"
                      - option "示例供应商 / model-b"
                    - paragraph [ref=e135]: 首次发送时根据输入生成标题，每个对话仅尝试一次。
                - paragraph [ref=e136]: model-a 的可用输入预算：116,326 Tokens（估算）。 预算自动扣除最大输出与 5% 安全余量，用量为估算。
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
> 149 |     await expect(page).toHaveScreenshot(`context-${width}-${scheme}.png`, { animations: "disabled", caret: "hide" });
      |                        ^ Error: expect(page).toHaveScreenshot(expected) failed
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