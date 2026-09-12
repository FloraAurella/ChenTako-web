# ai-chatbox-structure-v2.0

基于复制的 Clawbox 前端进行模块化重构的 AI 聊天应用。当前保留原有界面和业务行为，将聊天、项目、连接、上下文、外观等功能分开组织，方便后续逐模块修改。

使用 React、Vite 和 TypeScript，同时保留部分 JavaScript 实现。界面品牌、浏览器存储键、归档格式、HTTP 协议及 `window.clawbox` 桌面桥仍保留兼容约定。

仓库内已包含模块化 Node 后端（`server/`，零运行时依赖）：四协议上游适配、应用层 SSE v1 流式协议、供应商注册表与加密 API Key 存储。项目知识库在前端完成上传、全文携带、压缩隔离和本地备份；真实供应商联调、Agent 权限与工具／沙箱执行系统、Electron 桌面主进程尚未实施。下文的 `resources/` 是界面资源库，不是用户上传资料的项目知识库。

## 本地启动

需要 Node.js 20.19+（后端要求 Node 22.5+，开发验证环境为 Node 26）。后端以原生 TypeScript 由 Node 直接运行，使用 `node:sqlite`；未引入构建或转译步骤，完整的最低 Node 版本政策留待后端／平台阶段统一确定。在本目录执行：

```bash
npm ci
npm run dev:server   # 模块化后端，监听 127.0.0.1:3000（需 Node 22.5+）
npm run dev -- --host 127.0.0.1 --port 5188 --strictPort
```

主页面：<http://127.0.0.1:5188/#/chat>；独立引导页面：<http://127.0.0.1:5188/onboarding.html>。直接运行 `npm run dev` 的配置默认端口为 5173。

开发服务器默认把 `/api` 请求代理到 `http://127.0.0.1:3000`，即 `npm run dev:server` 启动的后端。后端未运行时前端显示连接不可用；能打开前端不代表已经连通真实模型——需要先在设置中配置供应商与 API Key。后端环境变量使用 `CLAWBOX_*` 命名空间（`PORT`、`HOST`、`API_TOKEN`、`DATA_DIR`、`SSRF_ALLOW`、`CORS_ORIGIN`、`DISABLED_MODULES`），只监听本机回环；供应商与加密 Key 保存在 `server/.data/`（不入库）。仅运行前端、用浏览器 mock 验证时可跳过后端。桌面专属行为还需要外部 Electron 主进程提供桥接口。详见 [后端计划](docs/BACKEND_PLAN.md)。

```bash
npm run build
npm run preview -- --host 127.0.0.1 --port 5188
```

构建结果写入 `dist/`，包含主页面和引导页面。预览前需停止占用同一端口的开发服务。生产静态服务器需要自行配置 `/api` 反向代理；当前 Vite 配置只在开发服务器中声明了该代理。

## 项目资料入口

聊天输入区上方的“项目知识库”，或设置中的“项目知识库”，可管理项目资料。UTF-8 文本、Markdown 和代码保留全文；单文件 1 MiB、每项目 8 MiB / 64 份。支持预览、替换、删除、独立资料备份和恢复。详情见 [项目知识库](docs/KNOWLEDGE.md)。

安装使用锁文件，前端开发可加 `--ignore-scripts` 避免执行未使用的桌面安装脚本；本轮不提供 Electron 打包。独立安装验证结果见 [前端阶段验证](docs/FRONTEND_VALIDATION.md)。

## 指令入口

在聊天输入框输入 `/` 查看 `/model`、`/effort`、`/compact`、`/help`。支持参数补全和快捷参数，例如 `/effort high`。原有按钮仍然可用；指令文本不发送给模型，附件保留。完整规则见 [指令使用与开发说明](docs/COMMANDS.md)。

## 根目录总览

