import { expect, it, vi } from "vitest";
import { createProjectActions } from "../src/modules/projects/services/project-actions.js";

it("keeps invalid project names inside the prompt and cancellation creates nothing", async () => {
  const prompt = vi.fn().mockResolvedValueOnce("   ").mockResolvedValueOnce("x".repeat(61)).mockResolvedValueOnce(null);
  const store = { createProject: vi.fn() };
  const toast = vi.fn();
  const actions = createProjectActions({ store, dialogs: { prompt }, toast });
  await actions.createProject();
  expect(prompt.mock.calls[1][0].message).toBe("项目名称不能为空");
  expect(prompt.mock.calls[2][0].message).toBe("项目名称不能超过 60 个字符");
  expect(store.createProject).not.toHaveBeenCalled();
  expect(toast).not.toHaveBeenCalled();
});
