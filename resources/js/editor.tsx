import "@vitejs/plugin-react/preamble";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import EditorShell from "./components/editor/EditorShell";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <EditorShell />
  </StrictMode>,
);
