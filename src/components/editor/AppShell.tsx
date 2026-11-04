"use client";
import { Suspense } from "react";
import { useSaveContext } from "@/components/editor/SaveContext";
import { Landing } from "@/components/editor/Landing";
import { EditorLayout } from "@/components/editor/EditorLayout";

function Loading() {
  return <div className="grid min-h-dvh place-items-center text-sm text-muted">Loading editor...</div>;
}

export function AppShell() {
  const { save } = useSaveContext();
  return (
    <Suspense fallback={<Loading />}>
      {save ? <EditorLayout /> : <Landing />}
    </Suspense>
  );
}
