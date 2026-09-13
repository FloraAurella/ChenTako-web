# 前端模块结构与开发约定

## 当前边界

这是 ChenTako 前端的源码重构，保留现有业务行为及兼容格式。`package.json` 使用项目名称 `chentako`；界面品牌更新为 ChenTako，归档读取、浏览器存储、旧 Electron 桥与 HTTP 认证头保持向后兼容。仓库外参考目录没有改动。

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
| `src/modules/extensions` | 原有工具、技能设置及包解析；配置与导入入口保留，执行未开放（非空 `extensions` 请求由后端明确拒绝），界面注明能力预留 |
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
| `server/app` | 后端环境配置（`AI_CHATBOX_*` 命名空间）与模块组合装配 |

`contracts/normalize.js` 保留旧数据规范化规则，经公开接口调用各领域的规范化函数。它属于兼容契约层，不能视作完全独立于业务的 Core。`app/state/store.js` 仍提供统一 store 门面，避免破坏原控制器和持久化结构；项目操作和聊天流操作已经从门面拆出。

## 模块如何接入

装配清单位于 `src/app/composition.ts`。模块通过 `setup({services, scope, events})` 注册设置分类、搜索条目、服务、页面或插槽。注册返回清理函数，交给 `scope.defer(...)`。设置目录与详情组件不再导入各个设置页面，不含逐功能分支。

模块初始化依赖在 `dependsOn` 中声明。运行时检查重复名称、缺失依赖和循环依赖；失败后逆序释放已启动模块以及当前失败模块的贡献。模块事件监听应与 scope 一起释放。

这是**源码装配**，没有运行中安装和卸载模块的产品界面。当前聊天、设置、连接、上下文、项目和外观构成必要应用核心；`extensions`、`data` 可从装配中关闭：

```bash
VITE_DISABLED_MODULES=extensions,data npm run dev -- --port 5188
```

关闭后对应设置分类、搜索结果和设置服务都不注册；访问旧设置地址回退到已安装分类。既有保存数据仍按原 schema 读取，因此不会删除用户此前保存的工具/技能或备份数据。这个开关验证贡献隔离，**不保证构建包完全不包含相关兼容解析代码**；若要物理裁剪代码，需要同时调整源码装配依赖与兼容 schema。

## 伪插件机制的正式定义

本仓库的模块装配方式正式定义为**伪插件（pseudo-plugin）**：

- 伪插件只面向开发者，是源码／构建时的模块装配方式。开发者通过修改装配清单（`composition.ts` / `module.tsx` 的 `dependsOn` 与注册）来增加、替换或关闭模块，然后重新构建并向用户分发整个软件。
- 用户不负责安装或管理这些模块；应用对用户表现为一个整体产品，模块边界只在源码与构建期存在。
- 当前不提供运行时安装、热卸载、插件市场、第三方 JS 执行或用户插件权限系统；`Core` 的注册表与 Scope 也不是通用用户代码加载器。
- 后续如支持用户导入新的扩展数据类型（例如新的主题包之外的资料类型），由开发者提供或替换对应模块来承接，而不是把 Core 演变成运行时代码执行环境。
- 按此定义，当前源码级模块装配已经属于伪插件机制；"运行时插件系统"不列为 V2 缺失项。除非用户将来明确启动运行时插件项目，这一约定长期有效。

跨模块入口位于各模块 `public/`，按具体职责拆成小入口，避免一个大 index 同时导入 UI、控制器、状态导致循环初始化。新增公开 API 应只暴露真正跨模块需要的接口；模块内部仍直接使用自己的实现文件。

## 资源库

`resources/registry.js` 提供拥有者与优先级：`user > module > system`。注销上层资源后，下层恢复。图标生成、字体 token 应用、Logo 与默认主题读取已通过资源解析；主题编辑和持久化继续由 appearance 模块负责。

`resources/logos/ChenTako.svg` 是默认品牌图形唯一源，固定使用 `24×24` 视窗与 `currentColor`。应用内标志、两个 HTML 首帧 favicon 和 appearance 生成的主题 favicon 都从该文件派生；替换品牌图形不得在调用方复制 SVG path。`logos/shapes.js` 只负责可信源码注册、安全子集解析与主题色注入，不拥有第二份图形数据。

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

聊天视图提供独立于消息列表重渲染的反馈容器，经 commands 公共入口的 `feedbackHost` 契约注入。commands 使用共享 `StatusText` 与图标资源、压缩标记样式呈现通知，拥有计时器、输入／会话版本校验及 React root 释放；通知保持临时 UI 状态，不进入消息树、归档或模型请求。

