import { VERSION } from "./core/project";
import { createRoot } from "react-dom/client";
import { App } from "./ui/App";
import { Output } from "./render/Output";
import "./ui/style.css";
document.title = `Chess Animation Studio ${VERSION}`;
const role = new URLSearchParams(location.search).get("role");
createRoot(document.getElementById("root")!).render(
  role === "export" || role === "presentation" ? <Output /> : <App />,
);
