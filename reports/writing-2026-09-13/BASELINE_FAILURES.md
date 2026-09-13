# 保留的基线失败

下列失败在未加入写作功能的临时基线中复现；本次未删除测试或更新其截图。完整错误见 baseline-e2e.json。

## app.spec.js >> JSON 主题文件：导出当前主题并重新导入应用

Test timeout of 30000ms exceeded.

## app.spec.js >> Tako Festival · 章鱼烧祭 窄屏安全回退：无横向溢出或素材遮挡

Error: expect(locator).toBeVisible() failed

Locator: locator('.empty-card')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

## app.spec.js >> 主题 JSON：更新默认主题、重启恢复并删除自定义变体

Error: expect(locator).toBeVisible() failed

Locator: locator('#themePackageImportBtn')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

## app.spec.js >> 主题界面字体：导入 typefaces 主题后字体令牌生效，删除后恢复默认

Test timeout of 30000ms exceeded.

## app.spec.js >> 压缩上下文：点击直接压缩，按会话锁定发送，进度提示可回看

Error: expect(locator).toHaveText(expected) failed

Locator: locator('.compress-notice')
Expected pattern: /正在压缩上下文/
Error: strict mode violation: locator('.compress-notice') resolved to 2 elements:
    1) <div tabindex="0" role="button" title="点击查看压缩状态" data-notice="context-compress" class="compress-notice is-running">…</div> aka getByRole('button', { name: '正在压缩上下文 压缩中' })
    2) <div hidden="" role="status" aria-live="polite" class="command-feedback compress-notice"></div> aka locator('.command-feedback')

## app.spec.js >> 设置：外观主题卡与自定义导入入口

Error: expect(locator).toHaveCount(expected) failed

Locator:  locator('.theme-card')
Expected: 1
Received: 0
Timeout:  5000ms

## commands.spec.js >> 空状态 offline 准确引导

Error: expect(locator).toHaveText(expected) failed

Locator:  locator('.empty-title')
Expected: "本地服务未连接"
Received: "欢迎回来，随时开始吧"
Timeout:  5000ms

## commands.spec.js >> 空状态 ready 准确引导

Error: expect(locator).toHaveText(expected) failed

Locator:  locator('.empty-title')
Expected: "今天想聊点什么？"
Received: "欢迎回来，随时开始吧"
Timeout:  5000ms

## commands.spec.js >> 空状态 unconfigured 准确引导

Error: expect(locator).toHaveText(expected) failed

Locator:  locator('.empty-title')
Expected: "先连接一个模型"
Received: "欢迎回来，随时开始吧"
Timeout:  5000ms

## modular-refactor.spec.js >> 共享历史表面与项目状态操作：创建、重命名、删除保留聊天

Test timeout of 30000ms exceeded.

## runtime-refinement.spec.js >> appearance dark

Error: expect(locator).toHaveCSS(expected) failed

Locator:  locator('.effort-current')
Expected: "rgb(214, 93, 177)"
Received: "rgb(255, 143, 163)"
Timeout:  5000ms

## runtime-refinement.spec.js >> appearance light

Error: expect(locator).toHaveCSS(expected) failed

Locator:  locator('.effort-current')
Expected: "rgb(214, 93, 177)"
Received: "rgb(255, 107, 107)"
Timeout:  5000ms

## settings-context.spec.js >> 上下文设置视觉 1280 light

Error: expect(page).toHaveScreenshot(expected) failed

  12251 pixels (ratio 0.02 of all image pixels) are different.

  Snapshot: context-1280-light.png

## settings-context.spec.js >> 上下文设置视觉 390 light

Error: expect(page).toHaveScreenshot(expected) failed

  16 pixels (ratio 0.01 of all image pixels) are different.

  Snapshot: context-390-light.png

## settings-context.spec.js >> 设置分类 1024 宽度下分组、能力说明与页面宽度完整

Error: expect(locator).toBeVisible() failed

Locator: getByRole('region', { name: '高级配置', exact: true })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

## settings-context.spec.js >> 设置分类 390 宽度下分组、能力说明与页面宽度完整

Error: expect(locator).toBeVisible() failed

Locator: getByRole('region', { name: '高级配置', exact: true })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

## visual.spec.js >> Everforest 外观主题卡

Error: expect(locator).toHaveCount(expected) failed

Locator:  locator('.theme-card')
Expected: 1
Received: 0
Timeout:  5000ms

## visual.spec.js >> Everforest 思考强度控件

Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('.effort-popover')
  3749 pixels (ratio 0.09 of all image pixels) are different.

  Snapshot: everforest-effort-popover.png

## visual.spec.js >> Everforest 真实消息 dark

Error: expect(page).toHaveScreenshot(expected) failed

  12181 pixels (ratio 0.02 of all image pixels) are different.

  Snapshot: everforest-messages-dark.png

## visual.spec.js >> Everforest 真实消息 light

Error: expect(page).toHaveScreenshot(expected) failed

  22430 pixels (ratio 0.03 of all image pixels) are different.

  Snapshot: everforest-messages-light.png

## visual.spec.js >> Everforest 空会话 dark

Error: expect(page).toHaveScreenshot(expected) failed

  16947 pixels (ratio 0.02 of all image pixels) are different.

  Snapshot: everforest-empty-dark.png