```text
v2.0/
├── src/                 前端源码：应用装配、业务模块、共享组件与资源
├── server/              模块化 Node 后端：core 运行时、四协议适配、供应商与密钥存储
├── docs/                架构、重构计划、验证记录和源码迁移映射
├── test/                单元测试与组件测试（test/server/ 为后端测试）
├── e2e/                 浏览器端到端测试及截图基线
├── scripts/             架构检查、视觉核验和示例生成工具
├── examples/            可导入的示例主题包
├── reports/             已留存的验证日志、截图和比较结果
├── dist/                构建生成的发布文件，不在这里修改源码
├── node_modules/        包管理器安装的依赖，不手动修改
├── test-results/        Playwright 当次运行生成的临时结果
├── README.md            项目入口说明与目录导航（本文）
├── AGENTS.md            修改代码时遵守的开发约定
├── index.html           主应用 HTML 入口
├── onboarding.html      独立引导页 HTML 入口
├── package.json         项目信息、依赖声明和 npm 命令
├── package-lock.json    安装依赖使用的锁文件
├── vite.config.js       开发代理、双页面构建和单元测试配置
├── playwright.config.js 浏览器、测试端口和截图断言配置
├── tsconfig.json        前端 TypeScript 检查范围和编译选项
├── tsconfig.server.json 后端 TypeScript 检查配置（node 语义）
└── .gitignore           依赖、构建产物、server/.data 及临时文件的忽略规则
```

`dist/`、`node_modules/`、`test-results/` 在构建、安装或测试后生成，干净副本中可以不存在。若生成 `playwright-report/`，它存放 Playwright 的 HTML 报告；当前配置未显式启用 HTML reporter。以上生成目录均在忽略规则中。系统生成的 `.DS_Store` 不属于项目逻辑。

## 前端源码的六个部分

| 目录 | 职责 |
|---|---|
| [src/app/](src/app/) | 将模块组装成应用，连接入口、路由、外壳、全局状态和生命周期 |
| [src/core/](src/core/) | 通用模块运行时、注册表、事件与资源释放机制，不包含业务规则 |
| [src/contracts/](src/contracts/) | 数据兼容格式、规范化规则、设置与模块贡献类型 |
| [src/modules/](src/modules/) | 按功能拥有自己的模型、服务、状态操作和界面 |
| [src/shared/](src/shared/) | 多个模块共用的控件、弹窗、订阅、存储与工具 |
| [src/resources/](src/resources/) | 图标、字体栈、品牌图形、主题、CSS 和资源注册 |

### `src/app/`：应用装配

| 位置 | 用途 |
|---|---|
| `main.tsx`、`MainApp.tsx` | 挂载主应用，连接 React 与应用启动、清理流程 |
| `onboarding.tsx` | 挂载独立引导页面 |
| `composition.ts` | 模块装配清单，创建贡献注册表，选择并启动模块 |
| `bootstrap.js` | 协调应用初始化、控制器、全局监听和释放 |
| `router.js` | 页面路由与导航 |
| `platform.js` | 浏览器与桌面环境适配 |
| `shell/` | `AppShell.tsx` 组织外壳并渲染注册页面；`sidebar.js` 管理侧栏行为；`query.js` 提供外壳查询 |
| `state/` | `store.js` 是统一状态门面；`persistence.js` 连接状态读取与保存 |
| `styles/` | 应用样式入口；`main.css` 导入资源库中的统一 CSS 入口 |

统一 store 仍然存在，以保持原控制器与存储格式兼容。聊天和项目的具体状态操作已分别放入各自模块的 `state/`。新功能的完整业务实现应放在模块中，而不是继续堆入应用启动文件。

### `src/core/`：通用基础设施

这里没有进一步的子目录，按能力划分文件：

| 文件 | 用途 |
|---|---|
| `modules.ts` | 校验模块依赖、排序启动、失败回滚和逆序释放 |
| `scope.ts` | 管理监听器、定时器、帧回调及清理函数 |
| `registry.ts` | 按拥有者注册、读取和清理贡献项 |
| `events.ts` | 通用事件总线 |
| `observable.js` | 按键订阅及快照等通用状态通知能力 |

### `src/contracts/`：公共契约与兼容数据

`constants.js` 保存兼容常量，`normalize.js` 规范化旧数据，`settings.ts` 定义设置相关类型，`contributions.ts` 定义模块注册的页面、设置、服务等贡献接口，`request-context.ts` 定义请求准备阶段捕获固定全文的契约。

`normalize.js` 会通过公开接口调用业务模块的规范化函数，因此这一层是兼容契约层，不能等同于完全不依赖业务的 `core/`。

## `src/modules/`：业务模块

每个模块负责一类功能。通用子目录的职责如下，模块只创建自己实际需要的目录：

