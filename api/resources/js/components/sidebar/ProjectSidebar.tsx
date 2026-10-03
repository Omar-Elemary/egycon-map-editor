"use client";

import { FolderPlus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useEditorStore } from "@/store/editor-store";

export function ProjectSidebar() {
  const summaries = useEditorStore((state) => state.summaries);
  const project = useEditorStore((state) => state.project);
  const createProject = useEditorStore((state) => state.createProject);
  const switchProject = useEditorStore((state) => state.switchProject);
  const deleteProject = useEditorStore((state) => state.deleteProject);
  const [name, setName] = useState("");

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-zinc-200 bg-white">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-sm font-semibold tracking-wide text-zinc-500">PROJECTS</h2>
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto px-3 pb-3">
        {summaries.map((summary) => {
          const active = summary.id === project?.id;
          return (
            <button
              key={summary.id}
              type="button"
              onClick={() => switchProject(summary.id)}
              className={`group flex w-full items-start justify-between rounded-xl px-3 py-2.5 text-left transition ${
                active ? "bg-lime-100" : "hover:bg-zinc-100"
              }`}
            >
              <span>
                <span className="block text-sm font-medium text-zinc-900">{summary.name}</span>
                <span className="block text-xs text-zinc-500">
                  {summary.width} x {summary.height} px
                </span>
              </span>
              <span
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  event.stopPropagation();
                  deleteProject(summary.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") deleteProject(summary.id);
                }}
                className="rounded p-1 text-zinc-400 opacity-0 hover:bg-white hover:text-red-600 group-hover:opacity-100"
                aria-label={`Delete ${summary.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </span>
            </button>
          );
        })}
      </div>
      <form
        className="border-t border-zinc-200 p-3"
        onSubmit={(event) => {
          event.preventDefault();
          createProject(name.trim() || "New venue");
          setName("");
        }}
      >
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="New project..."
          className="mb-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-lime-500"
        />
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          <FolderPlus className="h-4 w-4" />
          Create project
        </button>
      </form>
    </aside>
  );
}
