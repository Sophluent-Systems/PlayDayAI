"use client";

import React from "react";
import clsx from "clsx";

export function GlassCard({ children, className, padding = 'p-8' }) {
  return (
    <div
      className={clsx(
        'glass-panel rounded-3xl border border-border/60 bg-surface/95 shadow-xl backdrop-blur-xl',
        padding,
        className
      )}
    >
      {children}
    </div>
  );
}
