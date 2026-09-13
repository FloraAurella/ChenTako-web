# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: settings-context.spec.js >> 上下文设置视觉 1024 dark
- Location: e2e/settings-context.spec.js:147:3

# Error details

```
Error: expect(page).toHaveScreenshot(expected) failed

  11364 pixels (ratio 0.02 of all image pixels) are different.

  Snapshot: context-1024-dark.png

Call log:
  - Expect "toHaveScreenshot(context-1024-dark.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - 11364 pixels (ratio 0.02 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - captured a stable screenshot
  - 11364 pixels (ratio 0.02 of all image pixels) are different.

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
        - heading "上下文与提示词" [level=2] [ref=e82]
        - paragraph [ref=e83]: 统一设置聊天行为，让每个项目保留需要的差异。
        - region "配置作用范围" [ref=e84]:
          - generic [ref=e85]:
            - generic [ref=e86]: 当前作用范围
            - generic [ref=e87]: 选择配置范围
            - combobox "选择配置范围" [ref=e88]:
              - option "聊天默认配置"
              - option "写作项目" [selected]
          - generic [ref=e89]:
            - strong [ref=e90]: 1 项自定义
            - generic [ref=e91]: 其余项目设置持续继承聊天默认值
          - button "全部恢复继承" [ref=e92] [cursor=pointer]
        - region [ref=e93]:
          - generic [ref=e94]:
            - heading "常用配置" [level=3] [ref=e95]
            - paragraph [ref=e96]: 先确定助手指令与上下文策略。项目未覆盖的字段持续跟随聊天默认配置。
          - region [ref=e97]:
            - generic [ref=e98]:
              - heading "系统提示词" [level=3] [ref=e99]
              - paragraph [ref=e100]: 项目提示词整体覆盖聊天提示词；自定义为空表示不使用提示词。
            - generic [ref=e101]:
              - generic [ref=e102]:
                - generic [ref=e103]: 提示词内容
                - button "自定义 · 恢复继承" [ref=e104] [cursor=pointer]
              - textbox "提示词内容" [ref=e105]:
                - /placeholder: 描述助手的角色、回答方式和需要遵守的要求…
                - text: 专注于项目写作，先说明结论，再给出必要依据。
              - paragraph [ref=e106]: 技能和必要的工具运行指令由应用单独添加。
              - generic [ref=e107]:
                - generic [ref=e108]: 22 / 102,400 字符
                - button "展开编辑器" [ref=e109] [cursor=pointer]
                - button "清空提示词" [ref=e110] [cursor=pointer]
          - region [ref=e111]:
            - generic [ref=e112]:
              - heading "上下文策略" [level=3] [ref=e113]
              - paragraph [ref=e114]: 控制发送多少上下文，保留模型窗口与输出额度的安全余量。
            - generic [ref=e115]:
              - generic [ref=e116]:
                - generic [ref=e117]:
                  - generic [ref=e118]: 输入预算（Tokens）
                  - button "继承聊天 · 自定义" [ref=e119] [cursor=pointer]
                - spinbutton "输入预算（Tokens）" [disabled] [ref=e120]
                - paragraph [ref=e121]: 留空自动计算：模型窗口 − 最大输出 − 5% 窗口安全余量。
              - generic [ref=e122]:
                - generic [ref=e123]:
                  - generic [ref=e124]: 自动压缩历史
                  - button "继承聊天 · 自定义" [ref=e125] [cursor=pointer]
                - switch "自动压缩历史" [disabled] [ref=e126]
                - paragraph [ref=e127]: 达到阈值时压缩已完成的历史，不按固定轮数保留；会产生额外模型请求，聊天记录不会删除。
              - generic [ref=e128]:
                - generic [ref=e129]:
                  - generic [ref=e130]: 压缩触发阈值（%）
                  - button "继承聊天 · 自定义" [ref=e131] [cursor=pointer]
                - spinbutton "压缩触发阈值（%）" [disabled] [ref=e132]: "80"
                - paragraph [ref=e133]: 占用达到输入预算的此比例时，在发送前压缩一次。
            - paragraph [ref=e134]: model-a 的可用输入预算：116,326 Tokens（估算）。 实际发送使用当前会话模型；附件与工具内容采用保守估算。
        - region [ref=e135]:
          - generic [ref=e136]:
            - heading "高级配置" [level=3] [ref=e137]
            - paragraph [ref=e138]: 按模型需要调整生成、输出和兼容性参数；无需修改时可保留默认值。
          - region [ref=e139]:
            - generic [ref=e140]:
              - heading "生成参数" [level=3] [ref=e141]
              - paragraph [ref=e142]: 实际适用参数由模型与 API 协议决定。
            - generic [ref=e143]:
              - generic [ref=e144]:
                - generic [ref=e145]:
                  - generic [ref=e146]: 默认思考强度
                  - button "继承聊天 · 自定义" [ref=e147] [cursor=pointer]
                - combobox "默认思考强度" [disabled] [ref=e148]:
                  - option "轻量"
                  - option "中等" [selected]
                  - option "高"
                  - option "极高"
                  - option "最大"
                - paragraph [ref=e149]: 聊天工具栏可临时覆盖，也可恢复跟随配置。
              - generic [ref=e150]:
                - generic [ref=e151]:
                  - generic [ref=e152]: Temperature
                  - button "继承聊天 · 自定义" [ref=e153] [cursor=pointer]
                - spinbutton "Temperature" [disabled] [ref=e154]: "0.7"
                - paragraph [ref=e155]: 控制采样随机性；部分推理模型不接受此参数。
              - generic [ref=e156]:
                - generic [ref=e157]:
                  - generic [ref=e158]: Top P
                  - button "继承聊天 · 自定义" [ref=e159] [cursor=pointer]
                - spinbutton "Top P" [disabled] [ref=e160]: "1"
                - paragraph [ref=e161]: 控制采样候选范围；Gemini 思考模式不发送采样参数。
          - region [ref=e162]:
            - heading "输出与会话" [level=3] [ref=e164]
            - generic [ref=e165]:
              - generic [ref=e166]:
                - generic [ref=e167]:
                  - generic [ref=e168]: 流式输出
                  - button "继承聊天 · 自定义" [ref=e169] [cursor=pointer]
                - switch "流式输出" [disabled] [ref=e170]
                - paragraph [ref=e171]: 边生成边显示；关闭后等待完整响应。
              - generic [ref=e172]:
                - generic [ref=e173]:
                  - generic [ref=e174]: 本地保存对话
                  - button "继承聊天 · 自定义" [ref=e175] [cursor=pointer]
                - switch "本地保存对话" [checked] [disabled] [ref=e176]
                - paragraph [ref=e177]: 用于新建会话；已有会话保留原保存状态。
              - generic [ref=e178]:
                - generic [ref=e179]:
                  - generic [ref=e180]: User ID
                  - button "继承聊天 · 自定义" [ref=e181] [cursor=pointer]
                - textbox "User ID" [disabled] [ref=e182]:
                  - /placeholder: 可选
                - paragraph [ref=e183]: 可选；Gemini 不发送此字段，其他协议按各自格式传递。
          - region [ref=e184]:
            - generic [ref=e185]:
              - heading "模型兼容性" [level=3] [ref=e186]
              - paragraph [ref=e187]: 全局配置，不参与项目继承。用于纠正模型图片能力的自动识别。
            - generic [ref=e188]: 选择模型
            - combobox "选择模型" [ref=e189]:
              - option "示例供应商 / model-a" [selected]
              - option "示例供应商 / model-b"
            - generic [ref=e190]:
              - generic [ref=e191]:
                - generic [ref=e192]: 图片输入能力
                - combobox "图片输入能力" [ref=e193]:
                  - option "自动识别" [selected]
                  - option "支持"
                  - option "关闭"
              - generic [ref=e194]:
                - generic [ref=e195]: 图片输出能力
                - combobox "图片输出能力" [ref=e196]:
                  - option "自动识别" [selected]
                  - option "支持"
                  - option "关闭"
        - generic [ref=e197]:
          - generic [ref=e198]: 配置已保存
          - generic [ref=e199]:
            - button "放弃更改" [disabled] [ref=e200]
            - button "保存更改" [disabled] [ref=e201]
```

