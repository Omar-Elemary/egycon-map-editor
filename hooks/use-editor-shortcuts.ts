"use client";

import { useEffect } from "react";
import { useEditorStore } from "@/store/editor-store";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export function useEditorShortcuts(): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) return;

      const store = useEditorStore.getState();
      const meta = event.metaKey || event.ctrlKey;

      if (meta && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) store.redo();
        else store.undo();
        return;
      }
      if (meta && event.key.toLowerCase() === "y") {
        event.preventDefault();
        store.redo();
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        store.deleteSelected();
        return;
      }
      if (event.key === "Escape") {
        store.setSelectedIds([]);
        store.setTool("select");
        return;
      }
      if (event.key.toLowerCase() === "d" && !meta) {
        event.preventDefault();
        store.duplicateSelected();
        return;
      }
      if (event.key.toLowerCase() === "r" && !meta) {
        event.preventDefault();
        store.rotateSelected(15);
        return;
      }
      if (event.key.toLowerCase() === "k" && !meta) {
        event.preventDefault();
        store.toggleToolbarLayout();
        return;
      }
      if (event.key.toLowerCase() === "v") store.setTool("select");
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
