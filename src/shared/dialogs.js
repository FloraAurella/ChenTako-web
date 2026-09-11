"use strict";

/** React Portal 对话框服务的兼容门面。 */
import { createReactDialogManager } from "./overlays/dialog-service.ts";

export function createDialogManager({ host } = {}) {
  void host;
  return createReactDialogManager();
}