# Test source

```ts
  52  |   await page.getByLabel("选择配置范围").selectOption("p");
  53  |   await page.locator('.dialog-card [data-role="confirm"]').click();
  54  |   await expect(page.locator("#context-scope")).toHaveValue("p");
  55  |   await expect(page.locator("#cc-systemPrompt")).toHaveValue("聊天默认提示词");
  56  | });
  57  | 
  58  | test("新请求使用项目配置而非供应商提示词", async ({ page }) => {
  59  |   let body;
  60  |   await load(page, { hash: "#/chat", project: { systemPrompt: "项目专属", temperature: 0.2 }, conversation: { projectId: "p" } });
  61  |   await page.route("**/api/chat", async (r) => { body = r.request().postDataJSON(); await r.fulfill({ json: { choices: [{ message: { role: "assistant", content: "已完成" } }] } }); });
  62  |   await page.locator("#composerInput").fill("你好");
  63  |   await page.locator("#sendBtn").click();
  64  |   await expect.poll(() => body?.chatConfig?.systemPrompt).toBe("项目专属");
  65  |   expect(body.chatConfig.temperature).toBe(0.2);
  66  |   expect(body.chatConfig.version).toBe(1);
  67  |   expect(body.stream).toBe(false);
  68  |   expect(JSON.stringify(body)).not.toContain("obsolete-provider-prompt");
  69  |   await expect(page.locator("#messageList")).toContainText("已完成");
  70  | });
  71  | 
  72  | test("达到预算阈值压缩全部已完成历史，保留待发送消息", async ({ page }) => {
  73  |   let sent = 0; let compressed;
  74  |   const messages = Array.from({ length: 4 }, (_, i) => [{ id: `u${i}`, role: "user", content: "历史内容".repeat(100) }, { id: `a${i}`, role: "assistant", content: "历史回复".repeat(100) }]).flat();
  75  |   await load(page, { hash: "#/chat", config: { inputBudget: 1500, autoCompress: true }, conversation: { messages } });
  76  |   await page.route("**/api/chat/compress", async (r) => { compressed = r.request().postDataJSON(); await r.fulfill({ json: { summary: "此前讨论了项目计划。" } }); });
  77  |   await page.route("**/api/chat", async (r) => { sent++; await r.fulfill({ json: { choices: [{ message: { role: "assistant", content: "继续" } }] } }); });
  78  |   await page.locator("#composerInput").fill("接着讲");
  79  |   await page.locator("#sendBtn").click();
  80  |   await expect.poll(() => sent).toBe(1);
  81  |   expect(compressed.messages).toHaveLength(8);
  82  |   expect(compressed.messages.every((m) => m.content !== "接着讲")).toBe(true);
  83  |   await expect(page.locator("#messageList")).toContainText("继续");
  84  | });
  85  | 
  86  | test("压缩失败保留草稿，不发送、不无限重试", async ({ page }) => {
  87  |   let attempts = 0; let sent = 0;
  88  |   const messages = Array.from({ length: 4 }, (_, i) => [{ id: `u${i}`, role: "user", content: "历史".repeat(500) }, { id: `a${i}`, role: "assistant", content: "回复".repeat(500) }]).flat();
  89  |   await load(page, { hash: "#/chat", config: { inputBudget: 1000, autoCompress: true }, conversation: { messages } });
  90  |   await page.route("**/api/chat/compress", (r) => { attempts++; return r.fulfill({ status: 500, json: { error: "测试压缩失败" } }); });
  91  |   await page.route("**/api/chat", (r) => { sent++; return r.abort(); });
  92  |   await page.locator("#composerInput").fill("保留这条输入");
  93  |   await page.locator("#sendBtn").click();
  94  |   await expect(page.locator("#page-chat")).toContainText("测试压缩失败");
  95  |   await expect(page.locator("#composerInput")).toHaveValue("保留这条输入");
  96  |   expect(attempts).toBe(1); expect(sent).toBe(0);
  97  | });
  98  | 
  99  | test("升级默认重置与无密钥备份；模型编辑仅有额度", async ({ page }) => {
  100 |   await load(page, { legacy: true });
  101 |   await expect(page.locator("#cc-systemPrompt")).toHaveValue("");
  102 |   await page.locator('[data-section="data"]').click();
  103 |   await page.locator(".settings-legacy-details > summary").click();
  104 |   await expect(page.locator(".settings-backup")).toContainText("obsolete-provider-prompt");
  105 |   await expect(page.locator(".settings-backup")).not.toContainText('"apiKey"');
  106 |   await page.locator('[data-section="providers"]').click();
  107 |   await page.locator('[data-edit-provider="settings-provider"]').click();
  108 |   await page.locator('[data-model-row="model-a"] .provider-model-main').click();
  109 |   await expect(page.locator("#model-contextWindow")).toBeVisible();
  110 |   await expect(page.locator("#model-maxTokens")).toBeVisible();
  111 |   await expect(page.locator(".provider-model-advanced-toggle")).toHaveCount(0);
  112 |   await expect(page.locator("#pf-system")).toHaveCount(0);
  113 | });
  114 | 
  115 | test("设置搜索定位与所有分类无横向溢出", async ({ page }) => {
  116 |   await load(page);
  117 |   await page.getByLabel("搜索设置").fill("图片输入");
  118 |   await page.getByRole("button", { name: "模型兼容性 上下文与提示词" }).click();
  119 |   await expect(page.locator("#context-compatibility")).toBeFocused();
  120 |   await page.getByLabel("搜索设置").fill("");
  121 |   for (const key of ["appearance", "providers", "context", "tools", "skills", "data", "about"]) {
  122 |     await page.locator(`[data-section="${key}"]`).click();
  123 |     await expect(page.locator("#settingsContent .settings-pane").first()).toBeVisible();
  124 |     expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  125 |   }
  126 | });
  127 | 
  128 | for (const width of [1024, 390]) {
  129 |   test(`设置分类 ${width} 宽度下分组、能力说明与页面宽度完整`, async ({ page }) => {
  130 |     await page.setViewportSize({ width, height: 900 });
  131 |     await load(page, { hash: "#/settings/appearance" });
  132 |     for (const key of ["appearance", "providers", "context", "tools", "skills", "data", "about"]) {
  133 |       await page.goto(`/#/settings/${key}`);
  134 |       await expect(page.locator("#settingsContent .settings-pane").first()).toBeVisible();
  135 |       expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  136 |       if (key === "appearance" || key === "data") {
  137 |         await expect(page.getByRole("region", { name: "常用配置", exact: true })).toBeVisible();
  138 |         await expect(page.getByRole("region", { name: "高级配置", exact: true })).toBeVisible();
  139 |       }
  140 |       if (key === "tools" || key === "skills") {
  141 |         await expect(page.locator("[data-extension-capability]")).toContainText("执行尚未开放");
  142 |       }
  143 |     }
  144 |   });
  145 | }
  146 | for (const [width, scheme] of [[1280, "light"], [1024, "dark"], [390, "light"]]) {
  147 |   test(`上下文设置视觉 ${width} ${scheme}`, async ({ page }) => {
  148 |     await page.setViewportSize({ width, height: 900 });
  149 |     await load(page, { scheme, hash: "#/settings/context/p", project: { systemPrompt: "专注于项目写作，先说明结论，再给出必要依据。" } });
  150 |     await expect(page.locator("#cc-systemPrompt")).toBeVisible();
  151 |     await page.evaluate(() => document.fonts.ready);
> 152 |     await expect(page).toHaveScreenshot(`context-${width}-${scheme}.png`, { animations: "disabled", caret: "hide" });
      |                        ^ Error: expect(page).toHaveScreenshot(expected) failed
  153 |     expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  154 |     await page.locator("#context-budget").scrollIntoViewIfNeeded();
  155 |     await expect(page.locator("#context-budget")).toHaveScreenshot(`context-budget-${width}-${scheme}.png`, { animations: "disabled", caret: "hide" });
  156 |   });
  157 | }
  158 | 
  159 | test("离开聊天后重新打开上下文页面，项目菜单与能力覆盖可用", async ({ page }) => {
  160 |   await load(page);
  161 |   await page.locator("#cc-visionInput").selectOption("false");
  162 |   await save(page);
  163 |   await page.evaluate(() => { location.hash = "#/chat"; });
  164 |   await expect(page.locator("#composerInput")).toBeVisible();
  165 |   await page.locator('[data-project-id="p"] .project-row').hover();
  166 |   await page.locator('[data-project-id="p"] [data-project-action="menu"]').click();
  167 |   await page.getByRole("menuitem", { name: "上下文与提示词" }).click();
  168 |   await expect(page.locator("#context-scope")).toHaveValue("p");
  169 |   await expect(page.locator("#cc-visionInput")).toHaveValue("false");
  170 |   await page.evaluate(() => { location.hash = "#/chat"; });
  171 |   await page.evaluate(() => { location.hash = "#/settings/context/p"; });
  172 |   await expect(page.locator("#cc-systemPrompt")).toBeVisible();
  173 | });
  174 | 
  175 | test("自动压缩关闭时超预算保留输入，工具栏思考强度可恢复继承", async ({ page }) => {
  176 |   let sent = 0;
  177 |   await load(page, { hash: "#/chat", config: { inputBudget: 50, defaultReasoningEffort: "high" } });
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