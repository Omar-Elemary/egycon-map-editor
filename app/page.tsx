"use client";

import dynamic from "next/dynamic";

const EditorShell = dynamic(() => import("@/components/editor/EditorShell"), {
  ssr: false,
  loading: () => (
    <div className="grid h-screen place-items-center bg-zinc-100 text-sm text-zinc-500">
      Loading editor…
    </div>
  ),
});

export default function Home() {
  return <EditorShell />;
}