| 子目录或文件 | 职责 |
|---|---|
| `domain/` | 数据模型、规范化、预算计算、归档解析等业务规则 |
| `services/` | 组织业务操作，连接状态、接口、存储或界面行为 |
| `state/` | 本模块对应用状态的具体修改操作；目前聊天和项目具有此目录 |
| `ui/` | 本模块的 React 页面、区块和对话框内容 |
| `public/` | 其他模块或应用使用的公开入口；通常是小型转出文件，不是静态资源目录 |
| `module.tsx` | 声明依赖并注册页面、设置、服务、控制器或插槽；并非每个功能目录都有它 |

### 各模块的职责与内部目录

| 模块 | 功能范围 | 当前子目录如何分工 |
|---|---|---|
| [knowledge/](src/modules/knowledge/) | 项目资料全文上下文及本地管理 | `domain/`：文件读取、校验、完整文本捕获和备份；`services/`：唯一资料保存操作；`ui/`：资料详情与聊天状态；`public/`：持久化规范化与模块入口；`module.tsx`：注册设置、插槽和请求上下文 |
| [commands/](src/modules/commands/) | 独立斜杠指令系统：补全、参数选择、执行协调和帮助 | `domain/`：输入解析；`services/`：键盘、面板、执行与草稿隔离；`ui/`：共享模板组成的指令面板；`public/`：公开接口；`module.ts`：注册帮助指令 |
| [chat/](src/modules/chat/) | 聊天页面、历史会话、消息分支、发送与流式展示 | `domain/`：会话树与查询；`services/`：会话操作、消息渲染、流图片和运行事件；`state/`：消息与流状态操作；`stream/`：流协议、SSE 传输、会话、调度与注册；`ui/`：聊天区、历史和消息列表；`public/`：公开接口 |
| [projects/](src/modules/projects/) | 项目创建、重命名、删除与选择 | `domain/`：项目模型；`services/`：项目操作；`state/`：项目状态变更；`ui/`：项目选择器；`public/`：公开接口 |
| [connections/](src/modules/connections/) | 供应商、模型、API 配置与后端连接状态 | `domain/`：模型规则与适配器；`services/`：供应商服务、密钥接口与后端同步；`ui/`：连接设置、编辑对话框和工作区；`public/`：公开接口 |
| [context/](src/modules/context/) | 提示词、上下文预算、用量与压缩配置 | `domain/`：配置和预算规则；`services/`：配置服务与用量计算；`ui/`：上下文设置页；`public/`：公开接口 |
| [appearance/](src/modules/appearance/) | 主题、外观设置、主题导入导出及偏好保存 | `domain/`：主题定义、校验、包与归档；`domain/custom/`：内置自定义主题定义；`services/`：外观设置与偏好持久化；`ui/`：外观设置页和主题卡片；`public/`：公开接口。根部 `controller.js`、`surface.js` 负责主题应用与表面外观 |
| [extensions/](src/modules/extensions/) | 原有工具、技能设置及技能包解析；当前版本保留配置与导入入口，工具／技能执行尚未开放，非空 `extensions` 请求由后端明确拒绝 | `domain/`：扩展模型和技能包；`services/`：扩展设置服务；`ui/`：工具与技能设置（含能力预留说明）；`public/`：公开接口。这里不代表已实现新的 Agent 权限系统 |
| [data/](src/modules/data/) | 对话归档、迁移、备份与版本信息 | `domain/`：归档与更新记录；`services/`：数据设置服务；`ui/`：数据及关于页面；`public/`：公开接口 |
| [settings/](src/modules/settings/) | 设置目录、搜索和详情页的统一入口 | `services/`：组合已注册的领域服务；`ui/`：设置导航和详情容器；`public/`：公开接口。具体连接、外观等字段仍由对应业务模块拥有 |
| [attachments/](src/modules/attachments/) | 附件读取、格式识别、数量及大小限制 | `services/`：附件处理；`public/`：公开接口。当前作为功能服务被调用，没有独立模块注册文件 |
| [onboarding/](src/modules/onboarding/) | 首次使用的独立引导页面 | `ui/`：引导组件；`public/`：组件公开入口；根部 `legacy-entry.js` 保留原引导逻辑。由 `app/onboarding.tsx` 单独挂载，没有独立模块注册文件 |

### 模块如何组合

