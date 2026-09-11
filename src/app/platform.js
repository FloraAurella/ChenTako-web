export function installPlatform({scope,store,chat}) {
  function syncAppHeight() {
    const height = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    document.documentElement.style.setProperty("--app-height", `${height}px`);
  }
  if (window.visualViewport) scope.listen(window.visualViewport, "resize", syncAppHeight);
  syncAppHeight();

  if (window.clawbox) document.body.classList.add("desktop-embed");

  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const syncReducedMotion = () => document.body.classList.toggle("prefers-reduced-motion", reducedMotionQuery.matches);
  if (reducedMotionQuery.addEventListener) scope.listen(reducedMotionQuery, "change", syncReducedMotion);
  syncReducedMotion();

  scope.listen(document, "visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      store.flushDrafts();
      store.persist();
    }
  });
  scope.listen(window, "beforeunload", () => chat.stopAllStreams());

}
