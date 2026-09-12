# 前端模块结构与开发约定

## 当前边界

这是 Clawbox 前端的源码重构，保留现有业务行为及兼容格式。`package.json` 使用项目名称 `ai-chatbox-structure-v2.0`；界面品牌、归档格式、浏览器存储键、Electron `window.clawbox` 桥与 HTTP 协议仍保持兼容。原 Clawbox 目录没有改动。

已接入前端项目知识库，经请求上下文贡献组合到现有 chatConfig.systemPrompt；历史压缩请求不携带项目资料。2026-09-12 起本仓库新增模块化后端 `server/`（见 [后端计划](BACKEND_PLAN.md)），前端契约与后端实现同仓对齐；Agent 权限与工具／沙箱执行系统仍不在范围。模拟 HTTP 验证不等于真实后端联调。

## 目录职责

| 位置 | 职责 |
|---|---|
| `src/app` | 选择模块、组合状态、装配 React 外壳、路由和平台生命周期 |
| `src/core` | 通用模块运行时、依赖排序、注册表、事件总线、作用域、细粒度订阅 |
| `src/contracts` | 既有序列化模型、规范化规则、设置和贡献类型 |
| `src/modules/commands` | 独立指令解析、补全、执行协调与帮助；业务能力由注册贡献和注入上下文提供 |
| `src/modules/chat` | 聊天页面、消息与分支、流处理、消息状态操作、查询和呈现 |
| `src/modules/knowledge` | UTF-8 文件、项目资料保存、预览与备份，注册全文请求上下文贡献 |
| `src/modules/projects` | 项目模型、项目状态操作、菜单动作、项目选择器 |
| `src/modules/connections` | 供应商与模型、API 适配、连接设置、后端状态同步 |
| `src/modules/context` | 提示词、上下文预算、压缩策略和配置编辑 |
| `src/modules/appearance` | 主题解析/校验、归档、外观配置与控制器 |
| `src/modules/extensions` | 原有工具、技能设置及包解析 |
| `src/modules/data` | 对话归档、迁移、备份与版本信息 |
| `src/modules/settings` | 接受注册贡献的目录、搜索、详情和服务组合器 |
| `src/modules/attachments` | 附件读取、格式识别与数量/大小限制 |
| `src/modules/onboarding` | 独立引导入口 |
| `src/shared` | UI 模板、弹窗/浮层、订阅桥、通用存储和请求适配 |
| `src/resources` | 图标、字体、品牌剪影、默认主题 JSON、CSS 和资源注册库 |
| `server/core` | 后端通用运行时：模块运行时、注册表、事件、Node 版 Scope、路由注册表、body 限额、SSE 写出器 |
| `server/contracts` | 线上协议契约（镜像 `src/contracts` 与前端流协议）与后端贡献类型 |
| `server/modules/gateway` | HTTP 传输与安全边界：仅回环监听、Origin/可选令牌校验、路由分发、404/405、CORS |
| `server/modules/upstream` | 四协议适配：请求构造、思考强度映射、SSRF 防护、流累积与投影、归一化、模型列表 |
| `server/modules/providers` | 供应商注册表（node:sqlite）与 AES-GCM 密钥保险库及对应端点 |
| `server/modules/chat` | `/api/chat` 编排（SSE v1）与 `/api/chat/compress` |
| `server/app` | 后端环境配置（`CLAWBOX_*` 命名空间）与模块组合装配 |

`contracts/normalize.js` 保留旧数据规范化规则，经公开接口调用各领域的规范化函数。它属于兼容契约层，不能视作完全独立于业务的 Core。`app/state/store.js` 仍提供统一 store 门面，避免破坏原控制器和持久化结构；项目操作和聊天流操作已经从门面拆出。

## 模块如何接入

装配清单位于 `src/app/composition.ts`。模块通过 `setup({services, scope, events})` 注册设置分类、搜索条目、服务、页面或插槽。注册返回清理函数，交给 `scope.defer(...)`。设置目录与详情组件不再导入各个设置页面，不含逐功能分支。

模块初始化依赖在 `dependsOn` 中声明。运行时检查重复名称、缺失依赖和循环依赖；失败后逆序释放已启动模块以及当前失败模块的贡献。模块事件监听应与 scope 一起释放。

这是**源码装配**，没有运行中安装和卸载模块的产品界面。当前聊天、设置、连接、上下文、项目和外观构成必要应用核心；`extensions`、`data` 可从装配中关闭：

```bash
VITE_DISABLED_MODULES=extensions,data npm run dev -- --port 5188
```

关闭后对应设置分类、搜索结果和设置服务都不注册；访问旧设置地址回退到已安装分类。既有保存数据仍按原 schema 读取，因此不会删除用户此前保存的工具/技能或备份数据。这个开关验证贡献隔离，**不保证构建包完全不包含相关兼容解析代码**；若要物理裁剪代码，需要同时调整源码装配依赖与兼容 schema。

