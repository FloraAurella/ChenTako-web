# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: modular-refactor.spec.js >> 共享历史表面与项目状态操作：创建、重命名、删除保留聊天
- Location: e2e/modular-refactor.spec.js:23:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('menuitem', { name: '重命名项目' })

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e4]:
    - complementary "对话" [ref=e5]:
      - generic [ref=e6]:
        - heading "ChenTako" [level=2] [ref=e13]
        - button "收起侧栏" [expanded] [ref=e15] [cursor=pointer]
      - button "新建对话" [ref=e19] [cursor=pointer]
      - generic [ref=e23]:
        - generic [ref=e24]: 查找聊天
        - button "搜索对话" [ref=e25] [cursor=pointer]
        - button "导入对话" [ref=e29] [cursor=pointer]
      - searchbox "搜索对话 ⌘K" [ref=e33]
      - generic [ref=e34]:
        - region "项目" [ref=e35]:
          - generic [ref=e36]:
            - button "项目" [expanded] [ref=e37] [cursor=pointer]
            - button "新建项目" [ref=e41] [cursor=pointer]
          - generic [ref=e46]:
            - generic [ref=e47]:
              - button "模块边界验证" [expanded] [ref=e48] [cursor=pointer]
              - button "模块边界验证：项目设置" [expanded] [ref=e56] [cursor=pointer]
              - button "模块边界验证：新建聊天"
            - generic [ref=e62]: 暂无聊天
        - region "聊天" [ref=e64]:
          - button "聊天" [expanded] [ref=e66] [cursor=pointer]
          - generic [ref=e70]: 暂无无项目聊天
      - navigation "应用导航" [ref=e72]:
        - button "设置" [ref=e73] [cursor=pointer]
    - main [ref=e78]:
      - generic [ref=e79]:
        - generic [ref=e81]:
          - generic [ref=e82]: Chat · 对话
          - generic [ref=e83]: 新对话
        - generic "本地服务正常" [ref=e86]
      - region "对话" [ref=e90]:
        - generic [ref=e93]:
          - heading "欢迎回来，随时开始吧" [level=2] [ref=e100]
          - paragraph [ref=e101]: 添加供应商并选择模型后即可聊天。
          - link "配置模型" [ref=e102] [cursor=pointer]:
            - /url: "#/settings/providers"
        - generic [ref=e104]:
          - button "当前项目：模块边界验证" [ref=e106] [cursor=pointer]:
            - generic [ref=e110]: 模块边界验证
          - generic [ref=e114]:
            - textbox "输入消息，/ 打开指令" [ref=e116]
            - generic [ref=e117]:
              - button "添加附件" [ref=e118] [cursor=pointer]
              - generic [ref=e121]:
                - button "未选择 中等" [ref=e122] [cursor=pointer]:
                  - generic [ref=e123]: 未选择
                  - generic [ref=e124]: 中等
                - button "压缩上下文（已用约 0%）" [ref=e128] [cursor=pointer]
                - button "发送" [disabled] [ref=e133]
          - generic [ref=e136]: Enter 发送 · Shift + Enter 换行
  - dialog "项目设置" [ref=e138]:
    - generic [ref=e139]:
      - heading "项目设置" [level=2] [ref=e140]
      - button "关闭项目设置" [active] [ref=e141] [cursor=pointer]
    - generic [ref=e145]:
      - generic [ref=e146]:
        - generic [ref=e147]:
          - generic [ref=e148]: 项目名称
          - generic [ref=e149]:
            - textbox "项目名称" [ref=e150]: 模块边界验证
            - button "保存名称" [ref=e151] [cursor=pointer]
        - generic [ref=e152]:
          - status
          - button "删除项目" [ref=e153] [cursor=pointer]
      - region "项目知识库" [ref=e154]:
        - heading "项目知识库" [level=2] [ref=e155]
        - paragraph [ref=e156]: 每次全文携带，不参与压缩；修改对后续请求生效。
        - generic [ref=e157]:
          - button "上传资料" [ref=e158] [cursor=pointer]
          - button "导出资料备份" [disabled] [ref=e159]
          - button "恢复资料备份" [ref=e160] [cursor=pointer]
        - generic [ref=e161]: UTF-8 文本、Markdown、代码 · 单文件 1 MiB · 共 8 MiB / 64 份。不支持 PDF、Word、二进制。
        - strong [ref=e163]: 0 份资料 · 约 0 Tokens
        - generic "资料文件列表" [ref=e165]:
          - paragraph [ref=e166]: 尚未上传资料。
        - status [ref=e167]
