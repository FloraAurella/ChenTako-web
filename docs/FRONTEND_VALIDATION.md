# 前端阶段验证：模块规范与项目资料

日期：2026-09-12。此记录是阶段交付，不表示整个前端完成计划已全部完成。

## 完成范围

- AGENTS.md 强制约定模块所有权、公共接口、注册贡献、清理、资源、共享组件、资料全文及验证边界。
- 独立 knowledge 模块：UTF-8 文件读取、全文预览、项目隔离、替换／删除、独立 JSON 资料备份与恢复；聊天入口由插槽注册，详情由设置贡献注册。
- 固定全文经请求贡献注入既有 chatConfig.systemPrompt；正式请求完整携带，压缩请求不含资料，固定部分超预算直接拦截。
- 原有双轨存储追加 projectKnowledge，保留全文；明确区分空文件与缺失正文，拒绝用旧正文覆盖更新的缺失记录。
- 上下文提示列出系统提示词、固定资料、历史摘要、草稿附件、扩展及输出预留，现有按钮保持不变。
- 修正 manifest 与实际验证环境不一致的问题，补齐 Vitest、jsdom、Testing Library、fake-indexeddb，锁定已验证的前端工具版本。

## 验证结果

| 检查 | 结果与证据 |
|---|---|
| 架构检查、类型检查、生产构建 | 工作目录及独立安装目录均通过 |
| 首轮定向单元测试 | 45 / 45 通过（知识库、存储、模块运行时、用量） |
| 全部单元测试 | 工作目录首轮 344 / 344；补充新旧正文恢复用例后，独立安装目录 41 文件、345 / 345 通过 |
| 存储追加验证 | 31 / 31 通过，见 reports/knowledge-storage-tests.log |
| 新增知识库浏览器用例 | 10 / 10 通过，包含全文预览安全、项目隔离、上传替换删除、刷新恢复、请求注入、压缩隔离、缺失／超预算拦截和六种主题宽度组合 |
| 完整浏览器回归 | 182 项：130 通过、52 失败、0 跳过；无新增失败标题 |
| 独立安装 | 新临时目录执行 npm ci --ignore-scripts --no-audit --no-fund，随后架构／类型／345 单元测试／构建全部通过；未复制 node_modules |

完整浏览器结果见 `reports/frontend-full-e2e.json`，差异清单见 `reports/frontend-regression-comparison.json`。与保留的 53 项历史失败标题相比，`touch cancellation and visibility cleanup` 本次通过；未专门修复该旧用例，不将单次通过宣称为稳定解决。其余 52 项仍待逐项核验。没有修改旧断言或更新截图基线。

资料界面的 `reports/knowledge-{light,dark}-{1280,1024,390}.png` 验证无页面横向溢出，抽查桌面深色与手机浅色截图。完整回归中的指令截图另存为 `reports/frontend-commands-*`，恢复并保留先前 `reports/commands-*` 证据。

独立安装结果见 `reports/frontend-clean-verification.json` 和 `reports/frontend-clean-install.log`。使用 macOS / Node 26.5.0，未执行 Electron 安装脚本或打包；未验证全部声明支持的 Node 版本。原有 Electron 开发依赖及桥契约保留，未修改桌面实现。

## 尚未完成

- 历史失败的逐项分析、稳定性修复及失效断言的有依据修订。
- 完成计划中的设置常用／高级分类、全局模板一致性复核及其余前端入口收尾。
- 资料在极大文本／快速生成下的性能专项，以及备份恢复、取消操作等更细的浏览器回归扩展。

所有 HTTP 用例均为本机模拟，不证明真实后端接受完整大资料、四协议适配或实际模型效果；后端修改等待用户另行指令。Agent、权限和新业务数据库不在本次范围。

## 2026-09-12 收尾记录

- 设置分类分组：共享层新增 `SettingsGroup` 模板，上下文设置页分为"常用配置／高级配置"两组；settings-context 浏览器用例 10 / 10 通过，含新的分组可见性断言（见 reports/frontend-context-followup.log）。
- 大资料性能：knowledge 领域为规范化结果与全文拼接结果增加 WeakMap 缓存（正文原地修改、删除、顺序变化均失效）；chat 控制器拆出 `resolveRequestParts` 供常驻圆环复用请求快照，避免输入时重复编码／克隆大资料。新增 2 条单元用例，全部单元测试 41 文件、347 / 347 通过（见 reports/frontend-followup-unit.log）。
- 浏览器用例补充与修复：seed 脚本增加修订号防止重复注入覆盖设置；导航选择器与菜单 role 断言修正；新增资料备份恢复／取消恢复、大资料不重复编码用例。followup e2e 39 / 39 通过（见 reports/frontend-followup-e2e.log）。
- 过时断言修订（有产品依据）：`主题 JSON：更新默认主题、重启恢复并删除自定义变体` 此前断言按钮令牌跟随主题主色 `#93B259`。主题包 JSON `everforest-clawbox-theme-v1.json` 实际为 `--btn-primary`／`--send-btn` 定义更深的 `#617D43` 系列（白字对比度），`#93B259` 仅用于品牌标识与强调色，`tokens.css` 默认值一致；导入按钮为次要按钮，背景跟随 `--surface-elevated`（#F0F0E8）。断言按产品数据修正。
- 修订后 app.spec 完整运行 68 项：59 通过、9 失败，9 条全部属于 52 项历史失败基线，无新增失败（见 reports/frontend-app-theme-followup.log）。已解决的继承失败累计 2 项：`touch cancellation and visibility cleanup` 与 `主题 JSON：更新默认主题、重启恢复并删除自定义变体`。

尚未完成：其余 50 项历史失败的逐项分析、稳定性修复及有依据的断言修订；其他设置分类的常用／高级分组复核；资料在极大文本／快速生成下的性能专项扩展。