跨模块入口位于各模块 `public/`，按具体职责拆成小入口，避免一个大 index 同时导入 UI、控制器、状态导致循环初始化。新增公开 API 应只暴露真正跨模块需要的接口；模块内部仍直接使用自己的实现文件。

## 资源库

`resources/registry.js` 提供拥有者与优先级：`user > module > system`。注销上层资源后，下层恢复。图标生成、字体 token 应用、logo 剪影与默认主题读取已通过资源解析；主题编辑和持久化继续由 appearance 模块负责。

源码模块可以注册可信图标/字体资源；用户主题文件继续经过已有数据格式校验，不接收可执行 JS 或用户 SVG 图标注册。用户资源仅允许 `theme/` 名称空间。注册库本身不是文件上传解析器，调用者不能跳过主题导入校验。

全局 CSS 顺序集中在 `resources/styles/index.css`。CSS 是构建资源，样式覆盖应通过设计 token 与共享模板完成，不提供运行时任意样式包注入。

## 共享 UI

`shared/ui/primitives.tsx` 提供 Surface、Button、IconButton、TextField、TextArea、ListItem、FieldGroup、StatusText。实际聊天输入容器、历史条目、设置卡片和表单控件已接入共享模板。`SettingsCard` 从上下文模块移入 shared，不再由其他模块借用业务页面里的卡片实现。

- `Surface variant="interactive"`：无边框，hover 高亮，选中独立表示。
- `Surface variant="panel"`：边框与背景常驻，hover 不改变材质。
- 子按钮、输入框保留焦点、禁用和错误反馈。
- 既有 CSS 类名与 DOM ID 保留，因为流式渲染和浏览器测试依赖这些契约。

此次保留原有视觉尺寸、圆角层级与布局；是否把所有历史设计 token 收敛为单一圆角数值，应在下一轮视觉修改时统一确认。

## 生命周期与验证

Scope 负责全局事件、计时器与帧回调；App 拆出 router、sidebar、platform 和连接同步。公共 popover 独立管理外部点击、Esc、定位与焦点恢复。App 卸载时停止流、释放监听并取消连接同步请求；React 组件订阅用 effect 清理。

```bash
npm run check:architecture
npm run typecheck
npm test
npm run build
npm run test:e2e
```

浏览器回归使用测试数据和模拟服务，不能证明真实模型服务或 Electron 主进程正确运行。测试报告区分原有断言/快照失配和新增回归，不自动刷新截图掩盖差异。

## 指令系统扩展

`FrontendContributions.commands` 注册指令。commands 模块负责解析、键盘及面板，chat 模块声明模型、强度和压缩操作，App 注入注册表。`contracts/commands.ts` 定义可用性检查、参数选项、执行结果和业务上下文。聊天按钮与指令共用运行配置服务；请求级快照隔离发送准备、自动压缩和配置变更。详见 [指令说明](COMMANDS.md)。

## 固定请求上下文

`FrontendContributions.requestContexts` 由 App 注入聊天控制器。每个贡献以同步 `capture` 返回完整文本或可处理错误；捕获发生在发送准备之前。聊天业务只消费通用贡献，不导入知识库私有文件。配置快照固定系统提示词与资料，最终聊天通过既有 `chatConfig.systemPrompt` 传递；压缩仍只接收历史、摘要、供应商及模型。固定部分超预算时不尝试压缩。

`projectKnowledge` 是 App 持久化组合中的新增可选字段，内容规范化归知识库模块所有，按项目 ID 隔离。完整 IndexedDB 和 localStorage 备份均保留正文；空间不足的降级骨架仅保留明确的缺失标记，读取时不得用旧正文冒充新资料。关闭源码装配中的 knowledge 模块仅移除其贡献，不删除持久化资料。

## 后端（server/）模块约定

后端沿用与前端相同的模块纪律：`server/core/` 不含业务；`server/modules/<feature>/` 按 `domain/`（纯规则）、`services/`（I/O）、`public/`（按职责小入口）组织；`server/app/composition.ts` 是唯一装配入口；跨模块只能经 `public/`，由 `npm run check:architecture:server` 强制。业务模块把 HTTP 端点注册进 `routes` 注册表、把能力句柄注册进 `services` 注册表（如 `providers.store`、`upstream`、`http-server`），gateway 请求时动态查询路由，装配顺序不影响可用性；全部注册经 `scope.defer`，模块释放自动注销。

线上契约以 `src/contracts/` 与 `src/modules/chat/stream/protocol.ts` 为权威，`server/contracts/` 镜像并由 `test/server/contracts-sync.test.ts` 全等断言防漂移。后端持久化仅限供应商注册表与加密 API Key（`server/.data/`，gitignore，目录 0700、主密钥 0600）；会话与项目资料留在浏览器存储。安全基线：仅回环监听、Origin 白名单、可选 `CLAWBOX_API_TOKEN` 时序比对、SSRF 防护（`CLAWBOX_SSRF_ALLOW` 白名单）。启动与脚本见 [README](../README.md)，验证证据见 [后端验证](BACKEND_VALIDATION.md)。
