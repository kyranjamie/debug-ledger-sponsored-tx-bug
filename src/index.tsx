import React from "react";
import ReactDOM from "react-dom/client";
import { Buffer } from "buffer";
import process from "process";
import App from "./App";

// Polyfill Buffer and process for browser environment
window.Buffer = Buffer;
window.process = process;

const rootElement = document.getElementById("root")!;
const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
