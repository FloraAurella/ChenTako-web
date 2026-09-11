# 模块化重构验证记录

验证日期：2026-09-12。环境：macOS、本机 Chrome、Node 26.5、React 19.2.8、Vite 7.3.6。

## 结果

| 检查 | 结果 |
|---|---|
| 架构边界 | 通过：Core 独立、模块不得反向导入 App、跨模块使用 public、导入路径存在 |
| TypeScript | 通过 |
| 生产构建 | 通过：主页面与独立 onboarding 入口均生成 |
| 单元测试 | 38 文件，306 项通过（原有 299 + 新增 7） |
| 完整旧浏览器基线 | 重构前备份：90 通过，53 失败 |
| 完整旧浏览器回归 | 重构版本：90 通过，53 失败；失败名称与备份完全一致 |
| 最终接线后的可用旧用例 + 新增操作测试 | 92 项通过（90 原可用 + 2 新增） |
| 可选模块装配 | 默认七个设置分类；关闭 extensions/data 后仅三类，相应搜索结果消失 |
| 视觉与交互检查 | 默认/可选装配均无页面脚本错误；1280/1024/390 无页面横向溢出；panel hover 材质稳定 |
| 示例主题导出脚本 | 可在独立目录中生成 examples/everforest-package.json |

## 如何解释 53 项失败

没有删除失败用例，没有自动更新旧截图。`npm run test:e2e` 仍运行完整套件并报告它们。

为确认基线，从 `v2.0-before-modular-refactor.tar.gz` 恢复到临时目录，使用同一锁定依赖和浏览器，只修正副本缺失的默认主题文件路径及测试服务器端口。没有给备份加入本次模块化代码。

两次完整套件失败标题集合完全相等。明细为 `reports/regression-comparison.json`，其中 `newFailures` 与 `resolvedFailures` 都为空。

既有失败包括旧颜色值、旧文案、已变化的 DOM 定位器与菜单数量、原截图基线，以及要求先悬停才能显示的项目菜单按钮被测试直接点击等。它们不都能简单归类为“测试写错”，需要后续逐项决定修订测试还是修改现有体验。本次未改变这些产品行为。

在设置主页面和侧栏最后拆分后，重新运行原 90 项通过用例，并增加两项端到端操作验证，92 项通过。该次运行明确排除了已在备份复现的 53 项，不等于完整套件全绿；排除标题记录在 `reports/inherited-failure-titles.json`。

## 新增验证覆盖

- 模块依赖顺序、重复/缺失/循环检测。
- 初始化失败时连同失败模块一起回滚，允许重新启动。
- 重复 start/dispose 的幂等性与逆序清理。
- Scope 释放事件监听与待执行计时器。
- 关闭可选模块后分类、服务和搜索消失，旧路由回退。
- 资源层级覆盖、注销恢复、重复拥有者与用户图标限制。
- 七个注册设置页面可访问，使用统一输入模板与稳定 panel 材质。
- 项目创建、重命名、删除后仍保留聊天及草稿。

浏览器截图使用模拟接口生成，不能当作真实模型连通证据。已有流、附件、提示词、压缩、分支与 API 配置等回归验证的是前端行为；真实后端和 Electron 主进程未包含在这个前端目录里。

## 证据文件

- `reports/unit-tests.log`
- `reports/full-baseline-e2e.log`
- `reports/full-refactor-e2e.log`
- `reports/final-compatible-e2e.log`
- `reports/regression-comparison.json`
- `reports/modular-ui.json`
- `reports/fresh-visual-comparison.json`：同名新截图的像素比较，仅供诊断；存在时间文字、动画中间帧及共享焦点样式差异，不能据此声称全部像素一致。
- `reports/default-desktop.png`、`reports/settings-1280.png`、`reports/settings-1024.png`、`reports/settings-390.png`

## 后续指令系统验证

本文件保留模块化重构时的原始记录。新增指令系统、337 项单元测试及后续浏览器回归见 [指令系统验证记录](COMMANDS_VALIDATION.md)。