应用通过 `app/composition.ts` 选择模块，`core/modules.ts` 按依赖启动它们。模块注册设置分类、搜索入口、页面、控制器或 UI 插槽，再由应用外壳和设置容器渲染这些贡献。

跨模块调用必须经过对方的 `public/` 或注入的契约，不能直接引用对方的 `services/`、`ui/` 等私有文件。模块也不能反向导入 `app/`。

当前必要模块为 `commands`、`chat`、`settings`、`appearance`、`connections`、`context`、`projects`。可选模块 `extensions`、`data`、`knowledge` 可以在启动前关闭：

```bash
VITE_DISABLED_MODULES=extensions,data npm run dev -- --port 5188 --strictPort
```

关闭后不注册对应的设置分类、搜索结果和设置服务。这是源码装配能力，没有运行中安装或卸载模块的产品界面，也不保证构建包完全移除相关兼容解析代码。旧保存数据仍保留兼容读取。

## `src/shared/`：统一组件与共享工具

| 目录或文件 | 用途 |
|---|---|
| `ui/` | `primitives.tsx` 提供 Surface、Button、IconButton、TextField、TextArea、ListItem、FieldGroup、StatusText；`SettingsCard.tsx` 提供统一设置卡片与"常用／高级配置"分组（`SettingsGroup`）；`Icon.tsx` 提供图标组件 |
| `overlays/` | 对话框层、对话框服务、Popover 控制器及行内错误展示与服务 |
| `settings/` | 多个设置模块共用的界面辅助组件与视图模型 |
| `state/` | React 状态订阅适配与模块贡献的 Context Provider |
| `storage/` | 安全访问浏览器存储的通用封装 |
| `api.js` | 通用请求封装 |
| `markdown.js` | Markdown 处理 |
| `dialogs.js` | 公共对话框调用入口 |
| `utils.js` | 通用辅助函数 |

所有页面优先复用这些模板。历史项、项目项和菜单项使用无边框交互表面，悬停高亮，选中状态独立表达；输入容器、设置卡片和详情容器使用有边框表面，悬停不改变背景或边框。内部按钮和输入控件仍保留自己的焦点、错误及禁用反馈。

当前保留复制界面的尺寸与圆角层级。后续统一视觉时应修改共享模板和设计令牌，避免在每个页面重新实现一套按钮、输入框或历史条目。

## `src/resources/`：界面资源库

| 目录或文件 | 用途 |
|---|---|
| `icons/` | 图标定义及读取入口 |
| `fonts/` | 字体栈定义与字体令牌，不是下载字体的缓存目录 |
| `logos/` | 品牌图形与剪影定义 |
| `themes/` | 内置默认主题 JSON 和默认主题读取入口 |
| `styles/` | 全局设计令牌、基础样式、外壳、组件、响应式、设置、引导页及共享模板样式 |
| `registry.js` | 按资源拥有者与优先级注册、解析和注销资源 |

资源优先级为 `user > module > system`；上层注销后恢复下层资源。用户层仅开放 `theme/` 名称空间，主题文件仍需经过外观模块校验。

样式入口是 `styles/index.css`，主应用经 `app/styles/main.css` 导入；引导入口另外加载 `styles/onboarding.css`。调整颜色、间距、圆角等先查看 `styles/tokens.css`，共享控件规则查看 `styles/primitives.css`。主题编辑、校验和持久化属于 `modules/appearance/`，界面资源定义属于这里。

## `server/`：模块化 Node 后端

零运行时依赖（`node:http` + `node:sqlite`），TypeScript 由 node 直接运行，未引入后端构建步骤；SQLite 依赖 Node 22.5+ 的内置 `node:sqlite`，完整的最低版本政策留待后端／平台阶段统一确定。目录职责与前端镜像：

| 目录或文件 | 用途 |
|---|---|
| `server/core/` | 模块运行时、有属主注册表、事件总线、Scope、路由注册表、body 限额、SSE 写出器——不含业务规则 |
| `server/contracts/` | 线上协议契约（镜像前端 LIMITS／四协议／SSE v1 事件）与贡献类型 |
| `server/modules/gateway/` | HTTP 传输与安全边界；`/api/health` 在此注册 |
| `server/modules/upstream/` | 四协议适配、SSRF 防护、流累积与投影、非流式归一化 |
| `server/modules/providers/` | 供应商注册表（SQLite）、AES-256-GCM 密钥保险库、providers/key/test 端点 |
| `server/modules/chat/` | `/api/chat`（SSE v1）与 `/api/chat/compress` 编排 |
| `server/app/` | 环境配置与组合装配；`main.ts` 为进程入口 |