`FrontendContributions.commands` 注册指令。commands 模块负责解析、键盘及面板，chat 模块声明模型、强度和压缩操作，App 注入注册表。`contracts/commands.ts` 定义可用性检查、参数选项、执行结果和业务上下文。聊天按钮与指令共用运行配置服务；请求级快照隔离发送准备、自动压缩和配置变更。详见 [指令说明](COMMANDS.md)。

## 固定请求上下文

`FrontendContributions.requestContexts` 由 App 注入聊天控制器。每个贡献以同步 `capture` 返回完整文本或可处理错误；捕获发生在发送准备之前。聊天业务只消费通用贡献，不导入知识库私有文件。配置快照固定系统提示词与资料，最终聊天通过既有 `chatConfig.systemPrompt` 传递；压缩仍只接收历史、摘要、供应商及模型。固定部分超预算时不尝试压缩。

`projectKnowledge` 是 App 持久化组合中的新增可选字段，内容规范化归知识库模块所有，按项目 ID 隔离。完整 IndexedDB 和 localStorage 备份均保留正文；空间不足的降级骨架仅保留明确的缺失标记，读取时不得用旧正文冒充新资料。关闭源码装配中的 knowledge 模块仅移除其贡献，不删除持久化资料。

## 后端（server/）模块约定

后端沿用与前端相同的模块纪律：`server/core/` 不含业务；`server/modules/<feature>/` 按 `domain/`（纯规则）、`services/`（I/O）、`public/`（按职责小入口）组织；`server/app/composition.ts` 是唯一装配入口；跨模块只能经 `public/`，由 `npm run check:architecture:server` 强制。业务模块把 HTTP 端点注册进 `routes` 注册表、把能力句柄注册进 `services` 注册表（如 `providers.store`、`upstream`、`http-server`），gateway 请求时动态查询路由，装配顺序不影响可用性；全部注册经 `scope.defer`，模块释放自动注销。

线上契约以 `src/contracts/` 与 `src/modules/chat/stream/protocol.ts` 为权威，`server/contracts/` 镜像并由 `test/server/contracts-sync.test.ts` 全等断言防漂移。后端持久化仅限供应商注册表与加密 API Key（`server/.data/`，gitignore，目录 0700、主密钥 0600）；会话与项目资料留在浏览器存储。安全基线：仅回环监听、Origin 白名单、可选 `AI_CHATBOX_API_TOKEN` 时序比对、SSRF 防护（`AI_CHATBOX_SSRF_ALLOW` 白名单）。启动与脚本见 [README](../README.md)，验证证据见 [后端验证](BACKEND_VALIDATION.md)。

指令贡献契约新增可选 `label` / `icon` 展示元数据，由功能拥有者提供；通用面板经统一图标资源入口渲染，不按功能 ID 分支。业务执行和快照逻辑不变。详见 [品牌与指令改版](BRAND_COMMANDS_UPDATE.md)。

指令浮层的鼠标和键盘共用协调器 `active` 状态，渲染层仅报告真实指针移动。紧凑菜单的尺寸与中性选中材质归共享 `ui-menu-item` 模板与令牌所有，其他交互表面不受影响。二级图标从注册贡献继承。

聊天模块通过 `openTemporaryConversation` 管理待发送会话，首次用户消息追加操作原子转正并通知历史订阅。Store 注入记录创建能力，历史渲染经领域查询过滤。持久化 `isTemporary` 缺省兼容旧数据；详见 [待发送会话](TEMPORARY_CONVERSATIONS.md)。

侧栏布局度量由 `src/resources/styles/tokens.css` 的 `--sidebar-w: 304px` 统一拥有；`--archive-w` 与 `--settings-index-w` 作为兼容别名引用它，设置样式不再覆盖目录宽度。响应式断点与模块边界不变。

## 项目设置悬浮窗（2026-09-13）

`projects/ui/ProjectSettingsButton.tsx` 拥有项目设置界面，聊天列表只经 `projects/public/settings.ts` 使用入口。名称与删除仍调用项目状态操作。知识库通过有拥有者的 `project.settings` 插槽接入，由 `SlotContribution` 显式传递固定的 `projectId`；项目模块不依赖知识库私有实现，关闭可选 knowledge 模块后不残留设置分类、搜索项或资料编辑区。

共享 `ui/Modal.tsx` 只负责二级窗口的门户、滚动、键盘、焦点和关闭生命周期；嵌套确认时挂起下层窗口。知识库继续经 `services/library.ts` 保存资料，窗口卸载使异步读取版本失效。线上协议与持久化格式未变化。

## 前端文案与渐进展示（2026-09-13）

