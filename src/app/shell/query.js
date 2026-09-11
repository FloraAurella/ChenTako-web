"use strict";

/** React AppShell 渲染完成后查询稳定挂载点；本模块不再生成或改写 DOM。 */
export function queryShell(root) {
  return {
    appShell: root.querySelector("#appShell"),
    archiveDrawer: root.querySelector("#archiveDrawer"),
    drawerScrim: root.querySelector("#drawerScrim"),
    drawerToggle: root.querySelector("#drawerToggleBtn"),
    searchInput: root.querySelector("#searchInput"),
    conversationList: root.querySelector("#conversationList"),
    stageEyebrow: root.querySelector("#stageEyebrow"),
    stageTitle: root.querySelector("#stageTitle"),
    stageActions: root.querySelector("#stageActions"),
    pageChat: root.querySelector("#page-chat"),
    pageSettings: root.querySelector("#page-settings"),
    settingsContent: root.querySelector("#settingsContent"),
    popoverHost: root.querySelector("#popoverHost"),
    lightbox: root.querySelector("#lightbox")
  };
}