后端持久化仅限供应商注册表与加密 Key（`server/.data/`，gitignore）；会话与项目资料留在浏览器。`extensions` 一期只接受空声明，工具／沙箱执行明确拒绝。完整约定见 [AGENTS.md](AGENTS.md) 与 [架构文档](docs/ARCHITECTURE.md)。

## 文档、示例、脚本和测试目录

当前开发约束见 [AGENTS.md](AGENTS.md)；本轮工作清单见 [前端完成计划](docs/FRONTEND_COMPLETION_PLAN.md)。项目资料的使用与限制见 [知识库说明](docs/KNOWLEDGE.md)，本次测试结果见 [前端阶段验证](docs/FRONTEND_VALIDATION.md)。

### `docs/`：设计与实施记录

| 文档 | 阅读目的 |
|---|---|
| [COMMANDS_VALIDATION.md](docs/COMMANDS_VALIDATION.md) | 本次指令系统的测试结果、对比度和浏览器回归证据 |
| [COMMANDS_REVIEW.md](docs/COMMANDS_REVIEW.md) | 本次指令实现的交付自审 |
| [COMMANDS.md](docs/COMMANDS.md) | 四个指令的语法、补全、作用范围、并发行为和开发结构 |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | 模块边界、公开接口、资源注册和开发约定 |
| [BACKEND_PLAN.md](docs/BACKEND_PLAN.md) | 模块化后端的目标、决策与契约来源 |
| [BACKEND_VALIDATION.md](docs/BACKEND_VALIDATION.md) | 后端实现范围、测试证据与尚未完成项 |
| [MODULAR_REFACTOR_PLAN.md](docs/MODULAR_REFACTOR_PLAN.md) | 模块化重构计划与完成范围 |
| [source-migration-map.json](docs/source-migration-map.json) | 查询原 Clawbox 源文件迁移到了哪里 |
| [VALIDATION.md](docs/VALIDATION.md) | 已执行验证、历史失败基线和证据范围 |
| [REVIEW.md](docs/REVIEW.md) | 重构交付时的自审及后续改进建议 |

### `examples/` 与 `scripts/`：示例和开发工具

`examples/everforest-package.json` 是示例主题包，用于查看和演示主题导入格式，不是用户配置的保存位置。

| 脚本 | 用途与运行条件 |
|---|---|
| `scripts/check-architecture.mjs` | 检查 Core 隔离、模块不得导入 App、跨模块公开入口与导入路径；通过 `npm run check:architecture` 执行 |
| `scripts/build-example-theme-package.mjs` | 从内置主题生成 `examples/everforest-package.json`；运行会覆盖该示例文件 |
| `scripts/verify-modular-ui.mjs` | 核验默认及可选模块装配、设置表面和响应式，并写入 `reports/`；需先在 5188 启动默认装配，在 5199 启动关闭 extensions/data 的装配，使用本机 Chrome |
| `scripts/visual-check.mjs` | 原有浅深主题、计算样式和对比度核验；需先启动 5173 服务及准备 Playwright 浏览器 |
| `scripts/chat-visual-check.mjs` | 原有聊天消息几何和截图核验，模拟聊天流；运行前查看脚本中的服务地址与浏览器要求 |

视觉脚本用于专项诊断，部分断言沿用原界面假设，不代表当前全部通过；它们不随 `npm test` 自动执行。

### `test/` 与 `e2e/`：自动化验证

`test/` 存放 Vitest 单元测试和 React 组件测试，覆盖模块运行时、状态、归档、主题、附件、流处理及界面组件。`test/setup.js` 初始化测试环境，测试文件按所测能力命名。

`e2e/` 存放 Playwright 浏览器测试，覆盖聊天、项目、设置、流式性能与视觉表现。它有两个截图基线子目录：

- `e2e/visual.spec.js-snapshots/`：整体视觉测试的预期截图。
- `e2e/settings-context.spec.js-snapshots/`：上下文设置相关测试的预期截图。

这些截图属于测试输入；确认产品视觉变更后才能相应更新，不应通过批量刷新截图掩盖失败。