精简发生在各功能拥有的 UI 与展示文案源中，未采用全局 CSS 隐藏描述。共享 `SettingsGroup` 的描述改为可选，缺省不渲染空说明；`primitives.tsx` 新增原生 details/summary 封装 `Disclosure`，关于页更新记录按需展开。知识库无资料且无异常时不渲染聊天状态，文件预览只在有文件时显示。系统提示词、用户内容、协议、持久化和请求快照均未改变。

### 2026-09-13：模型逐项响应测试

connections 的 provider-service 提供 `testModel(model, signal)`，固定当前编辑配置发起请求；模型行只管理瞬态反馈、取消与卸载释放。供应商或端点切换会卸载对应测试组件，旧请求不能更新新模型的结果。后端 `/api/providers/test` 新增可选 `model`：未传时保留读取模型列表的行为；传入时由 providers/services/test-model 通过 upstream/public 契约构造四协议的最小非流式文字请求。共用现有 URL 校验、密钥解析与 15 秒超时，客户端断连释放请求；拒绝空回复、无效 JSON 与失败状态。测试不会创建聊天记录或持久化测试结果，返回的回复预览最多 160 字符。


### 一级设置即时保存与独立滚动

connections/provider-service 与 context/context-service 分别拥有保存调度、验证及状态提交；共享 settings 装配器仍只调用注入的导航契约。文本防抖和输入法组合状态由所属服务管理，切换前排空保存队列；视图 effect 释放定时器，供应商网络任务用 AbortController 和编辑会话版本隔离迟到结果。保存串行化，旧请求只推进对应原始基线，不覆盖更新的草稿；本地写入失败保留草稿并显示重试。

二级模型参数留在独立 modelEditing 草稿，点击保存才提交；失败保留弹窗、参数与错误，模型改名/default/能力别名一致迁移。新供应商使用稳定 ID 注册，重试不重复创建；允许先保存空模型列表。共享宽度由 --settings-max-w 决定，provider-rail-list 与 provider-detail 是两个独立滚动容器。共享 Core、服务端线上契约及持久化格式未改变。

## 响应结束任务与首次响应状态（2026-09-13）

聊天业务在网络响应终态写入完整内容后判断压缩，不再由发送准备流程执行。业务收尾不受滚动期间增量绘制节流影响。`chat/domain/first-response.js` 拥有一次性机会与运行锁规则；`chat/services/title-generation.js` 管理标题请求、取消和晚到结果保护，`auxiliary-models.js` 解析固定模型快照。项目移动/删除通过 App 注入的公共权限规则校验，UI 通过聊天 public 入口读取锁定原因。运行状态不持久化；一次性标记由既有会话兼容契约与归档保存。

圆环和压缩判断共用 `chat/public/domain_queries.js` 的实际消息投影。上下文模块提供阈值、自动预算、专用模型配置与项目继承。后端聊天模块新增 title 路由，和 compress 共用辅助生命周期；前后端辅助接口契约同步测试阻止路由漂移。详见 [响应上下文策略](RESPONSE_CONTEXT_POLICY.md)。

### ChenTako 默认主题资源

`resources/themes/tako-festival-theme-v1.json` 是 Tako Festival 的唯一令牌源；`resources/styles/tokens.css` 同步浅色、显式深色及系统深色首帧回退。`appearance/domain/custom/tako-festival.theme.js` 通过主题契约注册，不在页面复制颜色。历史 `everforest` ID 保持稳定，默认源码定义经已有种子刷新逻辑升级，用户同 ID 覆盖不强制改写。主题卡文案读取资源自身的 note，移除 Everforest 专属判断。字体使用资源注册表中的 humanist／rounded／mono 系统字体栈。

参考图配色修订仍只修改默认主题令牌及首帧镜像；无新增模块或依赖。参考图色值按界面语义映射，按钮文字与辅助说明使用对比度校验后的变体。

### 精简外观设置

appearance 模块不再贡献主题选择、导入导出界面与相应设置搜索项；仅渲染明暗、对比度、透景控制。保留领域注册表、导入导出服务、旧数据与主题公共 API，不通过删除数据实现关闭入口。

### 双态背景画作

用户已授权在纯色基底上叠加可信 SVG 装饰。`resources/artworks/index.js` 注册并解析源码画作 URL，appearance 控制器按主题 ID／模式写入私有 CSS 变量 `--theme-artwork`，Scope 释放时清除，切换无画作主题时写入 none。该变量不进入用户主题令牌白名单，不扩大用户 SVG 执行能力。共享样式只提供无交互的伪元素与响应式遮罩，所有业务选择仍归 appearance；App 不导入模块私有实现。

### 空会话欢迎布局

欢迎内容仍归 chat 的空态渲染器；共享样式依据 `.chat-page:has(.empty-stage)` 调整布局，不引入全局业务状态、重复 composer 或额外监听。附件按钮从资源图标注册表读取 paperclip，保持 DOM ID、文件选择及权限路径不变。

