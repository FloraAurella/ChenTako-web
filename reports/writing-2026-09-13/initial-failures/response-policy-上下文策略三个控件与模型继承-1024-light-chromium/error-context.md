# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: response-policy.spec.js >> 上下文策略三个控件与模型继承 1024 light
- Location: e2e/response-policy.spec.js:102:80

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: null
Received: {"model": "helper", "providerId": "p"}

Call Log:
- Timeout 5000ms exceeded while waiting on the predicate
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
        - generic [ref=e83]: 已自动保存
        - region "配置作用范围" [ref=e85]:
          - generic [ref=e86]:
            - generic [ref=e87]: 当前作用范围
            - generic [ref=e88]: 选择配置范围
            - combobox "选择配置范围" [ref=e89]:
              - option "聊天默认配置" [selected]
              - option "项目"
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
                - spinbutton "压缩触发阈值（%）" [ref=e116]: "10"
                - paragraph [ref=e117]: 响应正常结束时达到此比例，自动压缩已完成历史。
              - generic [ref=e118]:
                - generic [ref=e119]: 压缩模型
                - combobox "压缩模型" [ref=e121]:
                  - option "与当前对话模型相同"
                  - option "对话供应商 / chat"
                  - option "对话供应商 / helper" [selected]
                - paragraph [ref=e122]: 用于自动与手动压缩，项目资料不会进入摘要请求。
              - generic [ref=e123]:
                - generic [ref=e124]: 标题模型
                - combobox "标题模型" [ref=e126]:
                  - option "与当前对话模型相同"
                  - option "对话供应商 / chat"
                  - option "对话供应商 / helper" [selected]
                - paragraph [ref=e127]: 首次发送时根据输入生成标题，每个对话仅尝试一次。
            - paragraph [ref=e128]: chat 的可用输入预算：8,500 Tokens（估算）。 预算自动扣除最大输出与 5% 安全余量，用量为估算。
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
                - switch "流式输出" [ref=e159] [cursor=pointer]
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
              - option "对话供应商 / chat" [selected]
              - option "对话供应商 / helper"
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
  8   |     localStorage.setItem('tribblebook-v6-state', JSON.stringify({ settingsSchemaVersion: 2, providers: [provider], projects: [{ id: 'project', name: '项目' }], activeProviderId: 'p', activeConversationId: 'c',
  9   |       chatConfig: { streaming, systemPrompt: '', compressionThreshold: 10, compressionModel: { providerId: 'p', model: 'helper' }, titleModel: { providerId: 'p', model: 'helper' }, ...config },
  10  |       conversations: [{ id: 'c', title: '', providerId: 'p', model: 'chat', projectId: 'project', messages }, { id: 'other', title: '其他对话', providerId: 'p', model: 'chat', messages: [{ id: 'old', role: 'user', content: '旧消息' }] }] }));
  11  |     localStorage.setItem('tribblebook-ui-preferences-v1', JSON.stringify({ themeId: 'default', appearanceMode: scheme }));
  12  |   }, { provider, streaming, messages, config, scheme });
  13  |   await page.route('**/api/health', r => r.fulfill({ json: { ok: true } }));
  14  |   await page.route('**/api/providers', r => r.fulfill({ json: { providers: [] } }));
  15  |   await page.route('**/api/chat/title', r => r.fulfill({ json: { ok: true, title: '首次要求标题' } }));
  16  |   await page.goto(`/${hash}`);
  17  |   await expect(page.locator('#appShell')).toBeVisible();
  18  | }
  19  | const send = async (page, text = '第一次要求') => { await page.locator('#composerInput').fill(text); await page.locator('#sendBtn').click(); };
  20  | const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('tribblebook-v6-state')));
  21  | const reply = content => ({ choices: [{ message: { role: 'assistant', content } }] });
  22  | 
  23  | for (const streaming of [false, true]) test(`响应结束自动压缩，首次标题并行且模型独立 ${streaming ? '流式' : '非流式'}`, async ({ page }) => {
  24  |   await load(page, { streaming });
  25  |   let release; const gate = new Promise(r => { release = r; }); let chat; let compact; let title; let compactCalls = 0;
  26  |   await page.route('**/api/chat/title', r => { title = r.request().postDataJSON(); return r.fulfill({ json: { ok: true, title: '首次要求标题' } }); });
  27  |   await page.route('**/api/chat', async r => { chat = r.request().postDataJSON(); await gate;
  28  |     if (streaming) await r.fulfill({ contentType: 'text/event-stream', body: [
  29  |       ['chat.stream.started', { version: 1, providerId: 'p', reasoningKind: 'thinking' }],
  30  |       ['chat.content.delta', { delta: '完整回答'.repeat(600) }],
  31  |       ['chat.stream.completed', { finishReason: 'stop' }]
  32  |     ].map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join('') });
  33  |     else await r.fulfill({ json: reply('完整回答'.repeat(600)) });
  34  |   });
  35  |   await page.route('**/api/chat/compress', r => { compactCalls++; compact = r.request().postDataJSON(); return r.fulfill({ json: { summary: '压缩后的摘要' } }); });
  36  |   await send(page);
  37  |   await expect.poll(() => !!chat && !!title).toBe(true);
  38  |   expect(compactCalls).toBe(0);
  39  |   expect(title).toMatchObject({ model: 'helper', input: '第一次要求' });
  40  |   expect(title).not.toHaveProperty('messages');
  41  |   expect(chat.model).toBe('chat');
  42  |   await expect(page.locator('#runtimeBtn')).toBeDisabled();
  43  |   await page.locator('#composerInput').fill('下一条草稿');
  44  |   release();
  45  |   await expect.poll(() => compactCalls).toBe(1);
  46  |   expect(compact.model).toBe('helper'); expect(compact.messages).toHaveLength(2);
  47  |   expect(compact.messages[1].content).toBe('完整回答'.repeat(600));
  48  |   expect(JSON.stringify(compact)).not.toContain('下一条草稿');
  49  |   await expect(page.locator('#composerInput')).toHaveValue('下一条草稿');
  50  |   await expect(page.locator('#runtimeBtn')).toBeEnabled();
  51  |   await expect.poll(async () => (await saved(page)).conversations.find(c => c.id === 'c').contextCompression?.summary).toBe('压缩后的摘要');
  52  | });
  53  | 
  54  | test('首次锁定菜单和模型指令，停止后解锁且不自动压缩', async ({ page }) => {
  55  |   await load(page); let calls = 0; let requested = false;
  56  |   await page.route('**/api/chat', async r => { requested = true; await new Promise(resolve => page.once('close', resolve)); await r.abort().catch(() => {}); });
  57  |   await page.route('**/api/chat/compress', r => { calls++; return r.fulfill({ json: { summary: '不应触发' } }); });
  58  |   await send(page); await expect.poll(() => requested).toBe(true);
  59  |   await page.locator('.conversation-item[data-conversation-id="c"]').hover();
  60  |   await page.locator('[data-conversation-id="c"] [data-conv-action="menu"]').click();
  61  |   for (const action of ['rename', 'delete', 'pin', 'move']) await expect(page.locator(`[data-menu-action="${action}"]`)).toBeDisabled();
  62  |   await expect(page.locator('[data-menu-action="export"]')).toBeEnabled();
  63  |   await page.keyboard.press('Escape');
  64  |   await page.locator('#composerInput').fill('/model helper'); await page.locator('#composerInput').press('Enter');
  65  |   await expect(page.locator('.command-feedback')).toContainText('首次响应');
  66  |   await page.locator('#sendBtn').click();
  67  |   await expect(page.locator('#runtimeBtn')).toBeEnabled(); expect(calls).toBe(0);
  68  |   await page.locator('.conversation-item[data-conversation-id="c"]').hover();
  69  |   await page.locator('[data-conversation-id="c"] [data-conv-action="menu"]').click();
  70  |   await expect(page.locator('[data-menu-action="rename"]')).toBeEnabled();
  71  | });
  72  | 
  73  | test('首次报错解锁，低于阈值不压缩，重试/刷新/副本不再生成标题', async ({ page }) => {
  74  |   await load(page); let titles = 0; let chats = 0; let compacts = 0;
  75  |   await page.route('**/api/chat/title', r => { titles++; return r.fulfill({ status: 500, json: { error: '标题失败' } }); });
  76  |   await page.route('**/api/chat', r => { chats++; return chats === 1 ? r.fulfill({ status: 500, json: { error: '回答失败' } }) : r.fulfill({ json: reply('短回答') }); });
  77  |   await page.route('**/api/chat/compress', r => { compacts++; return r.fulfill({ json: { summary: '摘要' } }); });
  78  |   await send(page); await expect(page.locator('#messageList')).toContainText('回答失败');
  79  |   await expect(page.locator('#runtimeBtn')).toBeEnabled();
  80  |   await send(page, '第二次输入'); await expect(page.locator('#messageList')).toContainText('短回答');
  81  |   expect(titles).toBe(1); expect(compacts).toBe(0);
  82  |   await page.reload(); await expect(page.locator('#composerInput')).toBeEnabled();
  83  |   await send(page, '刷新后'); await expect.poll(() => chats).toBe(3); expect(titles).toBe(1);
  84  |   await expect(page.locator('[data-message-action="branch"]').last()).toBeEnabled();
  85  |   await page.locator('[data-message-action="branch"]').last().click();
  86  |   await send(page, '副本消息'); await expect.poll(() => chats).toBe(4); expect(titles).toBe(1);
  87  | });
  88  | 
  89  | test('自动压缩失败保留回答和下一条草稿，不循环重试', async ({ page }) => {
  90  |   await load(page); let release; const gate = new Promise(r => { release = r; }); let attempts = 0;
  91  |   await page.route('**/api/chat', r => r.fulfill({ json: reply('回答'.repeat(1000)) }));
  92  |   await page.route('**/api/chat/compress', async r => { attempts++; await gate; await r.fulfill({ status: 500, json: { error: '压缩模型失败' } }); });
  93  |   await send(page); await expect.poll(() => attempts).toBe(1);
  94  |   await page.locator('#composerInput').fill('继续编辑的草稿');
  95  |   await expect(page.locator('#sendBtn')).toBeDisabled(); release();
  96  |   await expect(page.locator('#page-chat')).toContainText('压缩模型失败');
  97  |   await expect(page.locator('#composerInput')).toHaveValue('继续编辑的草稿');
  98  |   await expect(page.locator('#messageList')).toContainText('回答'.repeat(20));
  99  |   expect(attempts).toBe(1);
  100 | });
  101 | 
  102 | for (const scheme of ['light', 'dark']) for (const width of [1280, 1024, 390]) test(`上下文策略三个控件与模型继承 ${width} ${scheme}`, async ({ page }, testInfo) => {
  103 |   await load(page, { scheme, width, hash: '#/settings/context' });
  104 |   await expect(page.locator('#cc-inputBudget')).toHaveCount(0); await expect(page.locator('#cc-autoCompress')).toHaveCount(0);
  105 |   await expect(page.locator('#cc-compressionThreshold')).toHaveValue('10');
  106 |   await page.locator('#cc-titleModel').selectOption(''); await page.locator('#cc-compressionModel').selectOption(JSON.stringify(['p', 'chat']));
  107 |   await expect(page.locator('.context-auto-state')).toContainText('已自动保存');
> 108 |   await expect.poll(async () => (await saved(page)).chatConfig.titleModel).toBe(null);
      |                                                                            ^ Error: expect(received).toBe(expected) // Object.is equality
  109 |   await page.locator('#context-scope').selectOption('project');
  110 |   await expect(page.locator('#cc-titleModel')).toBeDisabled();
  111 |   await page.locator('#cc-titleModel').locator('..').getByRole('button').click();
  112 |   await page.locator('#cc-titleModel').selectOption(JSON.stringify(['p', 'helper']));
  113 |   await page.locator('#cc-titleModel').blur();
  114 |   await expect.poll(async () => (await saved(page)).projects[0].configOverrides.titleModel).toEqual({ providerId: 'p', model: 'helper' });
  115 |   await page.locator('#context-budget').scrollIntoViewIfNeeded();
  116 |   expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  117 |   await page.locator('#context-budget').screenshot({ path: testInfo.outputPath(`policy-${width}-${scheme}.png`) });
  118 | });
  119 | 
  120 | test('持续滚动不延迟结束压缩，切换会话后摘要写回原对话', async ({ page }) => {
  121 |   await load(page, { streaming: true });
  122 |   await page.evaluate(() => {
  123 |     const original = window.fetch;
  124 |     window.fetch = async (url, options) => {
  125 |       if (String(url) !== '/api/chat') return original(url, options);
  126 |       const encoder = new TextEncoder();
  127 |       return new Response(new ReadableStream({ start(controller) {
  128 |         const frame = (event, data) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
  129 |         frame('chat.stream.started', { version: 1, providerId: 'p', reasoningKind: 'thinking' });
  130 |         frame('chat.content.delta', { delta: '回答内容'.repeat(600) });
  131 |         window.finishPolicyStream = () => { frame('chat.stream.completed', { finishReason: 'stop' }); controller.close(); };
  132 |       } }), { headers: { 'Content-Type': 'text/event-stream' } });
  133 |     };
  134 |   });
  135 |   let compact; let release; const gate = new Promise(r => { release = r; });
  136 |   await page.route('**/api/chat/compress', async r => { compact = r.request().postDataJSON(); await gate; await r.fulfill({ json: { summary: '原对话摘要' } }); });
  137 |   await send(page); await expect(page.locator('#messageList')).toContainText('回答内容');
  138 |   await page.evaluate(() => {
  139 |     window.policyScrollTimer = setInterval(() => document.getElementById('messageScroll').dispatchEvent(new WheelEvent('wheel', { deltaY: -10 })), 30);
  140 |     document.getElementById('messageScroll').dispatchEvent(new WheelEvent('wheel', { deltaY: -10 }));
  141 |     window.finishPolicyStream();
  142 |   });
  143 |   try { await expect.poll(() => !!compact).toBe(true); }
  144 |   finally { await page.evaluate(() => clearInterval(window.policyScrollTimer)); }
  145 |   await page.locator('.conversation-item[data-conversation-id="other"]').click();
  146 |   await page.locator('#composerInput').fill('其他对话草稿'); release();
  147 |   await expect.poll(async () => (await saved(page)).conversations.find(c => c.id === 'c').contextCompression?.summary).toBe('原对话摘要');
  148 |   await expect(page.locator('#composerInput')).toHaveValue('其他对话草稿');
  149 |   expect((await saved(page)).conversations.find(c => c.id === 'other').contextCompression).toBeFalsy();
  150 | });
  151 | 
  152 | test('标题晚于首次回答，手动改名优先且不阻塞下一次发送', async ({ page }) => {
  153 |   await load(page); let release; const gate = new Promise(r => { release = r; }); let titles = 0; let chats = 0;
  154 |   await page.route('**/api/chat/title', async r => { titles++; await gate; await r.fulfill({ json: { title: '晚到的自动标题' } }); });
  155 |   await page.route('**/api/chat', r => { chats++; return r.fulfill({ json: reply('完成') }); });
  156 |   await send(page); await expect(page.locator('#runtimeBtn')).toBeEnabled();
  157 |   await expect.poll(() => titles).toBe(1);
  158 |   await page.locator('.conversation-item[data-conversation-id="c"]').hover();
  159 |   await page.locator('[data-conversation-id="c"] [data-conv-action="menu"]').click();
  160 |   await page.locator('[data-menu-action="rename"]').click();
  161 |   await page.getByRole('dialog').getByRole('textbox').fill('我的手动标题');
  162 |   await page.getByRole('dialog').getByRole('button', { name: '保存', exact: true }).click();
  163 |   await send(page, '第二次要求'); await expect.poll(() => chats).toBe(2);
  164 |   release();
  165 |   await expect.poll(async () => (await saved(page)).conversations.find(c => c.id === 'c').title).toBe('我的手动标题');
  166 |   expect(titles).toBe(1);
  167 | });
  168 | 
  169 | test('专用压缩模型失效不回退，不阻止原模型正常回答', async ({ page }) => {
  170 |   await load(page, { config: { compressionModel: { providerId: 'deleted', model: 'gone' } } });
  171 |   let attempts = 0;
  172 |   await page.route('**/api/chat', r => r.fulfill({ json: reply('回答'.repeat(1000)) }));
  173 |   await page.route('**/api/chat/compress', r => { attempts++; return r.fulfill({ json: { summary: '不应回退' } }); });
  174 |   await send(page);
  175 |   await expect(page.locator('#page-chat')).toContainText('专用模型已不可用');
  176 |   await expect(page.locator('#messageList')).toContainText('回答'.repeat(20));
  177 |   expect(attempts).toBe(0);
  178 | });
  179 | 
```