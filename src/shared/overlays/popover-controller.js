export function createPopoverController({host,beforeOpen = () => {}}) {
 let activePopover = null;
  function openPopover({ anchor, kind, width, html, cardClass = "", scrim = true, bind, align, placement }) {
    beforeOpen();
    closeActivePopover();
    
    const layer = document.createElement("div");
    layer.className = "popover-layer";
    layer.dataset.scrim = scrim ? "on" : "off";
    const scrimEl = document.createElement("div");
    scrimEl.className = "popover-scrim";
    const card = document.createElement("div");
    card.className = `popover-card${cardClass ? ` ${cardClass}` : ""}`;
    if (width) card.style.width = `${width}px`;
    card.innerHTML = html;
    // 卡片必须在首次定位完成前不可见、不可命中；否则它会短暂落在
    // popoverHost 的默认左上位置，快速点击空白时可能误命中卡片内容。
    card.style.visibility = "hidden";
    card.style.left = "14px";
    card.style.top = "14px";
    // 外部命中统一交给文档捕获监听；透明层保留结构但不能挡住侧栏、导航等底层控件。
    scrimEl.style.pointerEvents = "none";
    layer.appendChild(scrimEl);
    layer.appendChild(card);
    host.appendChild(layer);

    let positionFrame = 0;
    let controller = null;

    function isInside(node, event) {
      const path = typeof event.composedPath === "function" ? event.composedPath() : [];
      if (path.includes(node)) return true;
      const target = event.target;
      return Boolean(target && typeof target === "object" && "nodeType" in target && node.contains(target));
    }

    let removeSuppressedAnchorClick = null;
    function suppressAnchorClick() {
      removeSuppressedAnchorClick?.();
      let timer = 0;
      const onSuppressedClick = (event) => {
        if (isInside(anchor, event)) {
          event.preventDefault();
          event.stopPropagation();
        }
        remove();
      };
      const remove = () => {
        document.removeEventListener("click", onSuppressedClick, true);
        clearTimeout(timer);
        if (removeSuppressedAnchorClick === remove) removeSuppressedAnchorClick = null;
      };
      removeSuppressedAnchorClick = remove;
      document.addEventListener("click", onSuppressedClick, true);
      timer = setTimeout(remove, 500);
    }

    // 所有浮层使用同一套外部点击规则：卡片和锚点内不关闭，其余位置一次关闭。
    // 捕获阶段先处理，避免浮层移除后同一手势再落到底层控件并重新打开浮层。
    const closeFromOutside = (event) => {
      if (isInside(card, event)) return;
      if (isInside(anchor, event)) {
        // 锚点位于当前浮层之外时，关闭当前浮层并吞掉同一次 click，避免按钮再次打开它。
        if (event.type === "pointerdown") {
          controller.close();
          suppressAnchorClick();
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        controller.close();
        return;
      }
      controller.close();
    };
    const onDocPointerDown = (event) => {
      closeFromOutside(event);
    };
    const onDocClick = (event) => {
      closeFromOutside(event);
    };
    document.addEventListener("pointerdown", onDocPointerDown, true);
    document.addEventListener("click", onDocClick, true);

    const onResize = () => position();
    // Escape 统一关闭当前浮层；对话框在浮层之上时让对话框先处理
    const onKeyDown = (event) => {
      if (event.key !== "Escape" || event.isComposing) return;
      if (controller.closed || document.querySelector(".dialog-backdrop")) return;
      event.preventDefault();
      controller.close();
    };
    document.addEventListener("keydown", onKeyDown, true);
    controller = {
      kind,
      card,
      layer,
      anchor,
      align,
      closed: false,
      position: () => position(),
      close() {
        if (controller.closed) return;
        controller.closed = true;
        controller.panelCleanup?.();
        if (positionFrame) {
          cancelAnimationFrame(positionFrame);
          positionFrame = 0;
        }
        removeSuppressedAnchorClick?.();
        document.removeEventListener("pointerdown", onDocPointerDown, true);
        document.removeEventListener("click", onDocClick, true);
        document.removeEventListener("keydown", onKeyDown, true);
        window.removeEventListener("resize", onResize);
        const hadFocus = layer.contains(document.activeElement);
        layer.remove();
        if (anchor.getAttribute("aria-expanded")) anchor.setAttribute("aria-expanded", "false");
        // 焦点恢复：关闭时焦点若随浮层消失或落在 body，交还锚点
        if ((hadFocus || document.activeElement === document.body) && anchor.isConnected) {
          anchor.focus({ preventScroll: true });
        }
        if (activePopover === controller) activePopover = null;
      }
    };
    if (anchor.getAttribute("aria-expanded")) anchor.setAttribute("aria-expanded", "true");

    // 弹层打开期间持续跟随窗口尺寸变化；关闭时移除监听
    window.addEventListener("resize", onResize);

    function position() {
      if (controller.closed) return;
      const rect = anchor.getBoundingClientRect();
      if (placement === "top") {
        card.style.maxHeight = `${Math.max(0, Math.min(400, rect.top - 22))}px`;
      }
      // pop-in 缩放动画进行中 getBoundingClientRect 量到的是中间帧视觉宽高，
      // 会污染对齐计算；offsetWidth/Height 不受 transform 影响，取布局尺寸。
      const fallbackRect = card.getBoundingClientRect();
      const cardWidth = card.offsetWidth || fallbackRect.width;
      const cardHeight = card.offsetHeight || fallbackRect.height;
      // align="right"：右缘对齐锚点右缘（供右对齐的运行配置锚点使用，锚点宽度
      // 随模型名变化时不让面板左右漂移）；其余沿用左对齐锚点左缘。
      let left = controller.align === "right"
        ? Math.min(rect.right - cardWidth, window.innerWidth - cardWidth - 14)
        : Math.min(rect.left, window.innerWidth - cardWidth - 14);
      left = Math.max(14, left);
      let top = placement === "top" ? Math.max(14, rect.top - cardHeight - 8) : rect.bottom + 8;
      if (top + cardHeight > window.innerHeight - 14) {
        top = Math.max(14, rect.top - cardHeight - 8);
      }
      card.style.left = `${left}px`;
      card.style.top = `${top}px`;
    }

    // 同步完成首帧定位，再用一帧校正字体/布局变化；首帧期间卡片仍不可命中。
    position();
    card.style.visibility = "";
    positionFrame = requestAnimationFrame(() => {
      positionFrame = 0;
      position();
    });
    activePopover = controller;
    if (bind) bind(card, controller);
    return controller;
  }

  function closeActivePopover() {
    if (!activePopover) return false;
    activePopover.close();
    return true;
  }

  // ---- 运行配置浮层：根目录 → 模型 / 思考强度，同一锚点同一容器内切换面板 ----

 return {openPopover,closeActivePopover,get current() {return activePopover;}};
}