## visual.spec.js >> Everforest 空会话 light

Error: expect(page).toHaveScreenshot(expected) failed

  13511 pixels (ratio 0.02 of all image pixels) are different.

  Snapshot: everforest-empty-light.png

## visual.spec.js >> Everforest 运行配置与模型选择器

Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('.runtime-root-popover')
  685 pixels (ratio 0.03 of all image pixels) are different.

  Snapshot: everforest-runtime-root.png

## visual.spec.js >> HTML 与 SVG 产物工具栏深色

Error: expect(page).toHaveScreenshot(expected) failed

  30481 pixels (ratio 0.03 of all image pixels) are different.

  Snapshot: artifact-preview-toolbar-dark.png

## visual.spec.js >> HTML 与 SVG 产物工具栏移动端

Error: expect(page).toHaveScreenshot(expected) failed

  13841 pixels (ratio 0.05 of all image pixels) are different.

  Snapshot: artifact-preview-toolbar-mobile.png

## visual.spec.js >> Provider 中等宽度顶部切换器

Error: expect(page).toHaveScreenshot(expected) failed

  36340 pixels (ratio 0.06 of all image pixels) are different.

  Snapshot: provider-medium-workbench.png

## visual.spec.js >> Provider 模型编辑基础弹层

Error: expect(page).toHaveScreenshot(expected) failed

  26773 pixels (ratio 0.03 of all image pixels) are different.

  Snapshot: provider-model-dialog-basic.png

## visual.spec.js >> Provider 模型额度弹层深色

Error: expect(page).toHaveScreenshot(expected) failed

  25237 pixels (ratio 0.03 of all image pixels) are different.

  Snapshot: provider-model-dialog-advanced-dark.png

## visual.spec.js >> Provider 移动端列表与详情

Error: expect(page).toHaveScreenshot(expected) failed

  8577 pixels (ratio 0.03 of all image pixels) are different.

  Snapshot: provider-mobile-list.png

## visual.spec.js >> Provider 设置页面

Error: expect(page).toHaveScreenshot(expected) failed

  53366 pixels (ratio 0.06 of all image pixels) are different.

  Snapshot: settings-providers.png

## visual.spec.js >> onboarding 初始浅色

Error: expect(page).toHaveScreenshot(expected) failed

  20369 pixels (ratio 0.04 of all image pixels) are different.

  Snapshot: onboarding-initial-light.png

## visual.spec.js >> onboarding 初始深色

Error: expect(page).toHaveScreenshot(expected) failed

  19227 pixels (ratio 0.04 of all image pixels) are different.

  Snapshot: onboarding-initial-dark.png

## visual.spec.js >> 上下文与提示词集中配置

Error: expect(page).toHaveScreenshot(expected) failed

  22185 pixels (ratio 0.03 of all image pixels) are different.

  Snapshot: provider-advanced-open.png

## visual.spec.js >> 图像生成等待态深色

Error: expect(page).toHaveScreenshot(expected) failed

  14519 pixels (ratio 0.02 of all image pixels) are different.

  Snapshot: image-generation-pending-dark.png

## visual.spec.js >> 图像生成等待态移动端

Error: expect(page).toHaveScreenshot(expected) failed

  7434 pixels (ratio 0.03 of all image pixels) are different.

  Snapshot: image-generation-pending-mobile.png

## visual.spec.js >> 工具轻量时间线深色

Error: expect(page).toHaveScreenshot(expected) failed

  29097 pixels (ratio 0.03 of all image pixels) are different.

  Snapshot: tool-timeline-dark.png

## visual.spec.js >> 工具轻量时间线移动端

Error: expect(page).toHaveScreenshot(expected) failed

  14653 pixels (ratio 0.05 of all image pixels) are different.

  Snapshot: tool-timeline-mobile.png

## visual.spec.js >> 思考轨迹 dark

Error: expect(page).toHaveScreenshot(expected) failed

  23541 pixels (ratio 0.03 of all image pixels) are different.

  Snapshot: reasoning-trail-dark.png

## visual.spec.js >> 思考轨迹 light

Error: expect(page).toHaveScreenshot(expected) failed

  33528 pixels (ratio 0.04 of all image pixels) are different.

  Snapshot: reasoning-trail-light.png

## visual.spec.js >> 移动端思考轨迹

Error: expect(page).toHaveScreenshot(expected) failed

  13994 pixels (ratio 0.05 of all image pixels) are different.

  Snapshot: reasoning-trail-mobile.png

## visual.spec.js >> 移动端空会话

Error: expect(page).toHaveScreenshot(expected) failed

  10208 pixels (ratio 0.04 of all image pixels) are different.

  Snapshot: empty-chat-mobile.png

## visual.spec.js >> 空会话 dark

Error: expect(page).toHaveScreenshot(expected) failed

  18978 pixels (ratio 0.02 of all image pixels) are different.

  Snapshot: empty-chat-dark.png

## visual.spec.js >> 空会话 light

Error: expect(page).toHaveScreenshot(expected) failed

  14468 pixels (ratio 0.02 of all image pixels) are different.

  Snapshot: empty-chat-light.png
