## Review report: ai-chatbox 品牌与指令布局

**Overall score: 100/100 — Ship**
*Correctness of assessment: Medium (基于源码、单元测试与模拟接口浏览器验证；未验证外部 Electron 打包环境和真实模型)*

### Blockers (must fix)
None.

### Warnings (should fix)
None.

### Suggestions (optional)
None.

### Verdict
Ship：本轮范围内检查通过，旧数据和接口兼容已保留，新增指令按用户要求留待商议。

审查范围：A1–A10、B1–B10。输入和参数处理沿用现有规则；SVG 经过现有安全资源解析；异步和 Scope 释放保留；新 API 别名随原 API 释放。没有新增网络发送、依赖安装、删除用户资料、改写 Git 历史或提交凭据。工作区原有修改未回滚，生成文件与日志单独存放。新名称不用于替换已持久化的数据键和密钥派生材料。
