import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import "@xterm/xterm/css/xterm.css";
import "./styles/app.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Meowdesk next renderer root was not found.");
}

document.documentElement.classList.add("vs-visual-v1", "vs-sidebar-collapsed", "vs-legacy-css-compat");
document.documentElement.dataset.vsVisual = "css-compat-only";

createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
