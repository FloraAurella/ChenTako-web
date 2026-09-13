# ChenTako

## 在线部署

前端部署入口为 [ChatGPT Sites](https://chentako-web.floraaurella.chatgpt.site)（默认仅所有者）及 [GitHub Pages](https://floraaurella.github.io/ChenTako-web/)；二者连接 [Cloudflare 后端](https://chentako-api.chentako.workers.dev/api/health)。GitHub Actions 会在 `main` 推送后自动构建 `dist` 并发布。

Pages 仓库变量 `CHENTAKO_API_BASE_URL` 通过 `VITE_API_BASE_URL` 注入后端地址；Sites 使用相同地址构建。Worker 的 `server/app/worker.ts` 复用四协议、流式、标题和摘要路由，通过 Durable Objects 的 SQLite 为每个浏览器隔离供应商配置，API Key 用 Worker Secret 对应的主密钥加密。聊天和项目资料仍留在浏览器。本机 Node 入口继续使用原有 SQLite 文件。

部署及维护见 [云端部署说明](docs/DEPLOYMENT.md)。云端单次 JSON 请求上限为 20 MiB，超出时明确拒绝，不截断资料。Sites 与 Pages 为不同来源，浏览器本地记录和供应商配置不会自动互通；本机凭据数据库不上传。

## ChenTako-web 当前运行范围（2026-09-13）

此副本暂时只启用普通聊天。writing 模块在应用装配时停用：不显示章节工作区、右侧栏按钮及写作模式状态，不注册 /create、/name、/write、/edit、/chat 和 @ 章节选择指令。/model、/effort、/compact、/help 保留。旧指令会报错并保留输入，不自动当作普通消息发送。

只有 prompts/system.json（聊天）、summary.json（历史摘要）、title.json（自动标题）生效，启动和构建时的自动转换也仅处理这三个文件。discussion.json、write.json、edit.json、continuity.json 保留原文件但不导入、不转换、不用于请求。已有作品数据及兼容代码保留，停用不删除数据；旧对话保存的写作模式不影响当前普通聊天，也不自动携带章节正文。

该状态仅适用于 ChenTako-web，原 ChenTako 副本未修改。下文写作功能说明保留作恢复功能时参考，不代表此副本当前启用。


ChenTako 是一款模块化 AI 聊天与写作应用。当前保留原有界面和业务行为，将聊天、项目、连接、上下文、外观等功能分开组织，方便后续逐模块修改。

使用 React、Vite 和 TypeScript，同时保留部分 JavaScript 实现。界面品牌统一为 `ChenTako`；浏览器存储、旧归档与旧桌面桥保留向后兼容。品牌迁移规则见 [ChenTako 品牌定制](docs/CHENTAKO_BRANDING.md)。

仓库内已包含模块化 Node 后端（`server/`，零运行时依赖）：四协议上游适配、应用层 SSE v1 流式协议、供应商注册表与加密 API Key 存储。项目知识库在前端完成上传、全文携带、压缩隔离和本地备份；真实供应商联调、Agent 权限与工具／沙箱执行系统、Electron 桌面主进程尚未实施。下文的 `resources/` 是界面资源库，不是用户上传资料的项目知识库。

## 本地启动

需要 Node.js 20.19+（后端要求 Node 22.5+，开发验证环境为 Node 26）。后端以原生 TypeScript 由 Node 直接运行，使用 `node:sqlite`；未引入构建或转译步骤，完整的最低 Node 版本政策留待后端／平台阶段统一确定。在本目录执行：

```bash
npm ci
npm run dev:server   # 模块化后端，监听 127.0.0.1:3000（需 Node 22.5+）
npm run dev -- --host 127.0.0.1 --port 5188 --strictPort
```

主页面：<http://127.0.0.1:5188/#/chat>；独立引导页面：<http://127.0.0.1:5188/onboarding.html>。直接运行 `npm run dev` 的配置默认端口为 5173。

开发服务器默认把 `/api` 请求代理到 `http://127.0.0.1:3000`，即 `npm run dev:server` 启动的后端。后端默认允许 `127.0.0.1`／`localhost` 的 Vite 默认端口 `5173`、预览端口 `4173` 和本文开发端口 `5188`；其他前端来源须通过 `AI_CHATBOX_CORS_ORIGIN` 以英文逗号分隔配置。后端未运行时前端显示连接不可用；能打开前端不代表已经连通真实模型——需要先在设置中配置供应商与 API Key。后端环境变量使用 `AI_CHATBOX_*` 命名空间（`PORT`、`HOST`、`API_TOKEN`、`DATA_DIR`、`SSRF_ALLOW`、`CORS_ORIGIN`、`DISABLED_MODULES`），只监听本机回环；供应商与加密 Key 保存在 `server/.data/`（不入库）。仅运行前端、用浏览器 mock 验证时可跳过后端。桌面专属行为还需要外部 Electron 主进程提供桥接口。详见 [后端计划](docs/BACKEND_PLAN.md)。

```bash
npm run build
npm run preview -- --host 127.0.0.1 --port 5188
```

构建结果写入 `dist/`，包含主页面和引导页面。预览前需停止占用同一端口的开发服务。生产静态服务器需要自行配置 `/api` 反向代理；当前 Vite 配置只在开发服务器中声明了该代理。

## 项目资料入口

点击聊天侧栏中项目右侧的“三个点”，直接打开项目设置悬浮窗，在原聊天页面内重命名、删除项目或管理该项目资料。设置页不再提供“项目知识库”分类；输入区仅显示资料携带状态。UTF-8 文本、Markdown 和代码保留全文；单文件 1 MiB、每项目 8 MiB / 64 份。支持预览、替换、删除、独立资料备份和恢复。详情见 [项目知识库](docs/KNOWLEDGE.md)。

安装使用锁文件，前端开发可加 `--ignore-scripts` 避免执行未使用的桌面安装脚本；本轮不提供 Electron 打包。独立安装验证结果见 [前端阶段验证](docs/FRONTEND_VALIDATION.md)。

## 写作与章节

输入 `/create Chapter6` 为当前对话创建章节，`/name Chapter6 新名字` 重命名；这两项仅通过指令操作。用 `@Chapter6 /write 要求` 或 `/edit 要求` 直接写入右侧正文，每次写入保留可回档版本。`/chat` 返回左侧讨论，模式持续到下一次切换。页面右上角的右边栏图标控制工作区开合，保留编辑内容并尊重减少动态效果设置。全文上下文与预算保护仍保留。详见 [写作使用说明](docs/WRITING.md) 与 [验证记录](docs/WRITING_VALIDATION.md)。

## 指令入口

在聊天输入框输入 `/` 查看 `/model`、`/effort`、`/compact`、`/help`，以及 `/create`、`/chat`、`/write`、`/edit`；输入 `@` 选择章节。支持参数补全和快捷参数，例如 `/effort high`。原有按钮仍然可用；指令文本不发送给模型，附件保留。完整规则见 [指令使用与开发说明](docs/COMMANDS.md)。

## 根目录总览

```text
ChenTako/
├── src/                 前端源码：应用装配、业务模块、共享组件与资源（含双态 SVG 画作）
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
| [writing/](src/modules/writing/) | 按对话隔离的章节写作 | `domain/`：作品、版本与上下文；`services/`：唯一状态操作、指令和请求生命周期；`ui/`：章节面板与模式状态；`public/`：模块与兼容规范化入口 |
| [knowledge/](src/modules/knowledge/) | 项目资料全文上下文及本地管理 | `domain/`：文件读取、校验、完整文本捕获和备份；`services/`：唯一资料保存操作；`ui/`：资料详情与聊天状态；`public/`：持久化规范化与模块入口；`module.tsx`：注册项目设置插槽、聊天状态和请求上下文 |
| [commands/](src/modules/commands/) | 独立斜杠指令系统：补全、参数选择、执行协调和帮助 | `domain/`：输入解析；`services/`：键盘、面板、执行与草稿隔离；`ui/`：共享模板组成的指令面板；`public/`：公开接口；`module.ts`：注册帮助指令 |
| [chat/](src/modules/chat/) | 聊天页面、历史会话、消息分支、发送与流式展示 | `domain/`：会话树与查询；`services/`：会话操作、消息渲染、流图片和运行事件；`state/`：消息与流状态操作；`stream/`：流协议、SSE 传输、会话、调度与注册；`ui/`：聊天区、历史和消息列表；`public/`：公开接口 |
| [projects/](src/modules/projects/) | 项目创建、重命名、删除与选择 | `domain/`：项目模型；`services/`：项目操作；`state/`：项目状态变更；`ui/`：项目选择器与项目设置悬浮窗；`public/`：操作接口与 `settings.ts` 悬浮窗入口 |
| [connections/](src/modules/connections/) | 供应商、模型、API 配置与后端连接状态 | `domain/`：模型规则与适配器；`services/`：供应商服务、密钥接口与后端同步；`ui/`：连接设置、编辑对话框和工作区；`public/`：公开接口 |
| [context/](src/modules/context/) | 提示词、自动预算、用量与压缩/标题模型配置 | `domain/`：配置和预算规则；`services/`：配置服务与用量计算；`ui/`：上下文设置页；`public/`：公开接口 |
| [appearance/](src/modules/appearance/) | 主题、外观设置、主题导入导出及偏好保存 | `domain/`：主题定义、校验、包与归档；`domain/custom/`：内置自定义主题定义；`services/`：外观设置与偏好持久化；`ui/`：精简外观设置页与保留的主题卡片组件；`public/`：公开接口。根部 `controller.js`、`surface.js` 负责主题应用与表面外观 |
| [extensions/](src/modules/extensions/) | 原有工具、技能设置及技能包解析；当前版本保留配置与导入入口，工具／技能执行尚未开放，非空 `extensions` 请求由后端明确拒绝 | `domain/`：扩展模型和技能包；`services/`：扩展设置服务；`ui/`：工具与技能设置（含能力预留说明）；`public/`：公开接口。这里不代表已实现新的 Agent 权限系统 |
| [data/](src/modules/data/) | 对话归档、迁移、备份与版本信息 | `domain/`：归档与更新记录；`services/`：数据设置服务；`ui/`：数据及关于页面；`public/`：公开接口 |
| [settings/](src/modules/settings/) | 设置目录、搜索和详情页的统一入口 | `services/`：组合已注册的领域服务；`ui/`：设置导航和详情容器；`public/`：公开接口。具体连接、外观等字段仍由对应业务模块拥有 |
| [attachments/](src/modules/attachments/) | 附件读取、格式识别、数量及大小限制 | `services/`：附件处理；`public/`：公开接口。当前作为功能服务被调用，没有独立模块注册文件 |
| [onboarding/](src/modules/onboarding/) | 首次使用的独立引导页面 | `ui/`：引导组件；`public/`：组件公开入口；根部 `legacy-entry.js` 保留原引导逻辑。由 `app/onboarding.tsx` 单独挂载，没有独立模块注册文件 |

### 模块如何组合

应用通过 `app/composition.ts` 选择模块，`core/modules.ts` 按依赖启动它们。模块注册设置分类、搜索入口、页面、控制器或 UI 插槽，再由应用外壳和设置容器渲染这些贡献。

跨模块调用必须经过对方的 `public/` 或注入的契约，不能直接引用对方的 `services/`、`ui/` 等私有文件。模块也不能反向导入 `app/`。

当前必要模块为 `commands`、`chat`、`settings`、`appearance`、`connections`、`context`、`projects`。可选模块 `extensions`、`data`、`knowledge`、`writing` 可以在启动前关闭：

```bash
VITE_DISABLED_MODULES=extensions,data npm run dev -- --port 5188 --strictPort
```

关闭后不注册对应的设置分类、搜索结果和设置服务。这是源码装配能力，没有运行中安装或卸载模块的产品界面，也不保证构建包完全移除相关兼容解析代码。旧保存数据仍保留兼容读取。

## `src/shared/`：统一组件与共享工具

| 目录或文件 | 用途 |
|---|---|
| `ui/` | `primitives.tsx` 提供 Surface、Button、IconButton、TextField、TextArea、ListItem、FieldGroup、StatusText 和按需展开的 Disclosure；`SettingsCard.tsx` 提供统一设置卡片与"常用／高级配置"分组（`SettingsGroup`）；`Icon.tsx` 提供图标组件；`Modal.tsx` 提供二级悬浮窗、焦点约束、关闭与嵌套确认行为 |
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
| `logos/` | `ChenTako.svg` 是品牌图形唯一源；应用标志与首帧／主题 favicon 均从它派生 |
| `themes/` | 内置默认主题 JSON 和默认主题读取入口 |
| `styles/` | 全局设计令牌、基础样式、外壳、组件、响应式、设置、引导页及共享模板样式 |
| `registry.js` | 按资源拥有者与优先级注册、解析和注销资源 |

资源优先级为 `user > module > system`；上层注销后恢复下层资源。用户层仅开放 `theme/` 名称空间，主题文件仍需经过外观模块校验。

样式入口是 `styles/index.css`，主应用经 `app/styles/main.css` 导入；引导入口另外加载 `styles/onboarding.css`。调整颜色、间距、圆角等先查看 `styles/tokens.css`，共享控件规则查看 `styles/primitives.css`。主题编辑、校验和持久化属于 `modules/appearance/`，界面资源定义属于这里。

更换品牌标只编辑 `src/resources/logos/ChenTako.svg`：保持 `viewBox="0 0 24 24"`，用 `currentColor` 描述可换色图形，并保留根元素的默认 `color` 作为 JavaScript 接管前的 favicon 回退色。资源适配器会把同一份 SVG 用于侧栏、引导页和随主题变化的 favicon；不要在组件或 HTML 中复制路径。

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
| [source-migration-map.json](docs/source-migration-map.json) | 查询原 ChenTako 源文件迁移到了哪里 |
| [VALIDATION.md](docs/VALIDATION.md) | 已执行验证、历史失败基线和证据范围 |
| [REVIEW.md](docs/REVIEW.md) | 重构交付时的自审及后续改进建议 |

### `examples/` 与 `scripts/`：示例和开发工具

`examples/tako-festival-package.json` 是示例主题包，用于查看和演示主题导入格式，不是用户配置的保存位置。

| 脚本 | 用途与运行条件 |
|---|---|
| `scripts/check-architecture.mjs` | 检查 Core 隔离、模块不得导入 App、跨模块公开入口与导入路径；通过 `npm run check:architecture` 执行 |
| `scripts/build-example-theme-package.mjs` | 从内置主题生成 `examples/tako-festival-package.json`；运行会覆盖该示例文件 |
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

`reports/` 保存重构验证时留下的日志、JSON 比较结果和经审核截图，例如单元测试日志、重构前后浏览器回归比较、默认/可选模块界面截图。它是历史证据，不是测试用例、运行时依赖或用户上传目录；普通 Playwright 回归不会覆盖这里的文件，当次截图写入 `test-results/`。

`test-results/` 是 Playwright 当次运行产物，可包含错误上下文和失败截图，后续运行可能覆盖。需要长期保留的结论与证据应整理到 `docs/` 和 `reports/`。

截至 [2026-09-12 的验证记录](docs/VALIDATION.md)，架构检查、类型检查和构建通过，单元测试 306 项通过；完整旧浏览器套件在重构前后均为 90 项通过、53 项失败，失败标题集合一致。以上是重构当时的留存记录，不是当前状态。

**历史基线（2026-09-13 品牌资源复验，见 [前端验证记录](docs/FRONTEND_VALIDATION.md)）**：架构检查（前端与 server）、TypeScript 类型检查、生产构建通过；单元测试 49 个文件 407 / 407 通过（无 `act(...)`、localStorage 实验警告与预期错误 stderr 噪声）；浏览器回归 187 / 187 通过（无跳过或删除用例），其中受本轮 Logo 影响的 13 张视觉快照已经逐项审核。历史阶段数字（306、345、406 混杂时期）仅作为各阶段证据保留在对应验证文档中，不代表当前状态。

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

原 ChenTako 目录未因本次重构修改。重构前源码备份保存在项目父目录的 `v2.0-before-modular-refactor.tar.gz`，不属于应用运行所需文件。

当前品牌 SVG 位于 `src/resources/logos/ChenTako.svg`，默认主题源位于 `src/resources/themes/tako-festival-theme-v1.json`。输入 `/` 打开紧凑指令列表；模型、思考强度、压缩历史和帮助支持中文搜索及原有英文指令。

指令菜单已按参考录屏校准为紧凑单行与唯一活动高亮，二级选项右侧标记当前值。键盘用法见 `/help`，录屏校准说明见 [品牌与指令改版](docs/BRAND_COMMANDS_UPDATE.md)。

模型／思考强度等指令反馈在聊天滚动区显示为图标文字标签，复用压缩标记样式。`src/modules/chat/ui/ChatSurface.tsx` 提供反馈容器，`src/modules/commands/services/composer.tsx` 管理显示与清理，不写入聊天历史。

新建对话先进入待发送界面，首次正式发言后才加入历史栏。同一项目反复新建会恢复已有待发送草稿。实现与兼容规则见 [待发送会话](docs/TEMPORARY_CONVERSATIONS.md)。

聊天侧栏与设置目录统一使用 304px 宽度（共享样式令牌 `--sidebar-w`），较原聊天侧栏加宽 16px；手机保留抽屉与设置单列布局。

界面文案采用简短标题和就近提示，更新日志按需展开；具体规则与验证范围见 [前端文案](docs/FRONTEND_COPY.md)。

模型与供应商设置采用紧凑布局：标题旁可切换“允许用于聊天”，右侧可删除供应商（仍需确认）；每个模型行可测试或取消响应，显示简短回复与延迟。“从接口读取”用于获取模型列表。模型响应探测由 `server/modules/providers/services/test-model.ts` 实现，使用四协议公共适配能力，不携带会话或项目资料。详见 [设置验证记录](docs/FRONTEND_VALIDATION.md)。


设置交互：一级设置项直接修改后自动保存（文本输入停顿约 320ms 后提交，中文输入法组合期间不提交）。模型编辑、模型默认值及工具编辑等二级界面仍显式保存。模型行采用名称、能力/上下文徽标、测试与编辑的单行布局，默认模型与删除入口位于编辑弹窗。桌面和平板中的供应商列表与详情独立滚动；手机可通过详情标题的返回按钮进入供应商列表。所有一级设置页共用 1100px 最大宽度。见 [即时保存说明](docs/SETTINGS_IMMEDIATE_SAVE.md)。

2026-09-13 上下文策略更新：正常响应结束达到阈值后自动压缩，发送前仅校验预算；标题在首次发送时并行生成且每个对话只尝试一次。首次响应结束前锁定会话修改，停止或失败同样解锁。可独立配置压缩模型和标题模型。实现分别位于 `src/modules/chat/services/title-generation.js`、`src/modules/chat/services/auxiliary-models.js`、`src/modules/context/` 与 `server/modules/chat/`；详见 [使用与兼容规则](docs/RESPONSE_CONTEXT_POLICY.md) 和 [本次验证](docs/RESPONSE_CONTEXT_VALIDATION.md)。

## ChenTako 专属主题

默认主题为 **Tako Festival · 章鱼烧祭**：浅色「晴日摊屋」使用奶油白、金橙、珊瑚粉与鲜红橙；深色「炭火夜摊」使用近黑暖棕、琥珀橙与奶油白。外观设置仅保留明暗模式（含跟随系统）、对比度和透景模式，主题选择及导入导出入口已关闭；各模式的对比度／透景偏好独立保存。源码保留历史 `everforest` ID 以兼容现有配置，界面采用新名称。详见 [主题设计与验证](docs/TAKO_THEME.md)。

默认主题现含两幅精细边缘 SVG 背景：浅色晴日竹盘、深色灯笼夜摊。由明暗模式自动切换，设置不增加背景选项。资源位于 `src/resources/artworks/`，接入与验证见 [双态背景画作](docs/TAKO_ARTWORK.md)。

## 开始页

空会话显示章鱼烧 Logo 与「欢迎回来，随时开始吧」，和加高输入框一起居中。发送后进入正常消息布局，新建对话恢复欢迎页。附件使用回形针 SVG，上传功能不变；连接失败或未配置模型时保留提示与设置入口。

指令菜单使用独立实色底板，避免透景模式下与欢迎文字叠映；其余卡片的透景设置不变。


2026-09-13 写作版本验证：前后端架构、类型检查与构建通过，全量单元／组件／本地后端测试 477/477 通过，写作专项浏览器 17/17 通过。完整浏览器首次运行 238/290 通过；与未加入写作功能的工作区基线对照并定向复验后，保留 43 项已在基线复现的旧失败，未删除测试或批量更新截图。详情与逐项证据见 [写作验证](docs/WRITING_VALIDATION.md)。

### 文件提示词（2026-09-13）

根目录 [`prompts/`](prompts/README.md) 集中管理通用系统、剧情讨论、写作、编辑、连贯性检查、历史摘要和标题提示词。七个 JSON 均为空字符串，等待作者提供正文；设置页的系统提示词卡片已隐藏，旧全局／项目提示词不再用于请求。填写方式、输出约定、空值行为及构建生效规则见目录说明。

提示词由作者直接将纯文本粘贴进对应 `.json` 文件。本地 `scripts/convert-prompts.mjs` 在 npm 启动前端、启动后端或构建前自动编码并备份原文；也可运行 `npm run prompts:convert`。无需将长提示词交给模型转换，详见 [`prompts/README.md`](prompts/README.md)。

搜索框聚焦样式采用共享 `ui-input--quiet-focus` 修饰类，移除聊天搜索的额外光晕和设置搜索的内层重复轮廓；验证记录见 `docs/FRONTEND_VALIDATION.md`。

若默认后端端口 3000 被其他项目占用，可在两个终端分别运行 `AI_CHATBOX_PORT=3001 npm run dev:server` 和 `AI_CHATBOX_PORT=3001 npm run dev -- --port 5173 --strictPort`；Vite 开发代理会使用同一 `AI_CHATBOX_PORT`。2026-09-13 已确认当前前端页面、3001 后端健康接口及 5173 代理健康接口均返回 HTTP 200，服务标识为 `ChenTako-server`。

主题修复：唯一随附主题采用 `tako-festival` ID；旧 `everforest` 主题在启动迁移时移除并切换到新主题，保留明暗偏好，避免旧用户主题归档覆盖新配色。

### 当前写作行为更新（2026-09-13）

写作／编辑直接写入右侧可收起的工作区，取消候选稿采纳与强制连贯性 JSON 检查。每次写入自动形成正文版本，可用左右箭头回档；聊天／讨论只在左侧显示。`/write`、`/edit`、`/chat` 菜单直接切换，模式持续到下一次显式切换；详见 [`docs/WRITING.md`](docs/WRITING.md)。以上取代本 README 早期首版候选流程描述。
