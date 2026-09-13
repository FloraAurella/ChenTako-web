"use strict";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const rootFile = (name) => fileURLToPath(new URL(name, import.meta.url));

// 生产构建默认不生成 source map；显式设置 AI_CHATBOX_SOURCEMAP=true 时才生成
const enableSourceMap = (process.env.AI_CHATBOX_SOURCEMAP ?? process.env.CLAWBOX_SOURCEMAP ?? process.env.TRIBBLEBOOK_SOURCEMAP) === "true";

export default defineConfig({
  plugins: [react()],
  base: "./",
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: process.env.FRONTEND_E2E === "1" ? undefined : {
      "/api": {
        target: `http://127.0.0.1:${process.env.AI_CHATBOX_PORT || 3000}`,
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: "dist",
    sourcemap: enableSourceMap,
    target: "es2022",
    rollupOptions: {
      input: {
        app: rootFile("./index.html"),
        onboarding: rootFile("./onboarding.html")
      }
    }
  },
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.{js,ts,tsx}"],
    setupFiles: ["test/setup.js"],
    globals: false
  }
});