共享 panel 模板支持 `data-material="opaque"` 实色材质；commands 浮层显式使用，背景读取主题 surface-content，普通卡片仍按原对比度／透景规则渲染。悬停保持相同材质，不增加功能名称判断。


## 2026-09-13：章节写作模块

`writing` 是默认启用的可选模块，依赖 commands、chat、projects、context。作品归对话所有，章节、正文、候选、版本和模式全部由该模块的领域服务修改，既有 normalize 入口只通过 `writing/public/work.ts` 调用兼容校验。App 只装配模块和持久化作品字段。

跨模块新增 `chat.auxiliary` 插槽和 `RequestOperation` 公共生命周期：准备、验证、开始、更新、结束、释放。固定上下文贡献可给出预算分组；操作回调不进入配置快照。写作贡献连贯性检查与候选结果归属，聊天提供通用网络和取消机制，不包含章节／模式的业务分支。输出的 `contextText` 是跨模块消息兼容字段：可见正文保留，后续上下文与压缩使用该回执，避免未采纳章节正文混入历史摘要。

作品继续使用原浏览器存储键和对话 ZIP；关闭聊天历史保存时仍保存作品，但剥离普通消息。未来／损坏作品保留恢复数据并阻止发送。写作模块关闭后所有贡献清理，作品数据保留。请求系统文本上限采用前后端镜像 `LIMITS.requestSystemPromptChars`，非流式 `/api/chat` 额外返回 `finishReason` 用于完整性判断。详见 [写作使用说明](WRITING.md)。

## 文件提示词（2026-09-13）

根目录 `prompts/` 拥有产品提示词文本。前端通过 `src/resources/public/prompts.js` 的小入口读取构建资源；context 在有效请求配置中采用文件系统提示词，writing 读取自身任务提示词。旧配置字段保留归档兼容，但不再拥有提示词优先级。后端 chat 的 `services/prompt-files.ts` 按模块位置定位同一目录中的摘要／标题文件，在辅助请求开始时校验并捕获文本；不读取前端内部实现。没有新增注册业务单例、后端持久化或运行时用户代码执行。

提示词源文件允许作者暂存未格式化的 UTF-8 正文；`scripts/convert-prompts.mjs` 在 npm 启动／构建前预处理为 JSON 字符串，读取器仍只消费 JSON。转换脚本不进入应用运行时，不调用模型，不执行模板，写入前保存原始字节备份，再使用同目录临时文件替换。转换错误通过非零退出码阻止后续命令。

主题资源身份已与旧 Everforest 分离：`tako-festival` 由源码和默认主题包共同声明，背景资源使用同一 ID。appearance 负责旧 ID 的偏好迁移、归档裁剪与首次恢复过滤；不触碰会话或项目数据。

## 写入工作区调整（2026-09-13）

用户明确将首版候选／采纳改为直接正文。writing 服务以 `beginBody/updateBody/saveBody/selectVersion` 管理正文和版本；`workspaceVersion:2` 标识一次性旧稿迁移，UI 只展示当前正文版本。请求贡献声明 `outputSurface:workspace`，chat 通用传输为请求／响应消息保留同名持久化字段，聊天列表按归属隐藏工作区条目，树路径索引仍采用原路径以保证分支操作兼容。`executeOnSelect` 由指令贡献声明，协调器不按写作指令名分支。右侧可折叠状态归作品，折叠不卸载手动编辑状态。

### 2026-09-13 章节指令与右侧栏入口

新增通用 `chat.header.actions` 插槽，AppShell 仅在聊天路由渲染贡献，不含写作业务判断；writing 模块拥有右侧栏图标、开合状态和媒体查询订阅（卸载清理）。图标通过 resources 注册，按钮复用共享 IconButton。工作区始终挂载，以 transform/opacity 过渡并通过 inert/aria-hidden 管理关闭状态；不引入动画库或计时器。

`/name` 由 writing 指令贡献解析双参数并调用章节服务 rename；服务集中校验手动编辑锁、生成锁、名称和唯一性，保留稳定 ID 与所有版本。工作区移除创建和重命名表单，不删除领域操作或旧归档数据。

## ChenTako-web 暂停写作模块（2026-09-13）

App composition 的 suspendedModules 在启动前排除 writing，不使用 UI 隐藏代替业务停用。写作指令、插槽、请求上下文和请求操作均不注册；知识库与普通聊天贡献不变。资源提示词入口只静态导入 system；服务端 taskPrompt 仍仅读取 summary/title。转换脚本 PROMPT_NAMES 限定相同三个启用文件。恢复需显式解除装配暂停并恢复写作提示词目录映射和转换列表；源代码和归档兼容均保留。
