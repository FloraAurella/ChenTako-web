# ChenTako 品牌定制

后续第二步已将默认主题源替换为 `src/resources/themes/tako-festival-theme-v1.json`，详见 [主题设计与验证](TAKO_THEME.md)。下文保留第一步完成时的记录。

2026-09-13。用户要求把产品 ai-chatbox 更名为 ChenTako，并确认 Logo 使用「简洁单色章鱼烧（适配当前主题）」。

## 完成范围

- 页面标题、描述、无 JavaScript 提示、侧栏、引导页、设置、聊天空状态、日志和新下载文件名统一为 ChenTako。
- npm 包名为 `chentako`（遵守 npm 小写约定），版本维持 1.1.5，锁文件同步。
- 新会话下载后缀为 `.ChenTako.zip`，主题文件名为 `ChenTako-<id>.json`，旧设置下载为 `ChenTako-legacy-settings.json`。
- 后端启动日志及健康检查服务名为 `ChenTako-server`；健康状态 `ok` 契约不变。
- 默认主题文件为 `src/resources/themes/everforest-ChenTako-theme-v1.json`，导入入口、构建脚本和测试引用同步。

## 图形与模块边界

唯一品牌图形源为 `src/resources/logos/ChenTako.svg`。24×24 透明 SVG，以圆润丸子轮廓、滴落酱汁及少量海苔表现章鱼烧，圆角描线与单色填充使用 `currentColor`。原有主题令牌负责浅深主题配色；不增加业务组件私有路径，不放宽 SVG 安全校验。

`resources/logos/shapes.js` 经资源注册表提供图形；应用侧栏、首次启动与首帧／动态 favicon 共用该图形。已存储的 `paper-pen` ID 继续有效。仓库原有 `icon.png` 仅作造型参考，未修改。未修改 Electron 主进程、IPC、部署配置、按钮布局或用户资料。

## 兼容保留

更名不重写既有数据协议。以下旧字符串有意保留：

| 类别 | 保留内容及原因 |
| --- | --- |
| 会话、主题协议 | `ai-chatbox-conversation`、`ai-chatbox-theme`、`ai-chatbox-theme-package`，保证旧版本和新版本继续读写相同格式 |
| 本机数据 | 既有浏览器存储键、清理前缀、加密派生常量、归档格式；不搬移或重置用户数据 |
| 桌面与主题接口 | `window["ai-chatbox"]`、`AiChatboxThemeAPI`、`ai-chatbox:themechange`，以及更早兼容别名 |
| 后端部署接口 | `AI_CHATBOX_*` 环境变量、`x-ai-chatbox-token` 认证头；不要求现有调用方重配 |
| 历史证据 | 旧报告、历史路径与历史验证说明不改写为新执行记录 |

因此旧字符串检索不会归零；当前产品展示、新下载名称和品牌资源已更名。旧 ZIP 的读取不依赖下载文件名，内部格式保持不变。

## 验证记录

- `npm run typecheck`：通过。
- `npm run build`：通过，两个入口共用 ChenTako 哈希 SVG 资产。
- `npm run check:architecture` / `npm run check:architecture:server`：通过。
- `npm test -- --reporter=dot`：53 个文件、450 项测试通过。覆盖归档往返、主题格式与安全、存储失败、服务端契约等。
- 品牌浏览器回归：浅深主题 × 1280／1024／390；检查聊天、关于、数据、外观、首次启动共 30 个页面组合。验证标题、旧展示文字缺席、无横向溢出、无页面异常及引导页禁用状态。
- 另运行既有引导、外壳空状态、主题切换及侧栏按钮回归 4 项。最终结果见本轮报告目录。
- 修订旧测试中的产品文案、导出文件名、SVG 路径及图形描述，依据为本次明确的品牌需求；保留原协议断言、安全检查和所有历史截图基线。
- 初轮新增浏览器测试误用了不存在的 `#root`，修正为实际 `.app-shell` 后通过；这是测试定位问题。截图采用减少动态效果，避免记录入场动画中的半透明帧。

浏览器验证使用模拟离线后端；不代表真实模型连通或 Electron 打包验证。本次未执行整个历史浏览器套件。截图与日志位于 `reports/chentako-brand-2026-09-13/`。
