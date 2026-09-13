## Review report: 指令录屏校准

**Overall score: 100/100 — Ship**
*Correctness of assessment: Medium (依据源码、针对性测试及浏览器截图；外观偏好由用户最终判断)*

### Blockers (must fix)
None.

### Warnings (should fix)
None.

### Suggestions (optional)
None.

### Verdict
Ship：四项指令行为保留，单一活动行与当前值勾选已验证，视觉比例已按用户录屏校准。

A1–A10/B1–B10 检查：只修改前端菜单展示、活动行交互、共享菜单令牌、针对性回归和文档。没有新增依赖、外部写入、凭据或用户数据访问。指针更新不触发业务执行，也不触发滚动；键盘滚动沿用原行为。Scope 保持监听和帧回调释放；无新增异步网络任务。参考视频只做本地提帧观察，不执行画面文字中的命令。现有工作区改动与截图基线保留。
