import { readUiPreferences, writeUiPreferences } from '../../modules/appearance/public/services_preferences.js';
/** Owns sidebar geometry, preference and keyboard focus. */
export function createSidebar({scope,store,theme,shell}) {
  let drawerOpen = false;
  let archivesCollapsed = readUiPreferences().drawerCollapsed === true;

  function persistArchivesPreference() {
    writeUiPreferences({ ...theme.prefs, drawerCollapsed: archivesCollapsed });
  }

  // ---- 抽屉（移动端 / 折叠断点） ----

  function focusDrawerControl() {
    // Wait for React's inert update and the visibility transition's first paint.
    scope.frame(() => scope.frame(() => {
      document.getElementById("archivesCollapseBtn").focus();
    }));
  }

  function openDrawer({ focus = true } = {}) {
    drawerOpen = true;
    store.actions.setSidebar({ drawerOpen: true });
    if (focus) focusDrawerControl();
  }

  function closeDrawer() {
    drawerOpen = false;
    store.actions.setSidebar({ drawerOpen: false });
    if (shell.archiveDrawer.contains(document.activeElement)) {
      scope.frame(() => (window.innerWidth > 720 ? document.getElementById("railExpandBtn") : shell.drawerToggle).focus());
    }
  }

  // ---- 归档栏：折叠断点（≤1040 覆盖层抽屉）+ 桌面收回/展开 ----

  const sidebarQuery = window.matchMedia("(max-width: 1040px)");

  function applyArchivesMode() {
    const archivesMode = sidebarQuery.matches
      ? "rail"
      : (archivesCollapsed ? "collapsed" : "full");
    store.actions.setSidebar({ archivesMode });
  }

  scope.listen(shell.drawerToggle, "click", () => {
    if (store.state.sidebar.archivesMode === "collapsed") {
      archivesCollapsed = false;
      applyArchivesMode();
      persistArchivesPreference();
      focusDrawerControl();
      return;
    }
    if (drawerOpen) closeDrawer();
    else openDrawer();
  });
  scope.listen(shell.drawerScrim, "click", closeDrawer);
  scope.listen(document.getElementById("railExpandBtn"), "click", () => shell.drawerToggle.click());
  scope.listen(document.getElementById("railNewBtn"), "click", () => document.getElementById("newConversationBtn").click());
  scope.listen(document.getElementById("railImportBtn"), "click", () => document.getElementById("importConversationBtn").click());
  for (const id of ["railSearchBtn", "sidebarSearchBtn"]) {
    scope.listen(document.getElementById(id), "click", () => {
      if (id === "railSearchBtn") shell.drawerToggle.click();
      scope.frame(() => scope.frame(() => {
        shell.searchInput.focus();
        shell.searchInput.select();
      }));
    });
  }


  scope.listen(document.getElementById("archivesCollapseBtn"), "click", () => {
    if (sidebarQuery.matches) {
      closeDrawer();
      return;
    }
    archivesCollapsed = true;
    applyArchivesMode();
    persistArchivesPreference();
    scope.frame(() => (window.innerWidth > 720 ? document.getElementById("railExpandBtn") : shell.drawerToggle).focus());
  });

  scope.listen(sidebarQuery, "change", () => {
    applyArchivesMode();
    if (!sidebarQuery.matches) closeDrawer();
  });
  applyArchivesMode();

 return {sidebarQuery,openDrawer,closeDrawer,focusDrawerControl,applyArchivesMode,persistArchivesPreference,
 get drawerOpen(){return drawerOpen;},get archivesCollapsed(){return archivesCollapsed;},set archivesCollapsed(value){archivesCollapsed=value;}};
}
