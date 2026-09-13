## Review report: ChenTako-web 暂停工作区

**Overall score: 100/100 — Ship**
*Correctness of assessment: High（验证本地装配、转换、模拟聊天请求与六种响应式组合；未调用真实模型）*

### Blockers (must fix)
None.

### Warnings (should fix)
None.

### Suggestions (optional)
None.

### Verdict
Ship。仅修改 ChenTako-web，原项目保留。

## 修改与验证

- App 在启动前排除 writing 模块，所有写作指令、状态、工作区、侧栏按钮、全文上下文和生成操作均不注册。
- 前端只导入 system，后端任务读取 summary/title；自动转换只处理这三个文件。四个写作提示词文件保留，不读取或转换。
- 旧对话 writing 字段保留，普通聊天请求不受旧 write 模式影响、不自动携带章节。
- 前后端架构、类型检查及生产构建通过；全量 60 个测试文件、507 / 507 项通过。
- e2e/chat-only.spec.js：6 / 6 通过，light/dark × 1280/1024/390；检查隐藏入口、指令菜单、拒绝停用指令且保留输入、左侧聊天回复、刷新、旧作品保留和页面无横向溢出。
- 模拟 system 提示词及网络请求，不读取作者提示词作为测试断言，不宣称真实模型效果通过。
- 初次类型及部分测试加载因作者 system.json 尚为纯文本而失败；按已授权本地脚本转换并保留原文备份后复验通过。脚本不改写提示词内容。
- 历史写作浏览器场景保留，当前暂停装配下不适用，本轮未运行或宣称全站浏览器全部通过；没有删除或跳过测试制造通过。
- 前端 5173 / 后端 3001 继续从新目录运行，代理健康检查正常。
