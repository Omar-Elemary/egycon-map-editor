import type Konva from "konva";
import type { MapProject } from "./types";

export function exportStageRegion(
  stage: Konva.Stage,
  project: MapProject,
  pixelRatio = 2,
): string {
  const previous = {
    x: stage.x(),
    y: stage.y(),
    scaleX: stage.scaleX(),
    scaleY: stage.scaleY(),
    width: stage.width(),
    height: stage.height(),
  };
  const container = stage.container();
  const previousStyle = {
    width: container.style.width,
    height: container.style.height,
  };

  stage.position({ x: 0, y: 0 });
  stage.scale({ x: 1, y: 1 });
  stage.size({ width: project.width, height: project.height });
  container.style.width = `${project.width}px`;
  container.style.height = `${project.height}px`;
  stage.draw();

  const dataUrl = stage.toDataURL({
    mimeType: "image/png",
    pixelRatio,
    x: 0,
    y: 0,
    width: project.width,
    height: project.height,
  });

  stage.position({ x: previous.x, y: previous.y });
  stage.scale({ x: previous.scaleX, y: previous.scaleY });
  stage.size({ width: previous.width, height: previous.height });
  container.style.width = previousStyle.width;
  container.style.height = previousStyle.height;
  stage.draw();

  return dataUrl;
}
