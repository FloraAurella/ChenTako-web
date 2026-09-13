# ChenTako-web 云端部署

## 入口与边界

- ChatGPT Sites：https://chentako-web.floraaurella.chatgpt.site，按新建站点默认仅所有者访问。
- GitHub Pages：https://floraaurella.github.io/ChenTako-web/，公开静态前端。
- API：https://chentako-api.chentako.workers.dev。健康检查 `/api/health` 免凭据；其余接口必须携带浏览器自动创建的 256 位随机凭据 `x-chentako-vault`。

API 只接受上述前端来源及开发来源。凭据的 SHA-256 决定独立的 Durable Object；每个对象拥有单独 SQLite，仅保存供应商及 AES-256-GCM 加密后的 Key。不上传本机 `server/.data`，不在云端保存聊天或项目资料。不使用共享管理员 Key、公开静态令牌或全局供应商表。每个凭据最多同时处理 4 个请求、每分钟 120 个请求。

浏览器凭据保存在 `chentako-cloud-credential-v1`。清除站点数据或换浏览器后会得到新的独立配置空间；请先用现有加密备份功能备份供应商及 Key。Sites 与 Pages 的浏览器存储相互独立。

Worker 请求上限 20 MiB（含 JSON 编码），超过时返回 413；全文上下文不截断。云端上游仅支持标准端口 HTTPS，拒绝内网、链路本地、私有 IPv6、映射 IPv4，以及重定向。四种协议与稳定应用 SSE 事件继续复用原后端；正文、摘要、标题仅使用 system/summary/title 文件。

## 部署

本机开发仍执行 `npm run dev:server` 与 `npm run dev`。Worker 本地验证使用 `npx wrangler dev`；本地 `.dev.vars` 只能使用测试密钥，已被 Git 忽略。

先运行提示词转换、架构、类型、单元测试及 Worker dry-run，再执行 `npx wrangler deploy`。首次发布后用 `wrangler secret put VAULT_MASTER_KEY` 配置随机 32 字节主密钥的 64 位 hex；已经有密钥时必须保留，切勿重复随机替换，否则无法解密已保存的 Key。主密钥不得写入源码、日志、仓库变量或前端。wrangler 配置声明 `new_sqlite_classes` 迁移，Cloudflare 自动管理每个对象的数据库。

Pages 工作流使用 Node 24，仓库变量 `CHENTAKO_API_BASE_URL` 为 Worker 根地址。Sites 构建也设置同一 `VITE_API_BASE_URL`；`.openai/hosting.json` 声明静态 `dist`，Sites 不运行另一份后端。Sites 发布使用对应源仓库及打包产物，保留既有 GitHub origin。

不要将 `.dev.vars`、`.wrangler/`、本地数据库、主密钥、构建产物或 Sites 写入凭据提交到仓库。

## 验证口径

模拟上游验证普通聊天、流式输出、标题、摘要、取消、扩展拒绝；实际 Worker 验证健康检查、跨域、凭据隔离和供应商 CRUD。没有使用本机真实供应商凭据或宣称真实模型生成已验证。用户在各线上站点的设置中配置自己的供应商后使用。
