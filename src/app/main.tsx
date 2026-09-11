"use strict";

import { createRoot } from "react-dom/client";
import "./styles/main.css";
import { MainApp } from "./MainApp";

const root = document.getElementById("app");
if (!root) throw new Error("缺少应用根节点 #app");
const reactRoot = createRoot(root);
reactRoot.render(<MainApp />);
if (import.meta.hot) import.meta.hot.dispose(() => reactRoot.unmount());