```

# Test source

```ts
  1  | import {test,expect} from '@playwright/test';
  2  | 
  3  | async function load(page) {
  4  |  await page.route('**/api/**',route=>route.fulfill({json:route.request().url().includes('/health')?{ok:true}:{providers:[]}}));
  5  |  await page.goto('/');
  6  |  await expect(page.locator('#composerInput')).toBeEnabled();
  7  | }
  8  | 
  9  | test('注册的七个设置页面均可访问且共用字段模板',async({page})=>{
  10 |  await load(page);await page.locator('.sidebar-settings').click();
  11 |  for(const section of ['appearance','providers','context','tools','skills','data','about']){
  12 |   await page.locator(`.settings-nav-item[data-section="${section}"]`).click();
  13 |   await expect(page).toHaveURL(new RegExp(`/settings/${section}$`));
  14 |   await expect(page.locator('#settingsContent .settings-pane')).toBeVisible();
  15 |  }
  16 |  await page.locator('[data-section="context"]').click();
  17 |  await expect(page.locator('#cc-systemPrompt')).toHaveClass(/ui-input/);
  18 |  const panel=page.locator('[data-surface="panel"]').filter({has:page.locator('#cc-systemPrompt')});
  19 |  const paint=el=>{const s=getComputedStyle(el);return [s.backgroundColor,s.borderColor];};
  20 |  const before=await panel.evaluate(paint);await panel.hover();expect(await panel.evaluate(paint)).toEqual(before);
  21 | });
  22 | 
  23 | test('共享历史表面与项目状态操作：创建、重命名、删除保留聊天',async({page})=>{
  24 |  await load(page);await page.locator('[data-project-action="create"]').click();
  25 |  await page.locator('.dialog-input').fill('模块边界验证');await page.getByRole('button',{name:'保存',exact:true}).click();
  26 |  const row=page.locator('.sidebar-project').filter({has:page.locator('.project-name',{hasText:'模块边界验证'})});
  27 |  await expect(row).toBeVisible();await row.locator('.project-row').hover();await row.locator('[data-project-action="menu"]').click();
> 28 |  await page.getByRole('menuitem',{name:'重命名项目'}).click();await page.locator('.dialog-input').fill('模块边界验证新版');await page.getByRole('button',{name:'保存',exact:true}).click();
     |                                                  ^ Error: locator.click: Test timeout of 30000ms exceeded.
  29 |  const renamed=page.locator('.sidebar-project').filter({has:page.locator('.project-name',{hasText:'模块边界验证新版'})});
  30 |  await expect(renamed).toBeVisible();await page.locator('#composerInput').fill('保留草稿');
  31 |  const id=await page.locator('.conversation-item.is-selected').getAttribute('data-conversation-id');
  32 |  await renamed.locator('.project-row').hover();await renamed.locator('[data-project-action="menu"]').click();await page.getByRole('menuitem',{name:'删除项目'}).click();
  33 |  await page.locator('.dialog-card [data-role="confirm"]').click();await expect(renamed).toHaveCount(0);
  34 |  await expect(page.locator(`[data-conversation-id="${id}"]`)).toBeVisible();await expect(page.locator('#composerInput')).toHaveValue('保留草稿');
  35 |  await expect(page.locator(`[data-conversation-id="${id}"]`)).toHaveAttribute('data-surface','interactive');
  36 | });
  37 | 
```