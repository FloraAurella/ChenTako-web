# 模块化后端计划（server/）

用户 2026-09-12 明确指令：为本仓库构建模块化后端。本文记录已批准的计划与实施决策。

## 决策

- **位置／形态**：本仓库 `server/` 目录，零运行时依赖（`node:http` + `node:sqlite`，Node 26 自带），TypeScript 由 node 直接运行（type stripping），测试并入现有 vitest。
- **一期范围**：核心闭环——前端已有的全部 7 个 `/api` 端点 + 四协议适配 + SSE v1 应用流协议 + 密钥存储。`extensions` 字段接受并校验，但工具／技能／沙箱／代码解释器**执行**明确返回不支持（属暂缓的 Agent 执行系统）。
- **安全基线**（与原版一致）：只监听 `127.0.0.1:3000`（匹配现有 vite 代理目标）；可选 `API_TOKEN` 环境变量，时序安全比对（对应前端 `x-ai-chatbox-token`（兼容旧认证头） 桥头）；API 密钥 AES-256-GCM 加密落盘 SQLite，数据目录 0700。
- **数据边界**：providers + API 密钥是唯一服务端持久化数据；会话／项目资料继续留在浏览器存储。

## 契约权威来源

前端代码就是后端必须对齐的契约：`src/shared/api.js`、`src/modules/connections/services/{backend-sync,provider-service}.ts`、`src/modules/chat/controller.js`、`src/modules/chat/stream/{protocol,session,sse-transport}.ts`、`src/contracts/constants.js`。参考实现：原版 `../clawbox/backend/`（协议行为权威参照）、`../v2.0-1/server/`（零依赖底座参照）。

七个端点：`GET /api/health`、`GET/PUT /api/providers`、`DELETE /api/providers/:id`、`GET/PUT/DELETE /api/providers/key`、`POST /api/providers/test`、`POST /api/chat`（SSE v1 或 `stream:false` JSON）、`POST /api/chat/compress`。

## 目录结构（镜像前端模块规范）

```
server/
  core/          模块运行时（清单/依赖排序/失败逆序回滚）、有属主注册表、事件总线、
                 Node 版 Scope、路由注册表、body 限额读取、SSE 写出器
  contracts/     LIMITS/协议名/思考强度/SSE v1 事件镜像前端；contributions 契约
  modules/
    gateway/     node:http 监听（仅回环）、Origin 校验、可选令牌、路由分发、404/405、CORS
    upstream/    四协议适配：请求构造、思考强度映射、SSRF 防护、流累积与投影、
                 非流式归一化、模型列表
    providers/   注册表 CRUD + AES 密钥保险库 + providers/key/test 端点
    chat/        /api/chat 编排与 /api/chat/compress
  app/           环境配置（AI_CHATBOX_* 命名空间）与组合装配
```

模块布局沿用前端约定：`domain/`（纯规则）、`services/`（I/O）、`public/`（按职责的小入口）。跨模块访问只经 `public/`；core 不依赖业务；`scripts/check-architecture-server.mjs` 强制同一套边界。

## 防漂移措施

`test/server/contracts-sync.test.ts` 直接导入 `src/contracts/` 与 `src/modules/chat/stream/protocol.ts` 的前端真实常量做全等断言；chat 集成测试用前端 `consumeAppStreamFrame` 状态机验收后端流。

## 验证方案

1. 单元测试（vitest node 环境）：四协议请求构造与思考强度映射、响应归一化、跨分片 SSE（含 UTF-8 字符边界）、注册表规则、密钥加解密。
2. 集成测试：临时端口启动真实组合后端 + 测试内 mock 上游（node:http），覆盖 providers CRUD/key、chat SSE 顺序、取消传播、上游错误转发、超限 body。
3. 真实供应商联调不在本轮：等待用户提供临时凭据并明确要求；模拟测试不宣称真实连通。
4. 明确不做：Electron 主进程、会话服务端存储、Agent 执行系统。

## 实施阶段（build 顺序按依赖调整为 upstream 先于 providers）

1. `22db683` server/core + contracts + gateway + 架构检查 + 单元测试
2. `5c9155c` upstream 四协议适配器 + fixture 测试
3. `aea3266` providers 模块（SQLite/AES 保险库/端点）+ 集成测试
4. `416adf1` chat 模块（SSE v1 + compress）+ 断连/错误集成测试
5. 文档同步 + 完整验证记录（本文与 [后端验证](BACKEND_VALIDATION.md)）

## 2026-09-13 响应后任务更新

后端已新增 POST /api/chat/title，经既有四协议公共适配生成标题；与 compress 共用辅助请求校验、取消及窗口检查，不新增会话持久化。 规则与兼容性详见 [响应上下文策略](RESPONSE_CONTEXT_POLICY.md)，验证见 [本次验证记录](RESPONSE_CONTEXT_VALIDATION.md)。


## 2026-09-13：写作请求兼容增量

写作检查与正式生成复用 `/api/chat`，不增加 Agent 执行或服务端作品持久化。非流式 JSON 响应额外返回上游公共协议服务提供的 `finishReason`，以区分正常完成与输出额度／内容过滤中断。请求级 systemPrompt 可包含设置提示词与全文固定资料，其限额改用前后端同步的 `LIMITS.requestSystemPromptChars = 16 * 1024 * 1024`；用户设置字段自身仍保留原有 102400 字符限制。请求模型预算仍独立校验，不静默截断资料。测试使用本地模拟上游，不能代表真实模型写作质量。
