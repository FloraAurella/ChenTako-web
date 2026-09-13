## Review report: 作者填写原文，本地脚本自动转换

**Overall score: 100/100 — Ship**
*Correctness of assessment: High（范围限于本地转换、npm 前置步骤与构建；不涉及模型生成效果。）*

### Blockers (must fix)
None.

### Warnings (should fix)
None.

### Suggestions (optional)
None.

### Verdict
Ship：作者直接填写文件，脚本本地转换并备份，启动／构建自动执行，无需经由模型处理长提示词。

意图与影响面：只修改指定七个提示词文件的编码格式，以及 npm 启动／构建的前置步骤。A1–A10 检查涵盖长文本精确保留、重复执行、JSON 字符串歧义及显式原文选项、UTF-8 校验、备份失败、文件类型、临时文件清理和错误退出。B1–B10 检查确认转换前备份原字节、固定文件名范围、日志不输出正文；未调用模型、外部服务、提权或执行破坏性 Git 操作。

2026-09-13 验证：`npm test -- test/convert-prompts.test.js` 10/10 通过；包括数 MB 文本及中文／换行／引号／反斜杠／代码块往返一致、空文件、JSON 对象全文、重复转换、强制原文、无效 UTF-8、缺失文件、符号链接和备份失败。`npm run build` 实际执行 prebuild 转换并成功构建 219 个模块；`git diff --check` 通过。本次局部脚本改动未重跑全量单元及浏览器套件，上一轮结果不作为本次新增脚本的验证。
