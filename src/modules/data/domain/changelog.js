"use strict";

import { APP_SETTINGS_VERSION, APP_VERSION } from "../../../contracts/constants.js";

/** 更新日志数据源（设置页时间线）。 */

export const CURRENT_RELEASE = {
  version: APP_VERSION,
  displayVersion: APP_SETTINGS_VERSION,
  isPatch: true,
  date: "2026-09-06",
  title: "v1.1.5：移动端网页适配",
  summary: "这一版让 ChenTako 可以直接在手机浏览器中使用：补齐移动端布局与触控目标，修复窄屏下会话抽屉的交互闭环，核心功能（对话、供应商配置、设置管理）全部可用。",
  changes: [
    { tag: "ui", text: "移动端浏览器完整可用：底部主导航切换对话与设置，设置详情以推入式全屏呈现并自带返回，窄屏下无横向溢出。" },
    { tag: "fix", text: "修复移动端会话抽屉在新建对话或选择对话后不关闭的问题：窄屏下抽屉作为覆盖层，会话激活后自动收起回到对话。" },
    { tag: "runtime", text: "模型与思考强度运行菜单、建议提示、消息操作在窄屏下保持可达，触控目标不小于 44px。" },
    { tag: "theme", text: "明暗双态与主题卡在移动端正常切换与展示，透景与对比度设置即时生效。" },
    { tag: "core", text: "桌面端布局不受影响：断点 1040（抽屉覆盖）与 720（移动端导航）行为保持不变，单元与端到端测试全绿。" }
  ]
};

/** 历史版本按新到旧排列，当前版本单独由 CURRENT_RELEASE 展示。 */
export const RELEASE_NOTES = [
  {
    version: "1.1.1",
    date: "2026-09-06",
    title: "v1.1.1：设置体验与主题更新",
    summary: "收敛了设置页的视觉与交互语言：主题预览更直观，思考强度色彩更清晰，重复操作入口减少，常用配置更容易找到。",
    changes: [
      { tag: "settings", text: "设置统一为分类导航与分组卡片，新增搜索、上下文与提示词、项目逐项继承、独立模型兼容性和旧配置备份。" },
      { tag: "context", text: "提示词与生成行为从供应商配置中拆出，支持输入预算与可选自动压缩，不再按固定轮数保留历史；旧行为统一恢复默认，原配置仅保留备份。" },
      { tag: "theme", text: "重构主题选择为横向主题卡：用微型聊天界面预览真实呈现主题，并同时展示常规思考与 Max 两种强度色彩。" },
      { tag: "theme", text: "完善 Everforest 明暗双态、纯色画布、对比度与透景模式，并支持主题 JSON 的导入、导出和自定义主题管理。" },
      { tag: "runtime", text: "将模型、上下文与五档思考强度收拢到运行配置，支持从 Low 到 Max 快速切换，在发送前即可确认当前配置。" },
      { tag: "file", text: "完善图片和常用文档附件处理，支持在对话中附加 PDF、Word、PowerPoint 与表格文件，并优化生成图片和预览状态的呈现。" },
      { tag: "ui", text: "重新整理设置、供应商、工具与 Skill 管理界面的信息层级，移除重复操作入口，统一保存栏、控件尺寸和移动端布局。" },
      { tag: "core", text: "继续加固 IndexedDB 与 localStorage 双轨保存、主题归档和数据迁移流程，重要失败会在当前操作区域明确提示。" }
    ]
  },
  {
    version: "1.0.0-exp-2",
    date: "2026-08-28",
    title: "v1.0.0-exp-2：本地保存链路加固",
    summary: "修复个别环境下设置（供应商、工具、Skill）保存后丢失的问题：本地存储配额被历史项目残留占满或 IndexedDB 异常时，保存不再静默失效，并具备自愈能力。",
    changes: [
      { tag: "fix", text: "localStorage 写入失败（配额耗尽）时自动清理早期原型项目的遗留数据并重试，释放被挤占的存储空间。" },
      { tag: "fix", text: "IndexedDB 打开超时或被阻塞不再拖垮保存队列；所有持久化失败都会给出可见提示，不再静默丢失。" },
      { tag: "fix", text: "历史会话数据异常（循环引用等）不会中断备份通道，配置仍可落盘并在重启后恢复。" },
      { tag: "fix", text: "关闭全局浮动通知；错误改为在当前聊天或设置区域直接显示红色文字，工具表单错误继续就近显示。" }
    ]
  },
  {
    version: "1.0.0-exp",
    date: "2026-08-28",
    title: "v1.0.0-exp：ChenTako 首个实验版本",
    summary: "首个实验版本，聚焦桌面端 AI 对话、真实供应商接入与主题体验。",
    changes: [
      { tag: "about", text: "基于模块化前端完成 ChenTako 的首次客制化开发。" },
      { tag: "theme", text: "启用 Everforest 明暗主题，并移除原默认主题及其专属视觉资源。" },
      { tag: "ui", text: "优化思考强度滑轨比例与端点留白；侧栏按钮改为浅色/深色快速切换，并暂时隐藏设置中的外观入口。" },
      { tag: "core", text: "完成品牌、本地存储、真实供应商与前后端开发环境的统一。" }
    ]
  }
];
