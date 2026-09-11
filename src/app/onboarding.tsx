"use strict";

import { createRoot } from "react-dom/client";
import "./styles/main.css";
import "../resources/styles/onboarding.css";
import { OnboardingApp } from "../modules/onboarding/public/ui_OnboardingApp";

const root = document.getElementById("app");
if (!root) throw new Error("缺少 onboarding 根节点 #app");
createRoot(root).render(<OnboardingApp />);