| 命令 | 用途 |
|---|---|
| `npm run check:architecture` | 检查前端源码架构边界 |
| `npm run check:architecture:server` | 检查后端 server/ 架构边界 |
| `npm run typecheck` | TypeScript 静态检查（前端与 server 各自 tsconfig），不生成文件 |
| `npm run dev:server` | 启动模块化后端（`node --watch`，127.0.0.1:3000） |
| `npm run start:server` | 启动模块化后端（不带 watch） |
| `npm test` | 执行单元与组件测试（含 test/server/ 后端测试） |
| `npm run test:watch` | 在监听模式下运行单元测试 |
| `npm run build` | 验证主应用与引导页能否构建 |
| `npm run test:e2e` | 执行完整浏览器测试 |
| `npm run test:stream` | 单独执行浏览器流式性能测试 |

浏览器测试默认使用本机 Chrome，自动启动独立的 5198 服务，不复用当前预览服务器。该服务设置 `FRONTEND_E2E=1`，关闭真实后端代理。

### `reports/` 与 `test-results/`：保留证据和临时输出

`reports/` 保存重构验证时留下的日志、JSON 比较结果和截图，例如单元测试日志、重构前后浏览器回归比较、默认/可选模块界面截图。它是历史证据，不是测试用例、运行时依赖或用户上传目录。

`test-results/` 是 Playwright 当次运行产物，可包含错误上下文和失败截图，后续运行可能覆盖。需要长期保留的结论与证据应整理到 `docs/` 和 `reports/`。

截至 [2026-09-12 的验证记录](docs/VALIDATION.md)，架构检查、类型检查和构建通过，单元测试 306 项通过；完整旧浏览器套件在重构前后均为 90 项通过、53 项失败，失败标题集合一致。以上是重构当时的留存记录，不是当前状态。

**当前基线（2026-09-12 前端收口轮，见 [前端验证记录](docs/FRONTEND_VALIDATION.md)）**：架构检查（前端与 server）、TypeScript 类型检查、生产构建通过；单元测试 49 个文件 406 / 406 通过（无 `act(...)`、localStorage 实验警告与预期错误 stderr 噪声）；浏览器回归 185 / 185 通过（无跳过或删除用例），其中 29 个视觉快照经逐项审核后更新。历史阶段数字（306、345、406 混杂时期）仅作为各阶段证据保留在对应验证文档中，不代表当前状态。

## 修改功能时从哪里开始

| 想修改的内容 | 优先查看 |
|---|---|
| 应用布局、侧栏与页面导航 | `src/app/shell/`、`src/app/router.js` |
| 聊天输入、消息、历史列表 | `src/modules/chat/ui/`、`src/modules/chat/controller.js` |
| 流式消息处理 | `src/modules/chat/stream/`、`src/modules/chat/state/` |
| 项目创建、选择与管理 | `src/modules/projects/` |
| 供应商、模型和 API 连接 | `src/modules/connections/` |
| 指令相关聊天交互 | `src/modules/commands/`；业务定义在 `src/modules/chat/services/commands.ts` |
| 系统提示词、预算与压缩设置 | `src/modules/context/` |
| 按钮、输入框、卡片的统一行为 | `src/shared/ui/`、`src/resources/styles/primitives.css` |
| 全局颜色、字体、间距与主题 | `src/resources/`、`src/modules/appearance/` |
| 新增设置分类或功能页面 | 对应模块的 `module.tsx` 与 `public/`，以及 `src/app/composition.ts` |
| 数据保存、导入导出兼容 | `src/app/state/`、`src/contracts/`、`src/modules/data/` |
| 项目知识库 | `src/modules/knowledge/`；经 `requestContexts` 注册贡献，App 连接持久化和聊天控制器 |
| 后端 API、四协议、供应商存储 | `server/modules/`、`server/core/`；契约对齐见 `server/contracts/` 与 [后端计划](docs/BACKEND_PLAN.md) |

修改前阅读 [AGENTS.md](AGENTS.md) 和 [架构约定](docs/ARCHITECTURE.md)。保持原有存储键、DOM 契约和外部接口兼容；新增模块按归属注册功能，复用共享组件，并根据改动范围选择验证。

原 Clawbox 目录未因本次重构修改。重构前源码备份保存在项目父目录的 `v2.0-before-modular-refactor.tar.gz`，不属于应用运行所需文件。
