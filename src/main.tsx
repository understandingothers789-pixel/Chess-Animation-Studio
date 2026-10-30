import { createRoot } from "react-dom/client";
import { ExportOutput, PresentationOutput } from "./renderer/Output";
import { App } from "./ui/App";
import "./ui/styles.css";
const mode = new URLSearchParams(location.search).get("mode");
createRoot(document.getElementById("root")!).render(
  mode === "export" ? (
    <ExportOutput />
  ) : mode === "presentation" ? (
    <PresentationOutput />
  ) : (
    <App />
  ),
);
