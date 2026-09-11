"use strict";

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:5198",
    viewport: { width: 1280, height: 800 }
  },
  expect: {
    toHaveScreenshot: { maxDiffPixels: 0 }
  },
  webServer: {
    command: "FRONTEND_E2E=1 npm run dev -- --port 5198 --strictPort",
    url: "http://127.0.0.1:5198",
    reuseExistingServer: false,
    timeout: 30000
  },
  projects: [{ name: "chromium", use: { browserName: "chromium", channel: "chrome" } }]
});
