"use client";

import { useEffect } from "react";
import { useAtom } from "jotai";
import { vhState } from "@src/client/states";

function resolveBackground(theme) {
  const paletteBackground = theme?.palette?.background?.immersive;
  const titleBackground = theme?.colors?.titleBackgroundColor;
  return titleBackground ?? paletteBackground ?? null;
}

export function OuterContainer(props) {
  const { children, title, theme } = props;
  const [, setVh] = useAtom(vhState);

  useEffect(() => {
    const setViewportHeight = () => setVh(window.innerHeight);
    window.addEventListener("resize", setViewportHeight);
    setViewportHeight();
    return () => window.removeEventListener("resize", setViewportHeight);
  }, [setVh]);

  useEffect(() => {
    if (title) {
      document.title = title;
    }
  }, [title]);

  const backgroundOverride = resolveBackground(theme);

  return (
    <main
      className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-foreground transition-colors"
      style={backgroundOverride ? { backgroundColor: backgroundOverride } : undefined}
    >
      <div className="flex min-h-screen w-full flex-col items-center justify-start px-4 pb-16 pt-24 sm:px-6 lg:px-10">
        {children}
      </div>
    </main>
  );
}