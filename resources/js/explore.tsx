import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ExploreViewer } from "./components/explore/ExploreViewer";
import { parseShareMap } from "./lib/share";

const payload = JSON.parse(document.getElementById("map-data")?.textContent || "null");
const map = parseShareMap(payload);
const root = document.getElementById("root");

if (root && map) {
  createRoot(root).render(
    <StrictMode>
      <ExploreViewer map={map} />
    </StrictMode>,
  );
}
