# 后端阶段验证：模块化 server/

日期：2026-09-12。对应计划见 [后端计划](BACKEND_PLAN.md)。本记录为阶段交付，不宣称真实模型或后端联调。

## 完成范围

- `server/core/`：模块运行时（拓扑排序、循环检测、失败逆序回滚、可重复释放）、有属主注册表、事件总线、Node 版 Scope（defer／定时器／AbortController 跟随释放）、路由注册表、JSON body 限额读取、应用层 SSE 写出器（背压处理、头保护）。
- `server/contracts/`：线上协议契约镜像前端（LIMITS、四协议名、思考强度档位、SSE v1 事件名与版本）及后端 contributions 契约（routes／services／只读 config）。
- `gateway` 模块：仅监听本机回环；Origin 白名单（vite 开发端口默认放行）、可选 `CLAWBOX_API_TOKEN` 时序安全比对（health 豁免）、CORS 预检、404／405（含 Allow）、统一错误映射。
- `upstream` 模块：四协议（responses／anthropic／openai-compatible／google）请求构造（system 与压缩摘要按协议组合、附件按协议成块、不支持组合记入 skippedFiles）、思考强度映射（含 deepseek-reasoner／gemini-2.0 例外与 anthropic 预算收敛）、SSRF 防护（回环／内网阻断 + `CLAWBOX_SSRF_ALLOW` 白名单）、任意分片与 UTF-8 字符边界安全的 SSE 解析、四协议累积器与 chat.* 投影器（用量去重、google 累计文本转增量）、非流式归一化、模型列表。
- `providers` 模块：node:sqlite 注册表（保持插入顺序）+ AES-256-GCM 密钥保险库（主密钥取 `CLAWBOX_MASTER_KEY` 或数据目录 `.master-key` 0600）；providers CRUD、key 保存／回显（no-store）／删除、连接测试（15 秒超时、上游状态码转发、回环免 Key）；key 路由先于 `:id` 注册。
- `chat` 模块：`POST /api/chat`（chatConfig v1 解析、注册表匹配 404／409、预算冲突 400、流式 SSE v1、非流式归一化 JSON、客户端断连中止上游、流中错误经 `chat.stream.error` 收尾）与 `POST /api/chat/compress`（固定内置压缩指令，无产品人格，摘要 2MB 上限）。
- `extensions` 一期只接受空声明；非空声明返回 400 `EXTENSIONS_UNSUPPORTED`，不静默忽略。

## 验证结果

| 检查 | 结果与证据 |
|---|---|
| 架构检查（前端 + 后端） | 双双通过，见 reports/backend-verification.log |
| 类型检查 | 前端（tsconfig.json）与 server（tsconfig.server.json）均通过；前端检查范围已排除 test/server |
| 全部单元／集成测试 | 49 文件、406 / 406 通过（其中后端 59 条：core 5、契约同步 4、gateway 7、upstream 21、providers 15、chat 6 等，详见 `npx vitest run test/server`） |
| 真实入口冒烟 | `node server/app/main.ts` 启动于 127.0.0.1:3199，health 返回 `{"ok":true,"service":"clawbox-server"}`，未知接口 404 |
| 契约防漂移 | 测试直接导入 `src/contracts/constants.js` 与 `src/modules/chat/stream/protocol.ts` 做全等断言 |
| 流协议验收 | chat 集成测试用前端 `consumeAppStreamFrame` 状态机解码后端 SSE：started 首帧且仅一次、事件顺序、usage 去重、终态之后无事件均由前端状态机保证 |
| 取消与中断 | 客户端 abort 传播到上游连接（mock 上游收到 close）；上游中途断开以 `chat.stream.error` 事件收尾不悬挂 |

后端测试通过临时端口启动真实组合后端 + 测试内 mock 上游（node:http）验证 HTTP 层行为，无任何真实网络调用。未验证 Node 20.19 的更低版本运行（开发环境 Node 26.5.0）；`node:sqlite` 与 type stripping 需 Node 22.5+/23.6+，README 的引擎声明待后续按需调整。

## 尚未完成

- 真实供应商联调：等待用户提供临时凭据并明确要求；当前全部为模拟上游验证，不证明真实四协议上游接受完整请求。
- Electron 主进程与打包（后端经 `utilityProcess` 集成的桌面形态）。
- 会话／项目资料的服务端存储（按规范明确不做）。
- 工具／技能／沙箱／代码解释器执行（Agent 执行系统，等待用户后续指令）。
